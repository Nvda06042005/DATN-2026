import { randomUUID } from 'crypto';
import { posix } from 'path';
import JSZip from 'jszip';

/** First-party content add-in approved on 10/11/2026. Installation is explicit,
 * once per Windows user. Workbook references follow Microsoft's Content Add-in
 * sideload template; no VBA, trust flags, tokens, or executable code in .xlsx.
 * See docs/LICH_EXCEL.md and the install package under frontend/public.
 */
export const CALENDAR_ADDIN_ID = 'bc75b058-92b8-4dd1-84fb-8792db3f7e72';
const WE = 'http://schemas.microsoft.com/office/webextensions/webextension/2010/11';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PKG = 'http://schemas.openxmlformats.org/package/2006/relationships';
const PART = 'xl/webextensions/dongaCalendar.xml';
const RID = 'rIdDongACalendar';
const emptyRelationships = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${PKG}"></Relationships>`;

export async function withCalendarAddin(buffer: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buffer);
  if (zip.file(PART)) return buffer;
  const read = async (name: string) => {
    const entry = zip.file(name);
    if (!entry) throw new Error(`Missing workbook part ${name}`);
    return entry.async('string');
  };
  const sheetPath = 'xl/worksheets/sheet1.xml', sheetRelsPath = 'xl/worksheets/_rels/sheet1.xml.rels';
  let sheet = await read(sheetPath);
  let sheetRels = zip.file(sheetRelsPath) ? await read(sheetRelsPath) : emptyRelationships;
  const existingDrawingId = /<drawing\b[^>]*\br:id="([^"]+)"/.exec(sheet)?.[1];
  let drawingPath = 'xl/drawings/dongaCalendar.xml';
  if (existingDrawingId) {
    const relationship = [...sheetRels.matchAll(/<Relationship\b([^>]+)\/?\s*>/g)].find(m => /\bId="([^"]+)"/.exec(m[1])?.[1] === existingDrawingId);
    const target = relationship && /\bTarget="([^"]+)"/.exec(relationship[1])?.[1];
    if (!target) throw new Error('Missing worksheet drawing relationship');
    drawingPath = posix.normalize(posix.join('xl/worksheets', target));
    if (!/^xl\/drawings\/[^/]+\.xml$/.test(drawingPath)) throw new Error('Unexpected worksheet drawing target');
  } else {
    sheetRels = sheetRels.replace('</Relationships>', `<Relationship Id="${RID}" Type="${REL}/drawing" Target="../drawings/dongaCalendar.xml"/></Relationships>`);
    if (!sheet.includes('xmlns:r=')) sheet = sheet.replace('<worksheet ', `<worksheet xmlns:r="${REL}" `);
    const drawing = `<drawing r:id="${RID}"/>`;
    const following = /<(?:legacyDrawing|legacyDrawingHF|picture|oleObjects|controls|webPublishItems|tableParts|extLst)\b/.exec(sheet);
    sheet = following ? sheet.slice(0, following.index) + drawing + sheet.slice(following.index) : sheet.replace('</worksheet>', drawing + '</worksheet>');
    zip.file(sheetPath, sheet);
    zip.file(sheetRelsPath, sheetRels);
  }
  let drawing = zip.file(drawingPath) ? await read(drawingPath) : '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"></xdr:wsDr>';
  const objectId = Math.max(0, ...[...drawing.matchAll(/<xdr:cNvPr\b[^>]*\bid="(\d+)"/g)].map(m => Number(m[1]))) + 1;
  // H1: next to the seven input columns, inside the frozen header area. It does
  // not cover birthday cells, alter the import headers, or move with selection.
  const anchor = `<xdr:oneCellAnchor><xdr:from><xdr:col>7</xdr:col><xdr:colOff>76200</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>76200</xdr:rowOff></xdr:from><xdr:ext cx="3429000" cy="5524500"/><mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><mc:Choice xmlns:we="${WE}" Requires="we"><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${objectId}" name="Lịch Đông A"/><xdr:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></xdr:cNvGraphicFramePr></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="${WE}"><we:webextensionref xmlns:r="${REL}" r:id="${RID}"/></a:graphicData></a:graphic></xdr:graphicFrame></mc:Choice><mc:Fallback/></mc:AlternateContent><xdr:clientData/></xdr:oneCellAnchor>`;
  // Readers without content-add-in support must still see a valid drawing.
  // A plain explanatory label is the fallback, never a fake calendar image.
  const fallback = `<mc:Fallback><xdr:sp><xdr:nvSpPr><xdr:cNvPr id="${objectId}" name="Lịch Đông A"/><xdr:cNvSpPr/></xdr:nvSpPr><xdr:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="FAF5E8"/></a:solidFill></xdr:spPr><xdr:txBody><a:bodyPr wrap="square"/><a:lstStyle/><a:p><a:r><a:rPr lang="vi-VN" sz="1200"/><a:t>Mở bằng Microsoft Excel. Cài tiện ích Lịch Đông A một lần từ mục Nhập từ Excel trên website, rồi mở lại mẫu mới.</a:t></a:r></a:p></xdr:txBody></xdr:sp></mc:Fallback>`;
  drawing = drawing.replace('</xdr:wsDr>', anchor.replace('<mc:Fallback/>', fallback) + '</xdr:wsDr>');
  zip.file(drawingPath, drawing);
  const drawingRelsPath = posix.join(posix.dirname(drawingPath), '_rels', posix.basename(drawingPath) + '.rels');
  let drawingRels = zip.file(drawingRelsPath) ? await read(drawingRelsPath) : emptyRelationships;
  drawingRels = drawingRels.replace('</Relationships>', `<Relationship Id="${RID}" Type="http://schemas.microsoft.com/office/2011/relationships/webextension" Target="../webextensions/dongaCalendar.xml"/></Relationships>`);
  zip.file(drawingRelsPath, drawingRels);
  zip.file(PART, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><we:webextension xmlns:we="${WE}" id="{${randomUUID().toUpperCase()}}"><we:reference id="${CALENDAR_ADDIN_ID}" version="1.0.0.0" store="developer" storeType="Registry"/><we:alternateReferences/><we:properties/><we:bindings/></we:webextension>`);
  let types = await read('[Content_Types].xml');
  if (!types.includes(`PartName="/${drawingPath}"`)) types = types.replace('</Types>', `<Override PartName="/${drawingPath}" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`);
  types = types.replace('</Types>', `<Override PartName="/${PART}" ContentType="application/vnd.ms-office.webextension+xml"/></Types>`);
  zip.file('[Content_Types].xml', types);
  return zip.generateAsync({type: 'nodebuffer', compression: 'DEFLATE'});
}
