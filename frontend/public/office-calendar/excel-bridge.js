/* No workbook data leaves Excel. This module has no HTTP, storage, or analytics calls. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./calendar-core.js'));else root.DongAExcelBridge=factory(root.DongACalendar);})(typeof globalThis!=='undefined'?globalThis:this,function(C){
  'use strict';
  function create(Excel,notify){
    let queue=Promise.resolve(),ownWrite=null;
    const enqueue=fn=>{const next=queue.then(fn);queue=next.catch(()=>{});return next;};
    async function inspect(ctx,sheet,row){
      const header=sheet.getRange('A11:G11'),data=sheet.getRange(`A${row}:G${row}`),codes=sheet.getRange(`A${row}:B${row}`);
      header.load('values');data.load('values');codes.load('formulas');await ctx.sync();
      const kind=C.templateKind(header.values[0]);
      if(!kind||!codes.formulas[0].every(x=>typeof x==='string'&&x.startsWith('=')))throw Error('Hãy mở đúng file mẫu giáo viên hoặc học sinh Đông A mới tải.');
      return {kind,data};
    }
    async function selection(){return Excel.run(async ctx=>{
      const sheet=ctx.workbook.worksheets.getActiveWorksheet(),selected=ctx.workbook.getSelectedRange();sheet.load('id');selected.load('address');await ctx.sync();
      const t=C.target(selected.address);if(!t)throw Error('Chọn một ô trong dòng nhập, từ Họ tên đến Ngày sinh (cột C–G).');
      const {kind,data}=await inspect(ctx,sheet,t.row);return {...t,kind,birth:data.values[0][6],sheetId:sheet.id};
    });}
    async function afterChange(event){
      const t=C.changedBirthday(event.address);if(!t||event.source==='Remote'||event.changeType!=='RangeEdited')return;
      return Excel.run(async ctx=>{
        const sheet=ctx.workbook.worksheets.getActiveWorksheet(),selected=ctx.workbook.getSelectedRange();sheet.load('id');selected.load('address');await ctx.sync();
        if(sheet.id!==event.worksheetId)return;
        const at=C.target(selected.address);if(!at||(at.row!==t.row&&!(at.cell===`G${t.row+1}`)))return;
        const {kind,data}=await inspect(ctx,sheet,t.row);
        if(ownWrite&&ownWrite.sheet===sheet.id&&ownWrite.row===t.row&&ownWrite.value===data.values[0][6]){ownWrite=null;return;}
        if(!C.complete(data.values[0],kind))return;
        const current=ctx.workbook.getSelectedRange(),currentSheet=ctx.workbook.worksheets.getActiveWorksheet();current.load('address');currentSheet.load('id');await ctx.sync();
        const latest=C.target(current.address);if(currentSheet.id!==event.worksheetId||!latest||(latest.row!==t.row&&latest.cell!==`G${t.row+1}`))return;
        ctx.workbook.application.calculate('Recalculate');
        if(t.row<C.LAST_ROW)sheet.getRange(`C${t.row+1}`).select();
        await ctx.sync();notify({message:t.row<C.LAST_ROW?`Đã hoàn tất dòng ${t.row}. Tiếp tục tại C${t.row+1}.`:'Đã hoàn tất dòng cuối của mẫu.',success:true});
      });
    }
    return {
      selection:()=>enqueue(selection),
      writeDate(value,expected){return enqueue(()=>Excel.run(async ctx=>{
        if(!C.valid(value))throw Error('Chọn ngày sinh từ 01/01/1940 đến hôm nay.');
        const sheet=ctx.workbook.worksheets.getActiveWorksheet(),selected=ctx.workbook.getSelectedRange();sheet.load('id');selected.load('address');await ctx.sync();
        const t=C.target(selected.address);if(!t||!expected||t.row!==expected.row||sheet.id!==expected.sheetId)throw Error('Ô đang chọn đã đổi. Chọn lại dòng cần nhập ngày sinh.');
        const {kind,data}=await inspect(ctx,sheet,t.row),number=C.serial(value),cell=sheet.getRange(t.cell);
        const current=ctx.workbook.getSelectedRange(),currentSheet=ctx.workbook.worksheets.getActiveWorksheet();current.load('address');currentSheet.load('id');await ctx.sync();
        if(currentSheet.id!==expected.sheetId||C.target(current.address)?.row!==t.row)throw Error('Ô đang chọn đã đổi. Chọn lại dòng cần nhập ngày sinh.');
        ownWrite={sheet:sheet.id,row:t.row,value:number};cell.values=[[number]];cell.numberFormat=[['dd/mm/yyyy']];
        const values=[...data.values[0]];values[6]=number;const done=C.complete(values,kind);
        ctx.workbook.application.calculate('Recalculate');
        if(done&&t.row<C.LAST_ROW)sheet.getRange(`C${t.row+1}`).select();else cell.select();
        await ctx.sync();return {done,row:t.row,next:done&&t.row<C.LAST_ROW?`C${t.row+1}`:null};
      }));},
      start(){return enqueue(()=>Excel.run(async ctx=>{
        const sheets=ctx.workbook.worksheets;sheets.load('items/id');await ctx.sync();
        for(const sheet of sheets.items){sheet.onSelectionChanged.add(()=>notify({selectionChanged:true}));sheet.onChanged.add(event=>enqueue(()=>afterChange(event)).catch(error=>notify({error:error.message})));}
        sheets.onActivated.add(()=>notify({selectionChanged:true}));await ctx.sync();
      }));}
    };
  }
  return {create};
});
