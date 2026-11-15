import React, { useState } from 'react';
import { View } from 'react-native';
import * as api from '@/api/adminApi';
import type { Session } from '@/components/auth';
import type { YearItem } from '@/types/api';
import { AdminSelect } from './AdminSelect';
import { Btn, Sheet, Spinner } from '@/components/ui';
import { ErrorNote, ImportSheet, useLoad } from './kit';

export const TeacherImportSheet: React.FC<{
  session: Session; onClose: () => void; onDone: () => void;
  kind?: 'teachers' | 'students'; years: YearItem[]; initialYearId: number; initialSemester: number;
}> = ({ session, onClose, onDone, kind = 'teachers', years, initialYearId, initialSemester }) => {
  const { token } = session;
  const student = kind === 'students';
  const title = student ? 'Nhập danh sách học sinh' : 'Nhập danh sách giáo viên';
  const availableYears = years.filter((y) => y.status !== 'ended');
  const [yearId, setYearId] = useState(initialYearId || availableYears[0]?.id || 0);
  const [semester, setSemester] = useState(initialSemester === 2 ? 2 : 1);
  const { data: spec, error, reload } = useLoad(() => student ? api.studentImportSpec(token) : api.teacherImportSpec(token), [token, kind], session.expired);
  if (!spec) return <Sheet open title={title} onClose={onClose}>{error ? <><ErrorNote message={error}/><Btn title="Thử lại" onPress={reload}/></> : <Spinner label="Đang tải file mẫu của trường…"/>}</Sheet>;
  return <ImportSheet key={`${yearId}-${semester}`} title={title} hint="Tải file mẫu, điền danh sách rồi chọn file để nhập." acceptMacro
    note={`Phải đúng file mẫu ${student ? 'học sinh' : 'giáo viên'} của ${spec.school_name}. File của trường khác hoặc nhầm loại sẽ báo lỗi.`}
    extra={<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
      <View style={{ width: 220 }}><AdminSelect label="Năm học nhập danh sách" value={String(yearId)} options={availableYears.map((y) => ({ value: String(y.id), label: y.label }))} onChange={(v) => setYearId(Number(v))} testID="import-year" /></View>
      <View style={{ width: 160 }}><AdminSelect label="Học kỳ nhập danh sách" value={String(semester)} options={[{ value: '1', label: 'Học kỳ 1' }, { value: '2', label: 'Học kỳ 2' }]} onChange={(v) => setSemester(Number(v))} testID="import-semester" /></View>
    </View>}
    expectedFilename={spec.filename} legacyFilename={spec.legacy_filename} template={{ filename: spec.filename, fetchBlob: () => api.downloadFile(token, `/api/admin/${kind}/template`) }}
    run={(file, commit) => api.importMembers(token, kind, file, { commit, year_id: yearId || undefined, semester: yearId ? semester : undefined })} onClose={onClose} onDone={onDone}/>;
};
