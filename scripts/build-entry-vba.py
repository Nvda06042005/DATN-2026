"""Build reviewed, offline calendar VBA. Build-only dependency: pyOpenVBA==6.6.0.
No Excel registry/security setting is changed. Render embeds the checked-in binary.
"""
import argparse
from pathlib import Path
import tempfile
import zipfile
from pyopenvba import ExcelFile

root = Path(__file__).resolve().parents[1]
assets = root / 'backend/assets/excel-entry'
parser = argparse.ArgumentParser()
parser.add_argument('--out', default=str(assets / 'vbaProject.bin'))
args = parser.parse_args()
with tempfile.TemporaryDirectory(prefix='donga_vba_') as tmp:
    output = Path(tmp) / 'entry.xlsm'
    with ExcelFile.create_new(output) as wb:
        wb.set_module('Module1', (assets/'DongAEntry.bas').read_text())
        wb.set_module('ThisWorkbook', (assets/'ThisWorkbook.cls').read_text())
        form = wb.add_form('DongACalendar', caption='Chon ngay sinh', width=252, height=282)
        def add(kind, name, left, top, width, height, caption=None):
            control=form.add_control(kind,name,left=left,top=top,width=width,height=height)
            if caption is not None: control.set_property('Caption',caption)
            return control
        add('CommandButton','PreviousButton',8,8,26,24,'<')
        add('ComboBox','MonthBox',38,8,94,24)
        add('ComboBox','YearBox',138,8,68,24)
        add('CommandButton','NextButton',210,8,26,24,'>')
        for i,text in enumerate(['T2','T3','T4','T5','T6','T7','CN']):
            add('Label','Week'+str(i),9+i*33,40,31,18,text)
        for i in range(1,43):
            add('CommandButton','Day'+str(i),8+((i-1)%7)*33,58+((i-1)//7)*27,32,26,str(i))
        add('CommandButton','TodayButton',8,224,112,26,'Hom nay')
        add('CommandButton','CloseButton',124,224,112,26,'Dong')
        source=(assets/'DongACalendar.cls').read_text()
        for i in range(1,43):
            source+=f'\nPrivate Sub Day{i}_Click()\n    ChooseDay {i}\nEnd Sub\n'
        wb.set_module('DongACalendar',source)
        wb.save()
    with zipfile.ZipFile(output) as z:
        Path(args.out).write_bytes(z.read('xl/vbaProject.bin'))
print(args.out)
