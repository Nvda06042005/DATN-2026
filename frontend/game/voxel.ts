/** Original block art for explore scenes. Texture generation only; no movement, scoring or historical claims. */
import type Phaser from 'phaser';
import { TILE, type Look } from './pixel';
type Ctx = CanvasRenderingContext2D;
const rect = (c: Ctx, color: string, x: number,y: number,w: number,h: number) => { c.fillStyle=color; c.fillRect(x,y,w,h); };
const face = (c: Ctx, color: string, pts: number[]) => { c.fillStyle=color; c.beginPath(); c.moveTo(pts[0],pts[1]); for(let i=2;i<pts.length;i+=2)c.lineTo(pts[i],pts[i+1]); c.closePath(); c.fill(); };
function block(c: Ctx,x: number,y: number,w: number,h: number,d: number,front: string,side: string,top: string): void {
  rect(c,front,x,y,w,h);
  face(c,side,[x+w,y,x+w+d,y-d,x+w+d,y+h-d,x+w,y+h]);
  face(c,top,[x,y,x+d,y-d,x+w+d,y-d,x+w,y]);
}

export function makeVoxelChar(scene: Phaser.Scene,key: string,look: Look): void {
  if(scene.textures.exists(key)) return;
  const W=24,H=36;
  const texture=scene.textures.createCanvas(key,W*9,H)!;
  const c=texture.getContext(); c.imageSmoothingEnabled=false;
  for(let frame=0;frame<9;frame++) {
    const ox=frame*W,dir=Math.floor(frame/3),step=frame%3===1?1:frame%3===2?-1:0;
    c.save(); c.translate(ox,0);
    block(c,7,26+Math.max(0,step),4,9-Math.max(0,step),2,'#3b3941','#292a31','#56535a');
    block(c,14,26+Math.max(0,-step),4,9-Math.max(0,-step),2,'#4d4951','#323039','#635b62');
    block(c,6,17,13,12,3,look.robe,'#603b37',look.trim);
    rect(c,look.belt,6,26,13,2);
    block(c,2,18+step,4,11,2,look.robe,'#67483e',look.trim); rect(c,look.skin,2,27+step,4,3);
    block(c,19,18-step,3,11,1,look.robe,'#67483e',look.trim); rect(c,look.skin,19,27-step,3,3);
    block(c,5,6,13,12,4,dir===1?look.hair:look.skin,dir===1?look.hair:'#b78965',look.hair);
    rect(c,look.hair,5,6,13,3);
    if(dir!==1) { rect(c,'#272b2b',dir===2?14:8,11,2,2); if(dir===0)rect(c,'#272b2b',14,11,2,2); rect(c,'#a36653',11,15,3,1); }
    if(look.hat==='band'||look.hat==='scarf') { rect(c,look.hatColor,5,8,13,2); face(c,look.hatColor,[18,8,22,4,22,6,18,10]); }
    else if(look.hat==='helmet'||look.hat==='crown') { block(c,4,4,15,5,4,look.hatColor,'#9b7238','#e0bd6e'); rect(c,'#bc4b3d',11,0,3,5); }
    else if(look.hat==='non'||look.hat==='cap')block(c,2,5,19,3,3,look.hatColor,'#8f6b42','#e1cc8c');
    else rect(c,look.hair,10,2,5,4);
    if(look.beard&&dir!==1)rect(c,look.beard,8,16,8,3);
    c.restore();
  }
  for(let i=0;i<9;i++)texture.add(i,0,i*W,0,W,H);
  texture.refresh();
}

export function makeVoxelWorld(scene: Phaser.Scene): void {
  const names=['grass','flower','path','stone','sand','plank','water','water2','rice'];
  if(!scene.textures.exists('voxel-tiles')) {
    const tex=scene.textures.createCanvas('voxel-tiles',TILE*names.length,TILE)!;
    const c=tex.getContext();
    names.forEach((name,i)=>{
      const x=i*TILE,water=name.startsWith('water');
      const top=water?'#4798b1':name==='stone'?'#b3b4a3':name==='path'?'#c5a476':name==='sand'?'#d8c38b':name==='plank'?'#ae8b5d':'#7fa35e';
      rect(c,water?'#286b84':'#705a3c',x,0,16,16);rect(c,top,x,0,16,13);
      rect(c,water?'#64b3c3':name==='stone'?'#d1cdbc':'#a2bd76',x,0,16,1);
      rect(c,water?'#347b91':'#8f7047',x,13,16,1);rect(c,water?'#286b84':'#514a35',x+15,1,1,15);
      if(water){rect(c,'#8ac9ce',x+(name==='water'?2:7),5,6,1);rect(c,'#6eb8c9',x+3,10,4,1);}
      else if(name==='plank'){for(let y=3;y<13;y+=4)rect(c,'#705537',x,y,15,1);}
      else if(name==='rice'){for(let j=2;j<14;j+=4)rect(c,'#d4cf78',x+j,3,2,7);}
      else if(name==='flower'){rect(c,'#f7e1a2',x+4,4,2,2);rect(c,'#d4b5a1',x+11,8,2,2);}
      else {rect(c,'rgba(255,255,255,.08)',x+3,4,4,3);rect(c,'rgba(0,0,0,.05)',x+9,9,3,2);}
      tex.add(name,0,x,0,TILE,TILE);
    });tex.refresh();
  }
  const prop=(name: string,w: number,h: number,draw:(c:Ctx)=>void)=>{ const key=`vx_${name}`;if(scene.textures.exists(key))return;const t=scene.textures.createCanvas(key,w,h)!;t.getContext().imageSmoothingEnabled=false;draw(t.getContext());t.refresh(); };
  prop('tree',28,42,c=>{block(c,11,22,6,19,4,'#85633c','#59472f','#aa8754');block(c,2,10,22,19,4,'#48794e','#315b41','#81a464');block(c,6,4,15,15,4,'#629054','#3e6e49','#a1ba71');});
  prop('bamboo',22,39,c=>{for(const x of[3,10,16]){block(c,x,6,3,32,2,'#6b9653','#3f6441','#a0b46b');for(let y=12;y<38;y+=7)rect(c,'#3b6339',x,y,3,1);}block(c,0,4,10,5,2,'#75a45b','#486b44','#9cbb72');block(c,11,2,8,6,2,'#75a45b','#486b44','#9cbb72');});
  prop('house',30,39,c=>{block(c,4,18,20,20,5,'#c4ac7d','#8f7655','#e1c99b');block(c,0,12,25,8,5,'#9e704b','#704e37','#c79b65');block(c,5,7,16,7,4,'#9e704b','#704e37','#d2ae78');rect(c,'#504638',11,27,7,11);rect(c,'#e1c191',6,23,4,4);});
  prop('tent',27,32,c=>{block(c,4,12,18,19,4,'#c4b68e','#8c8062','#eee0b6');block(c,1,10,22,5,4,'#9c5140','#713c32','#cc8860');block(c,6,6,12,5,3,'#af6c49','#764531','#d89a67');rect(c,'#514433',10,20,7,11);});
  prop('rock',20,21,c=>{block(c,1,10,13,10,5,'#969a8c','#686f68','#b9bbab');block(c,4,6,9,7,4,'#a2a597','#6f776e','#c7c9b6');});
  prop('fence',20,25,c=>{block(c,1,6,4,18,2,'#947143','#634f33','#c29f66');block(c,13,6,4,18,2,'#947143','#634f33','#c29f66');block(c,0,10,17,3,2,'#ba915a','#735635','#d9b57b');block(c,0,18,17,3,2,'#ba915a','#735635','#d9b57b');});
  prop('hall',24,34,c=>{block(c,1,14,19,19,4,'#9d4a3b','#6b3c32','#ce9866');block(c,0,8,20,7,4,'#49685a','#314b43','#71907b');block(c,3,4,14,5,4,'#527964','#345344','#88a17a');rect(c,'#d5b773',3,17,2,15);rect(c,'#d5b773',15,17,2,15);});
  prop('pillar',16,32,c=>{block(c,2,26,10,5,3,'#9d9c86','#6c7064','#d2c9aa');block(c,5,5,5,23,3,'#ae5841','#773e32','#e6bc7b');block(c,3,3,9,5,3,'#c89c58','#9b703d','#efcc88');});
  prop('sacks',22,23,c=>{block(c,1,12,9,10,3,'#b49a65','#81704c','#dcca91');block(c,10,12,8,10,3,'#b49a65','#81704c','#dcca91');block(c,6,5,9,9,3,'#bca473','#88714a','#e4d4a0');});
  prop('well',24,28,c=>{block(c,1,16,17,11,5,'#a2a390','#737c6e','#c6c5aa');rect(c,'#498b9c',5,16,11,3);block(c,3,4,3,14,2,'#8a673e','#5f4a32','#c6a26a');block(c,15,4,3,14,2,'#8a673e','#5f4a32','#c6a26a');block(c,2,3,18,3,2,'#ac8753','#715534','#d9b77f');});
  prop('drum',22,25,c=>{block(c,3,11,14,11,4,'#ad5340','#753b32','#e9d1a0');rect(c,'#d4ac60',3,16,14,2);block(c,5,22,3,3,2,'#755736','#54412d','#af8858');block(c,14,22,3,3,2,'#755736','#54412d','#af8858');});
  prop('banner',20,34,c=>{block(c,3,3,2,30,1,'#89683d','#5f4b30','#c4a365');block(c,5,5,12,14,2,'#b85943','#783e33','#d7935e');rect(c,'#e4c777',9,9,4,6);});
}
