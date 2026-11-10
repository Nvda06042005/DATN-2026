import { buildFormSheet } from '../src/admin/excel';
import { CALENDAR_STORE_ID, withCalendarAddin } from '../src/admin/calendar-addin';
import JSZip from 'jszip';
import * as ExcelJS from 'exceljs';

describe('Lịch Office Store trong mẫu .xlsx không macro', () => {
  const make = (logo?: null) => buildFormSheet({ sheetName:'Học sinh',title:'Đông A',subtitle:'Fixture',meta:[],logo,blankRows:3,
    columns:[{key:'stt',header:'STT',kind:'index',watch:'full_name',autoIndex:true},{key:'full_name',header:'Họ tên',kind:'text'},{key:'birth_date',header:'Ngày sinh',kind:'date'}] });
  test.each([true,false])('giữ logo=%s, dữ liệu/công thức; lịch tham chiếu đúng tiện ích chính thức, không kèm mã thực thi', async logo => {
    const original = await make(logo ? undefined : null), source = await JSZip.loadAsync(original);
    const output = await withCalendarAddin(original), zip = await JSZip.loadAsync(output);
    const app = await zip.file('xl/webextensions/dongaCalendar.xml')!.async('string');
    expect(app).toContain(`id="${CALENDAR_STORE_ID}" version="1.0" store="en-US" storeType="OMEX"`);
    expect(app).not.toMatch(/token|trust|autoopen|<script|https?:\/\/(?!schemas\.)/i);
    expect(Object.keys(zip.files).some(n => /vba|activeX|\.js$|\.html$/i.test(n))).toBe(false);
    expect(await zip.file('[Content_Types].xml')!.async('string')).not.toContain('macroEnabled');
    for (const name of ['xl/styles.xml','xl/sharedStrings.xml']) expect(await zip.file(name)!.async('string')).toBe(await source.file(name)!.async('string'));
    const drawingName = logo ? 'xl/drawings/drawing1.xml' : 'xl/drawings/dongaCalendar.xml';
    const drawing = await zip.file(drawingName)!.async('string');
    expect(drawing).toContain('Mini Calendar and Date Picker');expect(drawing).toContain('<xdr:col>7</xdr:col>');
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(output as any);
    expect(wb.worksheets[0].getImages()).toHaveLength(logo ? 1 : 0);
    expect(wb.worksheets[0].getCell('A5').formula).toContain('COUNTIFS(');
    expect(wb.worksheets[0].getCell('C5').numFmt).toBe('dd/mm/yyyy');
    expect(await withCalendarAddin(output)).toBe(output);
  });
  test('mỗi file có ID phiên bản tiện ích riêng, không chia sẻ trạng thái người dùng',async()=>{
    const input=await make(null),outputs=await Promise.all([withCalendarAddin(input),withCalendarAddin(input)]);
    const apps=await Promise.all(outputs.map(async file=>(await JSZip.loadAsync(file)).file('xl/webextensions/dongaCalendar.xml')!.async('string')));
    expect(apps[0]).not.toBe(apps[1]);
  });
});
