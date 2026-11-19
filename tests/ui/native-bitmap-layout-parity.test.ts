import { readFileSync } from 'fs';
import { BmfontUtils } from '../../cocos/2d/assembler/label/bmfontUtils';
import { TextProcessing } from '../../cocos/2d/assembler/label/text-processing';
import { TextStyle } from '../../cocos/2d/assembler/label/text-style';
import { TextLayout } from '../../cocos/2d/assembler/label/text-layout';
import { TextOutputLayoutData, TextOutputRenderData } from '../../cocos/2d/assembler/label/text-output-data';
import { shareLabelInfo } from '../../cocos/2d/assembler/label/font-utils';
import { BitmapFont, FontAtlas } from '../../cocos/2d/assets/bitmap-font';
import { LabelAtlas } from '../../cocos/2d/assets/label-atlas';

test.each([BitmapFont, LabelAtlas])('Web bitmap font reloads edits to its assigned config', (FontClass) => {
    const font = new FontClass();
    font.fontDefDictionary = new FontAtlas(null);
    const glyph = { rect: { x: 0, y: 0, width: 2, height: 2 }, xOffset: 0, yOffset: 0, xAdvance: 2 };
    font.fntConfig = { fontDefDictionary: { 65: glyph } };
    for (const advance of [5, 2]) {
        glyph.xAdvance = advance;
        font.onLoaded();
        expect(font.fontDefDictionary.getLetter('65').xAdvance).toBe(advance);
    }
});
const fixture = process.env.CC_BITMAP_LAYOUT_FIXTURE;
(fixture ? test : test.skip)('native bitmap layout matches actual Web TextProcessing', () => {
 const {inputs, backends} = JSON.parse(readFileSync(fixture!, 'utf8'));
 expect(inputs.length).toBeGreaterThan(2000); expect(backends.length).toBeGreaterThan(0);
 const processing = new TextProcessing(); const assembler:any = new BmfontUtils();
 try { for (const {name, outputs} of backends) { expect(outputs.length).toBe(inputs.length); inputs.forEach((input, index) => {
  const style=new TextStyle(), layout=new TextLayout(), data=new TextOutputLayoutData(), render=new TextOutputRenderData();
  Object.assign(style,{fontSize:input.fontSize,actualFontSize:input.fontSize,originFontSize:input.sourceFontSize,fntConfig:{kerningDict:Object.fromEntries(input.kerning.map(([l,r,n])=>[(l<<16)|r,n]))}});
  Object.assign(layout,{horizontalAlign:input.horizontal,verticalAlign:input.vertical,overFlow:input.overflow,wrapping:input.overflow===0?false:input.overflow===3||input.wrap,lineHeight:input.lineHeight,spacingX:input.spacing});
  data.nodeContentSize.set(input.width,input.height); render.uiTransAnchorX=0;render.uiTransAnchorY=0;
  shareLabelInfo.fontAtlas=new FontAtlas(null);shareLabelInfo.margin=0;shareLabelInfo.hash='';
  for(const g of input.glyphs) shareLabelInfo.fontAtlas.addLetterDefinitions(String(g.code), {...g,valid:true} as any);
  const f=input.frame;
  style.spriteFrame={texture:{width:f.textureWidth,height:f.textureHeight},isRotated:()=>f.rotated,getRect:()=>({x:f.x,y:f.y,width:f.width,height:f.height}),getOriginalSize:()=>({width:f.originalWidth,height:f.originalHeight}),getOffset:()=>({x:f.offsetX,y:f.offsetY})} as any;
  const text=String.fromCodePoint(...input.text), glyphs:any[]=[];
  processing.processingString(true,style,layout,data,text);
  processing.generateRenderInfo(true,style,layout,data,render,text,(_style,_data,_render,_offset,_texture,rect,_rotated,x,y)=>{
   assembler.generateVertexData(_style,_data,_render,_offset,_texture,rect,_rotated,x,y);
   const vertices=render.vertexBuffer.slice(_offset,_offset+4).map(v=>({x:v.x,y:v.y,u:v.u,v:v.v}));
   glyphs.push({x,y,u:rect.x,v:rect.y,width:rect.width,height:rect.height,vertices});
  });
  const expected={width:data.nodeContentSize.width,height:data.nodeContentSize.height,actualFontSize:style.actualFontSize,scale:style.bmfontScale,lineWidths:layout.linesWidth,glyphs};
  const compare=(a,b,path)=>{if(typeof b==='number'){if(!Number.isFinite(a)||Math.abs(a-b)>0.0001)throw Error(path+': native '+a+', Web '+b);}else if(b&&typeof b==='object'){expect(Object.keys(a)).toEqual(Object.keys(b));for(const k of Object.keys(b))compare(a[k],b[k],path+'.'+k);}else expect(a).toEqual(b);};
  compare(outputs[index],expected,name+' case '+index+' '+JSON.stringify(input));
 }); } } finally { processing.destroy(); }
});
