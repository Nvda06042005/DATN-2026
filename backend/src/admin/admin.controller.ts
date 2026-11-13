import { BadRequestException, Body, Controller, Delete, Get, Header, HttpCode, Param, ParseIntPipe, Patch, Post, Put, Query, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsDefined, IsEmail, IsIn, IsInt, IsOptional, IsString, IsUrl, Length, Matches, Max, MaxLength, Min, ValidateIf, ValidateNested } from 'class-validator';
import { AuthGuard, CurrentUser, Roles } from '../auth/auth.guard';
import { SecurityService } from '../auth/security.service';
import { Role, UserRow } from '../database/database.service';
import { AccountService } from './account.service';
import { withCalendarAddin } from './calendar-addin';
import { ClassService } from './class.service';
import { UploadedXlsx, XLSX_MIME, XLSX_UPLOAD } from './excel';
import { MailService } from './mail.service';
import { SchoolService } from './school.service';

/** "  Đặng   Thu  Hà " -> "Đặng Thu Hà" */
const squash = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.split(/\s+/).filter(Boolean).join(' ') : value);
const YEAR_LABEL = /^\d{4}-\d{4}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
// Số điện thoại của quản trị tổng, quản trị trường, giáo viên và học sinh: đúng 10 chữ số, không dấu cách hay ký hiệu (điện thoại liên hệ của trường không bị giới hạn)
const PHONE = /^[0-9]{10}$/;
const PHONE_MESSAGE = 'Số điện thoại gồm đúng 10 chữ số';

class Page {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number;
}

class SchoolQuery extends Page {
  @IsOptional() @IsString() @MaxLength(80) q?: string;
  @IsOptional() @IsString() @MaxLength(80) city?: string;
  @IsOptional() @IsString() @MaxLength(80) region?: string;
  @IsOptional() @IsIn(['true', 'false']) active?: 'true' | 'false';
}

class DirectoryQuery {
  @IsOptional() @IsString() @MaxLength(80) q?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(30) limit?: number;
  /** Đang sửa một trường: không tính chính trường đó là "đã có" và báo bản ghi danh mục khớp với nó */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) exclude_school_id?: number;
}

class SchoolScope {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) school_id?: number;
}

class FirstAdminDto {
  @Transform(squash) @IsString() @Length(2, 80) full_name: string;
  @IsEmail() @MaxLength(254) email: string;
  @IsOptional() @Matches(PHONE, { message: PHONE_MESSAGE }) phone?: string | null;
  @IsOptional() @Matches(DATE, { message: 'Ngày sinh có dạng YYYY-MM-DD' }) birth_date?: string | null;
}

class CreateSchoolDto {
  @IsOptional() @IsString() @Length(1, 20) school_code?: string;
  @IsOptional() @IsString() @Length(1, 80) directory_code?: string;
  @Transform(squash) @IsString() @Length(2, 120) name: string;
  @IsOptional() @IsString() @MaxLength(80) region?: string | null;
  @IsOptional() @IsString() @MaxLength(80) city?: string | null;
  @IsOptional() @IsString() @MaxLength(255) address?: string | null;
  @IsOptional() @IsString() @MaxLength(120) contact_name?: string | null;
  @IsOptional() @IsEmail() contact_email?: string | null;
  @IsOptional() @IsString() @MaxLength(40) contact_phone?: string | null;
  @IsDefined({ message: 'Cần khai báo quản trị viên trường học đầu tiên (admin)' }) @ValidateNested() @Type(() => FirstAdminDto) admin: FirstAdminDto;
}

class UpdateMySchoolDto {
  @ValidateIf((_, v) => v !== undefined) @Transform(squash) @IsString() @Length(2, 120) name?: string;
  @IsOptional() @IsString() @MaxLength(255) address?: string | null;
  @IsOptional() @IsString() @MaxLength(120) contact_name?: string | null;
  @IsOptional() @IsEmail() contact_email?: string | null;
  @IsOptional() @IsString() @MaxLength(40) contact_phone?: string | null;
  @IsOptional() @IsUrl({ protocols: ['https'], require_protocol: true }, { message: 'Logo phải là liên kết https' }) @MaxLength(500) logo_url?: string | null;
}

class UpdateSchoolDto extends UpdateMySchoolDto {
  @IsOptional() @IsString() @Length(1, 80) directory_code?: string;
  /** Chỉ liên kết danh mục để lấy logo chính thức, không đổi tên, khu vực, địa chỉ */
  @ValidateIf((_, v) => v !== undefined) @IsBoolean() link_only?: boolean;
  @IsOptional() @IsString() @MaxLength(80) region?: string | null;
  @IsOptional() @IsString() @MaxLength(80) city?: string | null;
  @ValidateIf((_, v) => v !== undefined) @IsBoolean() is_active?: boolean;
}

class YearDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) school_id?: number;
  @Matches(YEAR_LABEL, { message: 'Năm học có dạng 2026-2027' }) label: string;
  @IsOptional() @Matches(DATE, { message: 'Ngày có dạng YYYY-MM-DD' }) starts_on?: string;
  @IsOptional() @Matches(DATE, { message: 'Ngày có dạng YYYY-MM-DD' }) ends_on?: string;
  @IsOptional() @IsIn(['national', 'manual']) calendar_mode?: 'national' | 'manual';
  @IsOptional() @Matches(DATE, { message: 'Ngày có dạng YYYY-MM-DD' }) term1_starts_on?: string | null;
  @IsOptional() @Matches(DATE, { message: 'Ngày có dạng YYYY-MM-DD' }) term1_ends_on?: string | null;
  @IsOptional() @Matches(DATE, { message: 'Ngày có dạng YYYY-MM-DD' }) term2_starts_on?: string | null;
  @IsOptional() @Matches(DATE, { message: 'Ngày có dạng YYYY-MM-DD' }) term2_ends_on?: string | null;
}

class UpdateYearDto {
  @IsOptional() @IsIn(['national', 'manual']) calendar_mode?: 'national' | 'manual';
  @IsOptional() @Matches(YEAR_LABEL, { message: 'Năm học có dạng 2026-2027' }) label?: string;
  @IsOptional() @Matches(DATE, { message: 'Ngày có dạng YYYY-MM-DD' }) starts_on?: string;
  @IsOptional() @Matches(DATE, { message: 'Ngày có dạng YYYY-MM-DD' }) ends_on?: string;
  @IsOptional() @Matches(DATE, { message: 'Ngày có dạng YYYY-MM-DD' }) term1_starts_on?: string | null;
  @IsOptional() @Matches(DATE, { message: 'Ngày có dạng YYYY-MM-DD' }) term1_ends_on?: string | null;
  @IsOptional() @Matches(DATE, { message: 'Ngày có dạng YYYY-MM-DD' }) term2_starts_on?: string | null;
  @IsOptional() @Matches(DATE, { message: 'Ngày có dạng YYYY-MM-DD' }) term2_ends_on?: string | null;
}

class YearQuery extends SchoolScope {
  @Type(() => Number) @IsInt() @Min(1) year_id: number;
}

class GradeDto {
  @Type(() => Number) @IsInt() @Min(1) year_id: number;
  @Type(() => Number) @IsInt() @Min(6) @Max(9) grade: number;
  @IsBoolean() is_active: boolean;
}

class GradeDeleteQuery {
  @Type(() => Number) @IsInt() @Min(1) year_id: number;
  @Type(() => Number) @IsInt() @Min(6) @Max(9) grade: number;
}

class UserQuery extends Page {
  @IsOptional() @IsString() @MaxLength(80) q?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) school_id?: number;
  @IsOptional() @IsIn(['root_admin', 'school_admin', 'teacher', 'student']) role?: Role;
  @IsOptional() @IsIn(['true', 'false']) active?: 'true' | 'false';
  @IsOptional() @Type(() => Number) @IsInt() @Min(6) @Max(9) grade?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) class_id?: number;
}

class CreateAdminDto {
  @Transform(squash) @IsString() @Length(2, 80) full_name: string;
  @IsIn(['root_admin', 'school_admin']) role: 'root_admin' | 'school_admin';
  @IsEmail() @MaxLength(254) email: string;
  @IsOptional() @Matches(PHONE, { message: PHONE_MESSAGE }) phone?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) school_id?: number | null;
  @IsOptional() @Type(() => Number) @IsIn([1, 2]) admin_level?: 1 | 2;
  @IsOptional() @Matches(DATE, { message: 'Ngày sinh có dạng YYYY-MM-DD' }) birth_date?: string | null;
}

class CreateMemberDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) school_id?: number | null;
  @Transform(squash) @IsString() @Length(2, 80) full_name: string;
  @IsOptional() @IsEmail() @MaxLength(254) email?: string | null;
  @IsOptional() @Matches(PHONE, { message: PHONE_MESSAGE }) phone?: string | null;
  @IsOptional() @IsString() @MaxLength(40) user_code?: string | null;
  @IsOptional() @Matches(DATE, { message: 'Ngày sinh có dạng YYYY-MM-DD' }) birth_date?: string | null;
  @IsOptional() @IsIn(['male', 'female', 'other']) gender?: 'male' | 'female' | 'other' | null;
  @IsOptional() @IsEmail() @MaxLength(254) parent_email?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) class_id?: number | null;
}

class UpdateUserDto {
  @IsOptional() @Transform(squash) @IsString() @Length(2, 80) full_name?: string;
  @IsOptional() @IsEmail() @MaxLength(254) email?: string | null;
  @IsOptional() @Matches(PHONE, { message: PHONE_MESSAGE }) phone?: string | null;
  @IsOptional() @IsString() @MaxLength(40) user_code?: string | null;
  @IsOptional() @Matches(DATE, { message: 'Ngày sinh có dạng YYYY-MM-DD' }) birth_date?: string | null;
  @IsOptional() @IsIn(['male', 'female', 'other']) gender?: 'male' | 'female' | 'other' | null;
  @IsOptional() @IsEmail() @MaxLength(254) parent_email?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) school_id?: number | null;
}

class RoleDto {
  @IsIn(['root_admin', 'school_admin', 'teacher', 'student']) role: Role;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) school_id?: number | null;
  @IsOptional() @Type(() => Number) @IsIn([1, 2]) admin_level?: 1 | 2;
}

class LockDto {
  @IsBoolean() locked: boolean;
  @IsOptional() @IsString() @MaxLength(300) reason?: string | null;
}

class AssignQuery extends SchoolScope {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) year_id?: number;
}

class RosterQuery extends AssignQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) class_id?: number;
}

class PasswordQuery extends Page {
  @IsOptional() @IsString() @MaxLength(80) q?: string;
  @IsOptional() @IsIn(['teacher', 'student', 'school_admin']) role?: 'teacher' | 'student' | 'school_admin';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) school_id?: number;
}

class ImportQuery extends SchoolScope {
  @IsOptional() @IsIn(['true', 'false']) commit?: 'true' | 'false';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) year_id?: number;
}

class ClassQuery extends Page {
  @IsOptional() @Type(() => Number) @IsIn([1,2]) semester?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) school_id?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) year_id?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(6) @Max(9) grade?: number;
  @IsOptional() @IsString() @MaxLength(40) q?: string;
  @IsOptional() @IsIn(['true', 'false']) active?: 'true' | 'false';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) teacher_id?: number;
}

class ClassDto {
  @IsOptional() @Type(() => Number) @IsIn([1,2]) semester?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) school_id?: number | null;
  @Type(() => Number) @IsInt() @Min(1) year_id: number;
  @Type(() => Number) @IsInt() @Min(6) @Max(9) grade: number;
  @Transform(squash) @IsString() @Length(2, 40) name: string;
  @IsOptional() @IsArray() @ArrayMaxSize(1) @IsInt({ each: true }) teacher_ids?: number[];
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) expected_size?: number | null;
  @IsOptional() @IsString() @MaxLength(300) description?: string | null;
}

class UpdateClassDto {
  @IsOptional() @Type(() => Number) @IsIn([1,2]) semester?: number;
  @IsOptional() @IsBoolean() confirm_reassignment?: boolean;
  @IsOptional() @Transform(squash) @IsString() @Length(2, 40) name?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(6) @Max(9) grade?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) expected_size?: number | null;
  @IsOptional() @IsString() @MaxLength(300) description?: string | null;
  @IsOptional() @IsBoolean() join_open?: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(1) @IsInt({ each: true }) teacher_ids?: number[];
}

class ArchiveDto {
  @IsBoolean() archived: boolean;
}
class TeacherChangeDecisionDto {
  @IsIn(['approved','rejected']) decision:'approved'|'rejected';
  @IsOptional() @IsString() @MaxLength(1000) note?:string;
}

class MembersDto {
  @IsArray() @ArrayMaxSize(500) @IsInt({ each: true }) student_ids: number[];
}

class TransferDto {
  @Type(() => Number) @IsInt() @Min(1) student_id: number;
  @Type(() => Number) @IsInt() @Min(1) from_class_id: number;
  @Type(() => Number) @IsInt() @Min(1) to_class_id: number;
}

class CloneDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) school_id?: number | null;
  @Type(() => Number) @IsInt() @Min(1) from_year_id: number;
  @Type(() => Number) @IsInt() @Min(1) to_year_id: number;
  @IsOptional() @IsArray() @ArrayMaxSize(200) @IsInt({ each: true }) class_ids?: number[];
  @IsOptional() @IsBoolean() promote?: boolean;
  @IsOptional() @IsBoolean() copy_teachers?: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(5000) @IsInt({ each: true }) student_ids?: number[];
}

class SecurityQuery extends Page {
  @IsOptional() @IsString() @MaxLength(80) q?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) school_id?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) user_id?: number;
  @IsOptional() @IsIn(['true', 'false']) success?: 'true' | 'false';
}

const download = (buffer: Buffer, name: string) => new StreamableFile(buffer, { type: XLSX_MIME, disposition: `attachment; filename="${name}"` });

/**
 * /api/admin – hai cấp quản trị độc lập: quản trị tổng (toàn hệ thống) và quản trị trường (chỉ trường ghi trong token; truy vấn chạy dưới
 * Row-Level Security của trường). Mỗi route ghi rõ HK.* tương ứng; kiểm tra quyền chi tiết nằm trong các dịch vụ.
 */
@Controller('admin')
@UseGuards(AuthGuard)
@Roles('root_admin', 'school_admin')
export class AdminController {
  constructor(
    private readonly schools: SchoolService,
    private readonly accounts: AccountService,
    private readonly classes: ClassService,
    private readonly security: SecurityService,
    private readonly mail: MailService,
  ) {}

  // ------------------------------------------------------------------ trường học (HK.AD.011–017)
  @Get('schools')
  @Roles('root_admin')
  listSchools(@Query() query: SchoolQuery) { return this.schools.list(query); }

  @Get('school-code-preview')
  @Roles('root_admin')
  @Header('Cache-Control', 'no-store')
  schoolCodePreview(@CurrentUser() user: UserRow) { return this.schools.codePreview(user); }

  /** Gợi ý trường từ danh mục khi thêm trường: chọn một trường thì mã, khu vực, tỉnh/thành và đường dẫn tự điền */
  @Get('school-directory')
  @Roles('root_admin')
  async schoolDirectory(@Query() query: DirectoryQuery) { return this.schools.directory(query.q ?? '', query.limit ?? 30, query.exclude_school_id); }

  @Post('schools')
  @Roles('root_admin')
  createSchool(@CurrentUser() user: UserRow, @Body() body: CreateSchoolDto) { return this.schools.create(user, body); }

  @Get('schools/:id')
  schoolDetail(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.schools.detail(user, id); }

  @Patch('schools/:id')
  @Roles('root_admin')
  updateSchool(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateSchoolDto) { return this.schools.update(id, body); }

  @Delete('schools/:id')
  @Roles('root_admin')
  @HttpCode(204)
  async removeSchool(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) {
    const gone = await this.schools.remove(user, id);
    // Sau khi xóa, mã số trong nhật ký không còn trỏ tới đâu: ghi thêm tên trường và số dữ liệu đã xóa để truy vết
    await this.security.audit(user, `Xóa trường “${gone.name}” (mã ${gone.school_code}) kèm ${gone.admins + gone.teachers + gone.students} tài khoản, ${gone.classes} lớp, ${gone.years} năm học`, 'school', String(id), null, true);
  }

  // ------------------------------------------------------------------ thông tin trường của quản trị trường (HK.QT.010–011)
  @Get('school')
  mySchool(@CurrentUser() user: UserRow, @Query() query: SchoolScope) { return this.schools.detail(user, this.schools.target(user, query.school_id)); }

  @Patch('school')
  updateMySchool(@CurrentUser() user: UserRow, @Query() query: SchoolScope, @Body() body: UpdateMySchoolDto) { return this.schools.updateMine(user, query.school_id, body); }

  // ------------------------------------------------------------------ năm học và khối lớp (HK.QT.012–013)
  @Get('school-year-options')
  yearOptions() { return this.schools.yearOptions(); }

  @Get('school-years')
  years(@CurrentUser() user: UserRow, @Query() query: SchoolScope) { return this.schools.years(user, query.school_id); }

  @Post('school-years')
  createYear(@CurrentUser() user: UserRow, @Body() body: YearDto) { return this.schools.createYear(user, body); }

  @Patch('school-years/:id')
  updateYear(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: UpdateYearDto) { return this.schools.updateYear(user, id, body); }

  @Post('school-years/:id/activate')
  @HttpCode(200)
  activateYear(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.schools.activateYear(user, id); }

  @Post('school-years/:id/end')
  @HttpCode(200)
  endYear(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.schools.endYear(user, id); }

  @Get('school-grades')
  grades(@CurrentUser() user: UserRow, @Query() query: YearQuery) { return this.schools.grades(user, query.year_id, query.school_id); }

  @Put('school-grades')
  setGrade(@CurrentUser() user: UserRow, @Body() body: GradeDto) { return this.schools.setGrade(user, body); }

  @Delete('school-grades')
  @HttpCode(204)
  async removeGrade(@CurrentUser() user: UserRow, @Query() query: GradeDeleteQuery) { await this.schools.removeGrade(user, query.year_id, query.grade); }

  // ------------------------------------------------------------------ người dùng toàn hệ thống (HK.AD.018–025); quản trị trường chỉ thấy giáo viên/học sinh của trường
  @Get('users')
  users(@CurrentUser() user: UserRow, @Query() query: UserQuery) { return this.accounts.list(user, query); }

  @Post('users')
  @Roles('root_admin')
  createAdmin(@CurrentUser() user: UserRow, @Body() body: CreateAdminDto) { return this.accounts.createAdmin(user, body); }

  @Get('users/:id')
  userDetail(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.accounts.detail(user, id); }

  @Patch('users/:id')
  updateUser(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: UpdateUserDto) { return this.accounts.update(user, id, body); }

  @Patch('users/:id/role')
  @Roles('root_admin')
  changeRole(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: RoleDto) { return this.accounts.changeRole(user, id, body.role, body.school_id, body.admin_level); }

  @Post('users/:id/lock')
  @HttpCode(200)
  lock(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: LockDto) { return this.accounts.setLocked(user, id, body.locked, body.reason); }

  @Post('users/:id/reset-password')
  @HttpCode(200)
  resetPassword(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.accounts.resetPassword(user, id); }

  /** Danh sách mật khẩu: mật khẩu ban đầu / cấp lại của tài khoản chưa tự đổi (quản trị trường: trường mình; quản trị tổng: mọi trường) */
  @Get('passwords')
  @Header('Cache-Control', 'no-store')
  passwordList(@CurrentUser() user: UserRow, @Query() query: PasswordQuery) { return this.accounts.passwordList(user, query); }

  /** Cấp lại mật khẩu theo quy ước và gửi email */
  @Post('users/:id/reissue-password')
  @HttpCode(200)
  reissuePassword(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.accounts.reissuePassword(user, id); }

  @Delete('users/:id')
  @HttpCode(204)
  async removeUser(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { await this.accounts.remove(user, id); }

  // ------------------------------------------------------------------ giáo viên (HK.QT.014–023) và học sinh (HK.QT.024–034) của trường
  @Get('teachers')
  teachers(@CurrentUser() user: UserRow, @Query() query: UserQuery) { return this.accounts.list(user, query, 'teacher'); }

  @Post('teachers')
  createTeacher(@CurrentUser() user: UserRow, @Body() body: CreateMemberDto) { return this.accounts.createMember(user, 'teacher', body); }

  @Get('teachers/template')
  @Header('Cache-Control','no-store')
  async teacherTemplate(@CurrentUser() user: UserRow, @Query() query: SchoolScope) {
    const spec=await this.accounts.teacherImportSpec(user,query.school_id);
    return download(await withCalendarAddin(await this.accounts.teacherTemplate(user,query.school_id)),spec.filename);
  }

  @Get('teachers/import-spec')
  @Header('Cache-Control','no-store')
  teacherImportSpec(@CurrentUser() user:UserRow,@Query() query:SchoolScope){return this.accounts.teacherImportSpec(user,query.school_id);}

  @Get('teachers/export')
  async exportTeachers(@CurrentUser() user: UserRow, @Query() query: UserQuery) { return download(await this.accounts.exportMembers(user, 'teacher', query), 'danh-sach-giao-vien.xlsx'); }

  @Post('teachers/import')
  @HttpCode(200)
  @UseInterceptors(XLSX_UPLOAD)
  importTeachers(@CurrentUser() user: UserRow, @Query() query: ImportQuery, @UploadedFile() file: UploadedXlsx | undefined) {
    return this.accounts.importMembers(user, 'teacher', file, { commit: query.commit === 'true', school_id: query.school_id });
  }

  @Get('students')
  students(@CurrentUser() user: UserRow, @Query() query: UserQuery) { return this.accounts.list(user, query, 'student'); }

  @Post('students')
  createStudent(@CurrentUser() user: UserRow, @Body() body: CreateMemberDto) { return this.accounts.createMember(user, 'student', body); }

  @Get('students/template')
  @Header('Cache-Control','no-store')
  async studentTemplate(@CurrentUser() user:UserRow,@Query() query:SchoolScope){
    const spec=await this.accounts.studentImportSpec(user,query.school_id);
    return download(await withCalendarAddin(await this.accounts.studentTemplate(user,query.school_id)),spec.filename);
  }
  @Get('students/import-spec')
  @Header('Cache-Control','no-store')
  studentImportSpec(@CurrentUser() user:UserRow,@Query() query:SchoolScope){return this.accounts.studentImportSpec(user,query.school_id);}

  @Get('students/export')
  async exportStudents(@CurrentUser() user: UserRow, @Query() query: UserQuery) { return download(await this.accounts.exportMembers(user, 'student', query), 'danh-sach-hoc-sinh.xlsx'); }

  @Post('students/import')
  @HttpCode(200)
  @UseInterceptors(XLSX_UPLOAD)
  importStudents(@CurrentUser() user: UserRow, @Query() query: ImportQuery, @UploadedFile() file: UploadedXlsx | undefined) {
    return this.accounts.importMembers(user, 'student', file, { commit: query.commit === 'true', school_id: query.school_id, year_id: query.year_id });
  }

  // ------------------------------------------------------------------ lớp học (HK.QT.022, HK.QT.035–040)
  @Get('classes')
  classList(@CurrentUser() user: UserRow, @Query() query: ClassQuery) { return this.classes.list(user, query); }

  @Get('teacher-change-requests')
  teacherChangeRequests(@CurrentUser() user:UserRow){return this.classes.teacherChangeRequests(user);}

  @Post('teacher-change-requests/:id/decision')
  @HttpCode(200)
  teacherChangeDecision(@CurrentUser() user:UserRow,@Param('id',ParseIntPipe) id:number,@Body() body:TeacherChangeDecisionDto){return this.classes.decideTeacherChange(user,id,body.decision,body.note);}

  /** Xem trước mã giáo viên/học sinh theo ngày sinh (cùng công thức với mẫu Excel) cho biểu mẫu thêm từng người */

  @Get('registration-code/:kind')
  @Header('Cache-Control', 'no-store')
  registrationCode(@CurrentUser() user: UserRow, @Param('kind') kind: string,
    @Query('birth_date') birth_date?:string,@Query('school_id') school_id?:string,@Query('user_id') user_id?:string) {
    for(const n of [school_id,user_id]) if(n!==undefined && !/^[1-9]\d{0,8}$/.test(n)) throw new BadRequestException('Mã định danh không hợp lệ');
    return this.accounts.codePreview(user,kind,{birth_date,school_id:school_id?Number(school_id):undefined,user_id:user_id?Number(user_id):undefined});
  }

  @Post('classes')
  createClass(@CurrentUser() user: UserRow, @Body() body: ClassDto) { return this.classes.create(user, body); }

  @Post('classes/transfer')
  @HttpCode(200)
  transfer(@CurrentUser() user: UserRow, @Body() body: TransferDto) { return this.classes.transfer(user, body.student_id, body.from_class_id, body.to_class_id); }

  @Post('classes/clone')
  @HttpCode(200)
  clone(@CurrentUser() user: UserRow, @Body() body: CloneDto) { return this.classes.clone(user, body); }

  /** File mẫu xếp lớp của trường và năm học (mặc định năm học đang hoạt động), cùng bố cục với mẫu giáo viên/học sinh */
  @Get('classes/template')
  @Header('Cache-Control','no-store')
  async classTemplate(@CurrentUser() user: UserRow, @Query() query: AssignQuery) {
    const file = await this.classes.template(user, query.school_id, query.year_id);
    return download(await withCalendarAddin(file.buffer), file.filename);
  }

  /** Xuất danh sách lớp: cả năm học (mỗi lớp một sheet + sheet tổng hợp) hoặc một lớp (class_id) */
  @Get('classes/export')
  @Header('Cache-Control','no-store')
  async classExport(@CurrentUser() user: UserRow, @Query() query: RosterQuery) {
    const file = await this.classes.exportRoster(user, query.school_id, query.year_id, query.class_id);
    return download(file.buffer, file.filename);
  }

  @Get('classes/import-spec')
  @Header('Cache-Control','no-store')
  classImportSpec(@CurrentUser() user: UserRow, @Query() query: AssignQuery) { return this.classes.assignSpec(user, query.school_id, query.year_id); }

  @Post('classes/import')
  @HttpCode(200)
  @UseInterceptors(XLSX_UPLOAD)
  importAssignments(@CurrentUser() user: UserRow, @Query() query: ImportQuery, @UploadedFile() file: UploadedXlsx | undefined) {
    return this.classes.importAssignments(user, file, { commit: query.commit === 'true', school_id: query.school_id, year_id: query.year_id as number });
  }

  @Get('classes/:id')
  classDetail(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number,@Query() query: ClassQuery) { return this.classes.detail(user, id,query.semester); }

  @Get('classes/:id/events')
  classEvents(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.classes.events(user, id); }

  @Patch('classes/:id')
  updateClass(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: UpdateClassDto) { return this.classes.update(user, id, body); }

  @Post('classes/:id/archive')
  @HttpCode(200)
  archiveClass(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: ArchiveDto) { return this.classes.archive(user, id, body.archived); }

  @Post('classes/:id/regenerate-code')
  @HttpCode(200)
  regenerateCode(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { return this.classes.regenerateCode(user, id); }

  @Post('classes/:id/members')
  @HttpCode(200)
  addMembers(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Body() body: MembersDto) { return this.classes.addMembers(user, id, body.student_ids); }

  @Delete('classes/:id/members/:userId')
  @HttpCode(204)
  async removeMember(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number, @Param('userId', ParseIntPipe) userId: number) { await this.classes.removeMember(user, id, userId); }

  @Delete('classes/:id')
  @HttpCode(204)
  async removeClass(@CurrentUser() user: UserRow, @Param('id', ParseIntPipe) id: number) { await this.classes.remove(user, id); }

  // ------------------------------------------------------------------ nhật ký (xem sau ở Sprint 11; giữ API đã có)
  @Get('login-history')
  loginHistory(@CurrentUser() user: UserRow, @Query() query: SecurityQuery) { return this.security.events(user, 'login', query); }

  @Get('audit-history')
  auditHistory(@CurrentUser() user: UserRow, @Query() query: SecurityQuery) { return this.security.events(user, 'audit', query); }

  @Post('mail/test')
  @Roles('root_admin')
  @HttpCode(200)
  testMail() { return this.mail.sendTest(); }
}
