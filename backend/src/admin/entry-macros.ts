/** Attach only the reviewed, checked-in VBA calendar. Uploaded macros are never executed. */
import { readFileSync } from 'fs';
import { join } from 'path';
import JSZip = require('jszip');

export const XLSM_MIME = 'application/vnd.ms-excel.sheet.macroEnabled.12';
const xml = (value:string) => value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');

export async function withEntryMacros(buffer:Buffer,kind:'teachers'|'students',prefix:string,offset:number):Promise<Buffer>{
  if(!/^[A-Z0-9]{2,24}$/.test(prefix)||!Number.isSafeInteger(offset)||offset<0)throw Error('Invalid workbook identity');
  const zip=await JSZip.loadAsync(buffer);
  const read=async(path:string)=>{const part=zip.file(path);if(!part)throw Error(`Missing workbook part ${path}`);return part.async('string');};
  let types=await read('[Content_Types].xml');
  types=types.replace('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml','application/vnd.ms-excel.sheet.macroEnabled.main+xml');
  types=types.replace('</Types>','<Override PartName="/xl/vbaProject.bin" ContentType="application/vnd.ms-office.vbaProject"/></Types>');
  zip.file('[Content_Types].xml',types);
  let rels=await read('xl/_rels/workbook.xml.rels');
  rels=rels.replace('</Relationships>','<Relationship Id="rIdDongAVba" Type="http://schemas.microsoft.com/office/2006/relationships/vbaProject" Target="vbaProject.bin"/></Relationships>');
  zip.file('xl/_rels/workbook.xml.rels',rels);
  let book=await read('xl/workbook.xml');
  if(/<workbookPr\b/.test(book))book=book.replace(/<workbookPr\b/,'<workbookPr codeName="ThisWorkbook"');
  else book=book.replace(/<sheets\b/,'<workbookPr codeName="ThisWorkbook"/><sheets');
  // ExcelJS enables document-inspector privacy filtering by default. A VBA project
  // cannot be stripped that way; Excel otherwise shows an unavoidable Save prompt.
  book=book.replace(/\sfilterPrivacy="1"/,' filterPrivacy="0"');
  const names=`<definedName name="DongAPrefix">${xml('"'+prefix+'"')}</definedName><definedName name="DongAOffset">${offset}</definedName><definedName name="DongAMinYear">${kind==='students'?2000:1940}</definedName><definedName name="DongARequireEmail">${kind==='teachers'?'TRUE':'FALSE'}</definedName>`;
  book=book.includes('</definedNames>')?book.replace('</definedNames>',names+'</definedNames>'):book.includes('<calcPr')?book.replace('<calcPr','<definedNames>'+names+'</definedNames><calcPr'):book.replace('</workbook>','<definedNames>'+names+'</definedNames></workbook>');
  zip.file('xl/workbook.xml',book);
  let sheet=await read('xl/worksheets/sheet1.xml');
  if(/<sheetPr\b/.test(sheet))sheet=sheet.replace(/<sheetPr\b/,'<sheetPr codeName="Sheet1"');
  else sheet=sheet.replace(/(<worksheet\b[^>]*>)/,'$1<sheetPr codeName="Sheet1"/>');
  // Macro confirms rows on Enter. Neither numbers nor formula outputs appear beforehand.
  sheet=sheet.replace(/<c\b([^>]*\br="([AB])(\d+)"[^>]*)>[\s\S]*?<\/c>/g,(all,attrs,_col,row)=>Number(row)>=12?`<c${attrs.replace(/\s+t="[^"]*"/g,'')}/>`:all);
  zip.file('xl/worksheets/sheet1.xml',sheet);
  zip.file('xl/vbaProject.bin',readFileSync(join(__dirname,'../..','assets/excel-entry/vbaProject.bin')));
  return zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
}
