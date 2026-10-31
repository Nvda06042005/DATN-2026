import { ForbiddenException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { DatabaseService, Q, UserRow } from '../database/database.service';
import { validSchoolYear } from './school.service';

export interface ReportFilter { school_id?: number; region?: string; city?: string; active?: 'true' | 'false'; school_year?: string }
const COUNTS = ['schools','active_schools','grades','classes','active_classes','approved_classes','teachers','active_teachers','assigned_teachers','students','active_students','joined_students','learning_students','completed_students','completed_sessions','answers','correct','score_students','score_sum','competitions','participations','unique_participants','competition_answers','competition_correct','legacy_competitions'] as const;
type Counts = Record<(typeof COUNTS)[number],number>;
const empty = ():Counts => Object.fromEntries(COUNTS.map(k=>[k,0])) as Counts;
const ratio = (n:number,d:number) => d ? Math.round(n/d*10000)/10000 : null;
const metrics = (v:Counts) => ({...v,inactive_schools:v.schools-v.active_schools,unassigned_teachers:v.teachers-v.assigned_teachers,unjoined_students:v.students-v.joined_students,completion_rate:ratio(v.completed_students,v.students),game_participation_rate:ratio(v.learning_students,v.students),average_score:v.score_students?Math.round(v.score_sum/v.score_students*100)/100:null,accuracy:ratio(v.correct,v.answers),competition_accuracy:ratio(v.competition_correct,v.competition_answers)});
interface School { id:number;school_code:string;name:string;region:string|null;city:string|null;is_active:boolean }
type Group = { school_id:number|null;grade:number|null;school_year?:string } & Partial<Counts>;
export const REPORT_DEFINITIONS = [
  'Phạm vi: tổng xem mọi trường; quản trị trường chỉ xem trường được gán. Tài khoản trong thùng rác không tính vào nhân sự. Người chưa gán trường vẫn tính khi xem toàn hệ thống không lọc trường/địa bàn/trạng thái trường, nhưng không nằm trong so sánh theo trường.',
  'Khối là cặp trường–khối có lớp hoặc học sinh; khối 7 của hai trường được tính là hai khối. Cấp học trên nền tảng hiện là THCS (6–9).',
  'Lớp hoạt động: cờ hoạt động lớp và trường đều bật; lớp đã phân công/tham gia phải đồng thời được duyệt. Giáo viên/học sinh đã vào lớp được đếm một lần, dù có nhiều lớp.',
  'Lọc năm học chọn các lớp đúng năm; nhân sự có năm học hồ sơ hoặc được gán/tham gia lớp trong năm đó. Số trường vẫn là số trường trong phạm vi đã chọn.',
  'Tiến độ tích lũy của nhóm học sinh được lọc, không phải ảnh chụp lịch sử theo năm. Hoàn thành = học sinh đã hoàn thành ít nhất một lượt học/trận / tổng học sinh.',
  'Điểm luyện tập TB (/10) = trung bình (10 × số câu đúng / số câu trả lời) của học sinh đã trả lời; không phải điểm học kỳ. Tham gia luyện tập/game = học sinh có câu trả lời được chấm / tổng học sinh.',
  'Thi đấu chỉ tính trận đã kết thúc và được lưu. Lượt tham gia là một học sinh trong một trận, kể cả chưa trả lời; tỷ lệ đúng = tổng câu đúng / tổng câu đã trả lời. Không có câu trả lời hiển thị — (Excel để trống).',
  'Trận cũ gán theo trường hiện tại của giáo viên tại lúc migration 010; năm học cũ không được đoán. Lọc năm học loại các trận chưa rõ năm. Trận mới giữ trường của phòng; chỉ lưu năm/khối khi xác định được một lớp duy nhất.',
];

@Injectable()
export class ReportService {
  constructor(private readonly db:DatabaseService) {}

  async dashboard(actor:UserRow,f:ReportFilter={}) {
    if (!['root_admin','school_admin'].includes(actor.role)) throw new ForbiddenException('Chỉ dành cho quản trị');
    if (f.school_year && !validSchoolYear(f.school_year)) throw new UnprocessableEntityException('Năm học có dạng 2026-2027 và hai năm liên tiếp');
    const scope=actor.role==='root_admin'?null:actor.school_id;
    if(actor.role!=='root_admin'&&!scope) throw new ForbiddenException('Tài khoản chưa được gán trường');
    const run=(fn:(q:Q)=>Promise<unknown>)=>scope===null?this.db.tx(fn):this.db.scoped(scope!,fn);
    // Keep the inferred return type while sharing the root/scoped transaction boundary.
    const read=async(q:Q)=>{
      const sid=scope??f.school_id??null;
      const schools=await q<School>('SELECT id,school_code,name,region,city,is_active FROM app_schools WHERE ($1::integer IS NULL OR id=$1) AND ($2::text IS NULL OR region=$2) AND ($3::text IS NULL OR city=$3) AND ($4::boolean IS NULL OR is_active=$4) ORDER BY name,id',[sid,f.region??null,f.city??null,f.active===undefined?null:f.active==='true']);
      const ids=schools.map(s=>s.id),params=[ids,f.school_year??null];
      const includeUnassigned=scope===null&&!f.school_id&&!f.region&&!f.city&&f.active===undefined,peopleParams=[...params,includeUnassigned];
      const classes=await q<Group>(`SELECT c.school_id,c.grade,c.school_year,count(*)::int AS classes,
        count(*) FILTER(WHERE c.is_active AND s.is_active)::int AS active_classes,
        count(*) FILTER(WHERE c.status='APPROVED')::int AS approved_classes
        FROM app_classes c JOIN app_schools s ON s.id=c.school_id WHERE c.school_id=ANY($1::int[]) AND ($2::text IS NULL OR c.school_year=$2)
        GROUP BY c.school_id,c.grade,c.school_year ORDER BY c.school_id,c.grade,c.school_year`,params);
      const members=await q<Group>(`SELECT u.school_id,u.grade,
        count(*) FILTER(WHERE u.role='teacher')::int AS teachers,
        count(*) FILTER(WHERE u.role='teacher' AND u.is_active=1 AND coalesce(s.is_active,true))::int AS active_teachers,
        count(*) FILTER(WHERE u.role='teacher' AND EXISTS(SELECT 1 FROM app_classes c WHERE c.school_id=u.school_id AND c.teacher_id=u.id AND c.status='APPROVED' AND c.is_active AND s.is_active AND ($2::text IS NULL OR c.school_year=$2)))::int AS assigned_teachers,
        count(*) FILTER(WHERE u.role='student')::int AS students,
        count(*) FILTER(WHERE u.role='student' AND u.is_active=1 AND coalesce(s.is_active,true))::int AS active_students,
        count(*) FILTER(WHERE u.role='student' AND EXISTS(SELECT 1 FROM app_class_members m JOIN app_classes c ON c.id=m.class_id WHERE m.user_id=u.id AND c.school_id=u.school_id AND c.status='APPROVED' AND c.is_active AND s.is_active AND ($2::text IS NULL OR c.school_year=$2)))::int AS joined_students,
        count(*) FILTER(WHERE u.role='student' AND p.questions_answered>0)::int AS learning_students,
        count(*) FILTER(WHERE u.role='student' AND p.lessons_completed>0)::int AS completed_students,
        coalesce(sum(p.lessons_completed) FILTER(WHERE u.role='student'),0)::float AS completed_sessions,
        coalesce(sum(p.questions_answered) FILTER(WHERE u.role='student'),0)::float AS answers,
        coalesce(sum(p.questions_correct) FILTER(WHERE u.role='student'),0)::float AS correct,
        count(*) FILTER(WHERE u.role='student' AND p.questions_answered>0)::int AS score_students,
        coalesce(sum(10.0*p.questions_correct/nullif(p.questions_answered,0)) FILTER(WHERE u.role='student'),0)::float AS score_sum
        FROM app_users u LEFT JOIN app_schools s ON s.id=u.school_id LEFT JOIN app_progress p ON p.user_id=u.id
        WHERE (u.school_id=ANY($1::int[]) OR ($3 AND u.school_id IS NULL)) AND u.deleted_at IS NULL AND u.role IN ('teacher','student')
        AND ($2::text IS NULL OR u.school_year=$2 OR EXISTS(SELECT 1 FROM app_classes c WHERE c.school_id=u.school_id AND c.school_year=$2 AND (c.teacher_id=u.id OR EXISTS(SELECT 1 FROM app_class_members m WHERE m.class_id=c.id AND m.user_id=u.id))))
        GROUP BY u.school_id,u.grade`,peopleParams);
      const matches=await q<Group>(`SELECT l.school_id,count(DISTINCT l.id)::int AS competitions,count(r.user_id)::int AS participations,
        count(DISTINCT r.user_id)::int AS unique_participants,coalesce(sum(r.answered),0)::float AS competition_answers,coalesce(sum(r.correct),0)::float AS competition_correct,
        count(DISTINCT l.id) FILTER(WHERE l.school_year IS NULL)::int AS legacy_competitions
        FROM app_live_sessions l LEFT JOIN app_live_results r ON r.session_id=l.id
        WHERE (l.school_id=ANY($1::int[]) OR ($3 AND l.school_id IS NULL)) AND ($2::text IS NULL OR l.school_year=$2) GROUP BY l.school_id`,peopleParams);
      const unknown=Number((await q<{n:number}>('SELECT count(*)::int AS n FROM app_live_sessions WHERE (school_id=ANY($1::int[]) OR ($2 AND school_id IS NULL)) AND school_year IS NULL',[ids,includeUnassigned]))[0].n);
      const places=await q<Pick<School,'region'|'city'>>('SELECT DISTINCT region,city FROM app_schools WHERE ($1::int IS NULL OR id=$1)',[scope]);
      const years=await q<{school_year:string}>(`SELECT DISTINCT school_year FROM (
        SELECT school_year FROM app_classes WHERE ($1::int IS NULL OR school_id=$1)
        UNION SELECT school_year FROM app_users WHERE deleted_at IS NULL AND ($1::int IS NULL OR school_id=$1)
        UNION SELECT school_year FROM app_live_sessions WHERE ($1::int IS NULL OR school_id=$1)
        ) y WHERE school_year IS NOT NULL ORDER BY school_year DESC`,[scope]);
      const unassigned=members.filter(x=>x.school_id===null).reduce((n,x)=>n+Number(x.teachers??0)+Number(x.students??0),0);
      const grades:Array<{school_id:number;school_name:string;grade:number;classes:number;students:number}>=[];
      const per_school=schools.map(s=>{
        const v=empty();v.schools=1;v.active_schools=Number(s.is_active);
        for(const row of [...classes,...members,...matches].filter(x=>x.school_id===s.id))for(const k of COUNTS)v[k]+=Number(row[k]??0);
        const known=new Set([...classes,...members.filter(x=>Number(x.students)>0)].filter(x=>x.school_id===s.id&&x.grade!==null).map(x=>x.grade!));v.grades=known.size;
        for(const grade of [...known].sort())grades.push({school_id:s.id,school_name:s.name,grade,classes:classes.filter(x=>x.school_id===s.id&&x.grade===grade).reduce((n,x)=>n+Number(x.classes),0),students:members.filter(x=>x.school_id===s.id&&x.grade===grade).reduce((n,x)=>n+Number(x.students),0)});
        return {...s,...metrics(v)};
      });
      const total=empty();for(const s of per_school)for(const k of COUNTS)total[k]+=s[k];
      for(const row of [...members,...matches].filter(x=>x.school_id===null))for(const k of COUNTS)total[k]+=Number(row[k]??0);
      // A transferred pupil appearing in multiple schools' history is one participant in the global total.
      total.unique_participants=Number((await q<{n:number}>('SELECT count(DISTINCT r.user_id)::int AS n FROM app_live_results r JOIN app_live_sessions l ON l.id=r.session_id WHERE (l.school_id=ANY($1::int[]) OR ($3 AND l.school_id IS NULL)) AND ($2::text IS NULL OR l.school_year=$2)',peopleParams))[0].n);
      const uniq=(xs:Array<string|null>)=>[...new Set(xs.filter((v):v is string=>!!v))].sort();
      return {scope:scope===null?'system' as const:'school' as const,viewer_role:actor.role,generated_at:new Date().toISOString(),filters:{...f,school_id:sid??undefined},summary:metrics(total),per_school,grades,
        class_breakdown:classes.map(row=>({...row,school_name:schools.find(s=>s.id===row.school_id)!.name})),
        education_levels:[{level:'THCS',schools:total.schools,classes:total.classes,students:total.students}],unassigned_people:unassigned,excluded_legacy_competitions:f.school_year?unknown:0,
        facets:{regions:uniq(places.map(p=>p.region)),cities:uniq(places.map(p=>p.city)),school_years:years.map(y=>y.school_year)},definitions:REPORT_DEFINITIONS};
    };
    return await run(read) as Awaited<ReturnType<typeof read>>;
  }

  async excel(actor:UserRow,f:ReportFilter) {
    const report=await this.dashboard(actor,f),book=new Workbook();book.creator='Đông A EDU';book.created=new Date(report.generated_at);
    const sheet=(name:string,headers:string[],rows:unknown[][])=>{const s=book.addWorksheet(name,{views:[{state:'frozen',ySplit:1}]});s.addRow(headers);for(const row of rows)s.addRow(row as Array<string|number|null>);s.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};s.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFB91C1C'}};s.columns.forEach((col,i)=>{col.width=i===0?32:23;});s.autoFilter={from:{row:1,column:1},to:{row:Math.max(1,s.rowCount),column:headers.length}};return s;};
    const labels:Record<string,string>={schools:'Số trường',active_schools:'Trường hoạt động',inactive_schools:'Trường tạm ngưng',grades:'Số cặp trường–khối',classes:'Số lớp',active_classes:'Lớp hoạt động',teachers:'Giáo viên',active_teachers:'GV hoạt động',assigned_teachers:'GV có lớp đang dạy',unassigned_teachers:'GV chưa có lớp đang dạy',students:'Học sinh',active_students:'HS hoạt động',joined_students:'HS đã vào lớp',unjoined_students:'HS chưa vào lớp',completion_rate:'Tỷ lệ HS hoàn thành lượt học',average_score:'Điểm luyện tập TB /10',game_participation_rate:'Tỷ lệ tham gia luyện tập/game',competitions:'Trận đã lưu',participations:'Lượt tham gia',competition_accuracy:'Tỷ lệ đúng thi đấu'};
    const main=sheet('Tổng quan',['Chỉ số','Giá trị'],Object.entries(labels).map(([k,label])=>[label,report.summary[k as keyof typeof report.summary]]));
    const bySchool=sheet('Theo trường',['Mã trường','Trường','Khu vực','Thành phố','Hoạt động',...Object.values(labels)],report.per_school.map(s=>[s.school_code,s.name,s.region,s.city,s.is_active?'Có':'Không',...Object.keys(labels).map(k=>s[k as keyof typeof s])]));
    Object.keys(labels).forEach((k,i)=>{const format=k.endsWith('_rate')||k.endsWith('_accuracy')?'0.0%':k==='average_score'?'0.00':'0';main.getCell(i+2,2).numFmt=format;bySchool.getColumn(i+6).numFmt=format;});
    sheet('Khối',['Trường','Khối','Lớp','Học sinh'],report.grades.map(g=>[g.school_name,g.grade,g.classes,g.students]));
    sheet('Lớp theo năm',['Trường','Khối','Năm học','Lớp','Lớp hoạt động','Lớp đã duyệt'],report.class_breakdown.map(g=>[g.school_name,g.grade,g.school_year,g.classes,g.active_classes,g.approved_classes]));
    sheet('Phạm vi và cách tính',['Mục','Nội dung'],[['Vai trò',actor.role==='root_admin'?'Quản trị tổng':'Quản trị trường'],['Phạm vi',report.scope==='system'?'Toàn hệ thống (theo bộ lọc)':'Trường được gán'],['Lúc xuất',report.generated_at],['Bộ lọc',JSON.stringify(report.filters)],['Nhân sự chưa gán trường',report.unassigned_people],['Trận cũ loại khỏi bộ lọc năm',report.excluded_legacy_competitions],...report.definitions.map((s,i)=>['Cách tính '+(i+1),s])]);
    return Buffer.from(await book.xlsx.writeBuffer());
  }
}
