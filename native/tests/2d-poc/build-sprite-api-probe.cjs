/* Actual Sprite shell against real SWIG assets and native renderer. */
const fs=require('fs');
const path=require('path');
const ts=require('typescript');
const repo=path.resolve(__dirname,'../../..');
const source=ts.transpileModule(fs.readFileSync(path.join(repo,'cocos/2d/components/sprite.jsb.ts'),'utf8'),{
    compilerOptions:{target:ts.ScriptTarget.ES2019,module:ts.ModuleKind.CommonJS,experimentalDecorators:true},
}).outputText;
const materialShell=ts.transpileModule(fs.readFileSync(path.join(repo,'cocos/render-scene/core/material-instance.jsb.ts'),'utf8'),{
    compilerOptions:{target:ts.ScriptTarget.ES2019,module:ts.ModuleKind.CommonJS},
}).outputText;
const output=path.join(__dirname,'build/sprite-api-probe.js');
const materialAPIs=ts.transpileModule(fs.readFileSync(path.join(repo,'cocos/2d/framework/native-ui-materials.ts'),'utf8'),{
    compilerOptions:{target:ts.ScriptTarget.ES2019,module:ts.ModuleKind.CommonJS},
}).outputText;
const labelShell=ts.transpileModule(fs.readFileSync(path.join(repo,'cocos/2d/components/label.jsb.ts'),'utf8'),{
    compilerOptions:{target:ts.ScriptTarget.ES2019,module:ts.ModuleKind.CommonJS,experimentalDecorators:true},
}).outputText;
const assemblerShell=ts.transpileModule(fs.readFileSync(path.join(repo,'cocos/2d/assembler/index.jsb.ts'),'utf8'),{
    compilerOptions:{target:ts.ScriptTarget.ES2019,module:ts.ModuleKind.CommonJS},
}).outputText;
const graphicsShell=ts.transpileModule(fs.readFileSync(path.join(repo,'cocos/2d/components/graphics.jsb.ts'),'utf8'),{
    compilerOptions:{target:ts.ScriptTarget.ES2019,module:ts.ModuleKind.CommonJS,experimentalDecorators:true},
}).outputText;
const script=`(function () { try {
const cclegacy={};
class Vec2 { constructor(x=0,y=0){this.x=x;this.y=y;} set(value){this.x=value.x;this.y=value.y;} }
class Color {constructor(r=255,g=255,b=255,a=255){this.r=r;this.g=g;this.b=b;this.a=a;} equals(v){return this.r===v.r&&this.g===v.g&&this.b===v.b&&this.a===v.a;} set(v){Object.assign(this,v);} }
Color.BLACK=new Color(0,0,0,255);Color.WHITE=new Color();Color.prototype.clone=function(){return new Color(this.r,this.g,this.b,this.a);};
class UIRenderer {
 constructor(){this.isValid=true;this._materials=[];this._materialInstances=[];this._color=new Color();this._customMaterial=null;this._srcBlendFactor=2;this._dstBlendFactor=4;this.priority=0;this.enabledInHierarchy=true;}
}
const atlasRequests = [];
const dynamicAtlasManager = { packToDynamicAtlas(component, frame) { atlasRequests.push({component, frame}); } };
function require(id){
 if(id==='internal:constants')return {EDITOR:true};
 if(id==='cc.decorator')return new Proxy({}, {get:(_,name)=>['serializable','executeInEditMode','disallowMultiple','editable'].includes(name)?()=>{}:()=>()=>{}});
 if(id==='../../core')return {cclegacy,ccenum:()=>{},warnID:()=>{},Color,Vec2};
 if(id==='../assets/font')return {Font:jsb.Font};
 if(id==='../assets/bitmap-font')return {BitmapFont:jsb.BitmapFont};
 if(id==='../utils/dynamic-atlas/atlas-manager')return {dynamicAtlasManager};
 if(id==='../../core/math/vec2')return {Vec2};
 if(id==='../../core/math/color')return {Color};
 if(id==='../assets/sprite-frame')return {SpriteFrame:jsb.SpriteFrame};
 if(id==='../assets/sprite-atlas')return {SpriteAtlas:jsb.SpriteAtlas};
 if(id==='../framework/ui-transform')return {UITransform:n2d.UITransform};
 if(id==='../framework/ui-renderer')return {UIRenderer};
 if(id==='../framework/native-ui-materials')return materialAPIExports;
 if(id==='../components/sprite')return exports;
 if(id==='../components/label')return labelExports;
 if(id==='../assembler/graphics/types')return {LineCap:{BUTT:0,ROUND:1,SQUARE:2},LineJoin:{BEVEL:0,ROUND:1,MITER:2}};
 throw new Error(id);
}
jsb.Material.prototype._ctor=function(){};
jsb.MaterialInstance.prototype._registerListeners=function(){};
const materialExports={}; ((exports)=>{ ${materialShell} })(materialExports);
const materialAPIExports={}; ((exports)=>{ ${materialAPIs} })(materialAPIExports);
const exports={};
${source}
const labelExports={}; ((exports)=>{ ${labelShell} })(labelExports);
const assemblerExports={}; ((exports)=>{ ${assemblerShell} })(assemblerExports);
const graphicsExports={}; ((exports)=>{ ${graphicsShell} })(graphicsExports);
function check(value,message){if(!value)throw new Error(message);}
check(exports.Sprite.Assembler===assemblerExports.spriteAssembler&&labelExports.Label.Assembler===assemblerExports.labelAssembler,'native assembler manager registration');
const node=new jsb.Node('sprite-api-shell');
const transform=new n2d.UITransform(node); let events=0;
node.getComponent=()=>({_native:transform}); node.emit=()=>{events++;};
const sprite=new exports.Sprite();sprite.node=node;sprite.onLoad();
check(cclegacy.Sprite===exports.Sprite&&sprite.fillRange===0,'native shell identity/default');
const normal=sprite.getSharedMaterial(0); check(normal,'default builtin material');
sprite.grayscale=true;
const gray=sprite.getSharedMaterial(0);check(gray&&gray!==normal&&sprite._native.isGrayscale(),'grayscale binding');
const instance=sprite.getMaterialInstance(0);
check(instance && instance.parent===gray && instance.owner===sprite && instance!==gray,'native MaterialInstance parent and owner');
check(sprite.getRenderMaterial(0)===instance,'native instance is rendered');
sprite.changeMaterialForDefine();check(sprite.getMaterialInstance(0)===instance,'unchanged variant keeps instance');
sprite.fillCenter=new Vec2(0.25,0.75);
const center=sprite.fillCenter;center.x=0.125;
check(sprite._native.getFillCenterX()===0.125&&sprite._native.getFillCenterY()===0.75,'fillCenter component write');
sprite._native.setFillCenter(0.5,0.25);check(center.x===0.5&&center.y===0.25,'native fillCenter readback');
sprite.trim=false;check(!sprite._native.isTrim(),'trim binding');
const custom=new jsb.Material();sprite.customMaterial=custom;
check(sprite.getSharedMaterial(0)===custom,'custom material binding');
sprite.customMaterial=null;check(sprite.getSharedMaterial(0)===gray,'custom material clear');
sprite.sharedMaterials=[custom,normal];
check(sprite.sharedMaterials.length===2&&sprite.sharedMaterials[1]===normal,'shared array native slots');
const extra=sprite.materials[1];
check(extra.parent===normal&&extra.owner===sprite,'array getter creates native owned instance');
sprite.materials=[instance];
check(sprite.getRenderMaterial(0)===instance&&extra.owner===null,'instance array replacement and truncated owner');
sprite.sharedMaterials=[];
check(sprite.sharedMaterials.length===0&&sprite.materials.length===0&&sprite.getRenderMaterial(0)===null,'empty arrays release render slots');
sprite.customMaterial=null;
check(sprite.getSharedMaterial(0)===gray,'custom clear explicitly restores builtin');
const frame=new jsb.SpriteFrame();
sprite.spriteFrame=frame;check(events===1,'frame without texture retained with editor event');
check(atlasRequests.length===1&&atlasRequests[0].component===sprite&&atlasRequests[0].frame===frame,'active replacement requests automatic atlas packing');
const texture=new jsb.Texture2D();texture.create(4,4);frame.resetWithTexture(texture);
sprite._native.prepare(1);check(transform.getWidth()===4,'late texture/frame update');
const spriteAssembler=assemblerExports.spriteAssembler.getAssembler(sprite);
sprite._color.r=64;sprite._color.a=128;spriteAssembler.updateColor(sprite);
check(Math.abs(sprite._native.getRenderEntity().getColorAlpha()-128/255)<0.00001,'native assembler color forwarding');
spriteAssembler.updateUVs(sprite);spriteAssembler.updateRenderData(sprite);
sprite._native.prepare(1);check(transform.getWidth()===4,'native Sprite geometry still prepares after assembler invalidation');
const atlas=new jsb.SpriteAtlas();atlas.addSpriteFrame('hero',frame);sprite.spriteAtlas=atlas;
sprite.changeSpriteFrameFromAtlas('hero');check(sprite.spriteFrame===frame&&events===1,'atlas switch same frame no duplicate event');
const second=new jsb.SpriteFrame();second.resetWithTexture(texture);atlas.addSpriteFrame('second',second);
sprite.onDisable();sprite.changeSpriteFrameFromAtlas('second');
check(!sprite._native.isEnabled()&&events===2,'frame replacement keeps disabled state');
sprite.fillStart=2;sprite.fillRange=-2;check(sprite._native.getFillStart()===1&&sprite._native.getFillRange()===-1,'fill bounds');
for(let i=0;i<1000;i++){
 sprite.grayscale=(i%2)===0;sprite.customMaterial=custom;sprite.customMaterial=null;sprite.spriteFrame=i%2?frame:second;
}
const lastInstance=sprite.getMaterialInstance(0);
sprite.onDestroy();check(sprite._native===null&&lastInstance.owner===null,'Sprite destroy detaches instance owner');
spriteAssembler.updateRenderData(sprite);spriteAssembler.updateUVs(sprite);spriteAssembler.updateColor(sprite);
check(Object.getOwnPropertyDescriptor(center,'x').get===undefined&&center.x===0.5,'destroy detaches center view');
const labelNode=new jsb.Node('label-material-shell');
const labelTransform=new n2d.UITransform(labelNode);
labelNode.getComponent=()=>({_native:labelTransform});
const label=new labelExports.Label(); label.node=labelNode; label.onLoad();
const labelAssembler=assemblerExports.labelAssembler.getAssembler(label);
label.string='native adapter';labelAssembler.updateRenderData(label);
check(label._native.getContentWidth()>0,'native Label assembler builds text');
label._color.r=96;labelAssembler.updateColor(label);
labelAssembler.updateRenderData(label);
check(label._native.getOpaquePixels()>0,'native Label still renders after assembler color update');
label.sharedMaterials=[custom,normal];
const labelInstances=label.materials;
check(labelInstances.length===2&&labelInstances[0].parent===custom&&labelInstances[1].owner===label,'Label actual shell native material slots');
const labelOld=labelInstances[1];
label.sharedMaterials=[null];
check(labelOld.owner===null&&label.getRenderMaterial(0)===null,'Label truncation releases owner and explicit null');
label.customMaterial=custom;
const labelCurrent=label.getMaterialInstance(0);
label.onDestroy();
labelAssembler.updateRenderData(label);labelAssembler.updateColor(label);
check(labelCurrent.owner===null&&label.sharedMaterials.length===0,'Label destroy clears native and JS material references');
labelTransform.detach();
const graphicsNode=new jsb.Node('graphics-runtime-shell');
const graphics=new graphicsExports.Graphics();graphics.node=graphicsNode;
graphics.fillRect(0,0,20,10);
const preLoadGraphics=graphics._native;
check(preLoadGraphics.getVertexCount()===4,'Graphics before onLoad creates native geometry');
graphics.onLoad();
check(graphics._native===preLoadGraphics && graphics._native.getVertexCount()===4,'onLoad retains prebuilt native geometry');
graphics.clear();
check(graphics._native.getSharedMaterial(0),'Graphics builtin material resolves in native');
graphics.lineCap=2;graphics.lineJoin=1;graphics.miterLimit=3;graphics.lineWidth=6;
graphics.moveTo(-400,-100);graphics.lineTo(400,-100);graphics.lineTo(400,200);graphics.stroke();
check(graphics._native.getVertexCount()>4&&graphics._native.getIndexCount()>6,'actual Graphics shell builds native stroke mesh');
const maskNode=new jsb.Node('graphics-stencil-shell');const maskUI=new n2d.UITransform(maskNode);
const mask=new n2d.Mask();mask.setNode(maskNode);mask.setType(2);graphics._setMask(mask);
graphics._native.prepareRenderEntity(1);mask.prepareRenderEntity(1);
check(mask.getRenderEntity().getRenderDrawInfosSize()===1,'native Mask reads shell geometry without texture');
graphics.clear();mask.prepareRenderEntity(1);
check(mask.getRenderEntity().getRenderDrawInfosSize()===0,'native Mask follows clear without JS polling');
graphics.fillRect(-700,-400,1400,800);mask.prepareRenderEntity(1);
check(mask.getRenderEntity().getRenderDrawInfosSize()===1,'native Mask follows geometry replacement');
graphics.onDestroy();mask.prepareRenderEntity(1);
check(mask.getRenderEntity().getRenderDrawInfosSize()===0,'Graphics shell destroy unbinds source');
mask.setType(0);mask.setRadius(20);maskUI.setContentSizeXY(100,80);
check(mask.isHitWorldPointXY(0,0)&&!mask.isHitWorldPointXY(49,39),'native rounded Mask hit bindings');
check(maskUI.hitTestWorldXY(0,0)&&!maskUI.hitTestWorldXY(49,39),'native UITransform ancestor Mask test bindings');
check(!maskUI.hitTestXY(0,0)&&!maskUI.hitTestXY(0,0,3),'screen hit binding supports default and explicit window id without scene');
mask.setNode(null);maskUI.detach();
transform.detach();return 'OK';
}catch(error){return String(error.stack||error);}})()`;
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,script);console.log(output);

