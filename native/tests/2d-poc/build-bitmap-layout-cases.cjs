'use strict';
const fs=require('fs'),path=require('path');
const glyphs=[{code:65,u:0,v:0,w:16,h:12,offsetX:1,offsetY:2,xAdvance:14},{code:66,u:16,v:0,w:9,h:18,offsetX:-1,offsetY:-2,xAdvance:11},{code:32,u:0,v:0,w:0,h:0,offsetX:0,offsetY:0,xAdvance:6},{code:20013,u:0,v:18,w:12,h:16,offsetX:0,offsetY:0,xAdvance:13}];
const inputs=[];
for(const text of ['AB','ABABA','AB AB AB','A\nBB\nA','中AB中中','A\rB','A?B','']) for(let overflow=0;overflow<4;overflow++) for(let horizontal=0;horizontal<3;horizontal++) for(let vertical=0;vertical<3;vertical++) for(const fontSize of [8,16,24,15.5]) for(const wrap of [false,true]) {
 const i=inputs.length;inputs.push({text:Array.from(text,c=>c.codePointAt(0)),glyphs,kerning:[[65,66,-2],[66,65,1]],width:[24,48,80][i%3],height:[8,24,56][Math.floor(i/3)%3],fontSize,sourceFontSize:16,lineHeight:i%2?20:16,spacing:[0,2,-1][Math.floor(i/5)%3],overflow,horizontal,vertical,wrap});
}
for(const fontSize of [0,2147483647,2147483648]) inputs.push({...inputs[0],fontSize,overflow:2,width:64,height:32});
const frames=[{x:4,y:6,originalWidth:32,originalHeight:16,offsetX:0,offsetY:0},
 {x:6,y:3,originalWidth:40,originalHeight:24,offsetX:2,offsetY:-2},
 {x:2,y:8,originalWidth:40,originalHeight:24,offsetX:-6,offsetY:6},
 {x:4,y:6,originalWidth:32,originalHeight:16,offsetX:8,offsetY:-4},
 {x:4,y:2,originalWidth:40,originalHeight:24,offsetX:10,offsetY:12}];
inputs.forEach((input,i)=>{const profile=Math.floor(i/7)%10;input.frame={...frames[Math.floor(profile/2)],width:32,height:16,textureWidth:64,textureHeight:64,rotated:!!(profile%2)};});
fs.mkdirSync(path.join(__dirname,'build'),{recursive:true});fs.writeFileSync(path.join(__dirname,'build/bitmap-layout-input.json'),JSON.stringify(inputs));console.log('Bitmap layout cases: '+inputs.length);
