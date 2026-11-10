import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
// Small deterministic ZIP (stored entries). No build dependency on the backend.
export function calendarPackage(root) {
  const names=['manifest.xml','Install-DongACalendar.ps1','HUONG-DAN.txt'];
  const chunks=[],central=[];let offset=0;
  const crc32=b=>{let crc=0xffffffff;for(const v of b){crc^=v;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^0xffffffff)>>>0;};
  for(const filename of names){const name=Buffer.from(filename),data=readFileSync(join(root,filename)),crc=crc32(data),header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(0x800,6);header.writeUInt16LE(33,12);header.writeUInt32LE(crc,14);header.writeUInt32LE(data.length,18);header.writeUInt32LE(data.length,22);header.writeUInt16LE(name.length,26);chunks.push(header,name,data);
    const record=Buffer.alloc(46);record.writeUInt32LE(0x02014b50);record.writeUInt16LE(20,4);record.writeUInt16LE(20,6);record.writeUInt16LE(0x800,8);record.writeUInt16LE(33,14);record.writeUInt32LE(crc,16);record.writeUInt32LE(data.length,20);record.writeUInt32LE(data.length,24);record.writeUInt16LE(name.length,28);record.writeUInt32LE(offset,42);central.push(record,name);offset+=header.length+name.length+data.length;
  }
  const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(names.length,8);end.writeUInt16LE(names.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...chunks,directory,end]);
}
export function writeCalendarPackage(root){writeFileSync(join(root,'dong-a-calendar.zip'),calendarPackage(root));}
