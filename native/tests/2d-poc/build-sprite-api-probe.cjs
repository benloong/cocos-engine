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
const frameModules=['sprite-frame-vertices','sprite-frame.jsb'].map(name=>
    ts.transpileModule(fs.readFileSync(path.join(repo,'cocos/2d/assets',name+'.ts'),'utf8'),{
        compilerOptions:{target:ts.ScriptTarget.ES2019,module:ts.ModuleKind.CommonJS},
    }).outputText);
const meshModule=ts.transpileModule(fs.readFileSync(path.join(repo,'cocos/3d/assets/mesh.jsb.ts'),'utf8'),{
    compilerOptions:{target:ts.ScriptTarget.ES2019,module:ts.ModuleKind.CommonJS},
}).outputText;
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
 get color(){return this._color;}
 constructor(){this.isValid=true;this._materials=[];this._materialInstances=[];this._color=new Color();this._customMaterial=null;this._srcBlendFactor=2;this._dstBlendFactor=4;this.priority=0;this.enabledInHierarchy=true;}
}
function require(id){
 if(id==='internal:constants')return {EDITOR:true};
 if(id==='cc.decorator')return new Proxy({}, {get:(_,name)=>['serializable','executeInEditMode','disallowMultiple','editable'].includes(name)?()=>{}:()=>()=>{}});
 if(id==='../../core')return {cclegacy,ccenum:()=>{},warnID:()=>{},Color,Vec2};
 if(id==='../assets/font')return {Font:jsb.Font};
 if(id==='../assets/bitmap-font')return {BitmapFont:jsb.BitmapFont};
 if(id==='../utils/label-canvas-pool')return {CanvasPool:{getInstance:()=>({})}};
 if(id==='../assets/letter-render-texture')return {LetterRenderTexture:jsb.Texture2D};
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
const materialExports={}; ((exports)=>{ ${materialShell} })(materialExports);
const materialAPIExports={}; ((exports,require)=>{ ${materialAPIs} })(materialAPIExports,id=>id==='internal:constants'?{EDITOR:false}:require(id));
const exports={};
${source}
const labelExports={}; ((exports)=>{ ${labelShell} })(labelExports);
const assemblerExports={}; ((exports)=>{ ${assemblerShell} })(assemblerExports);
const graphicsExports={}; ((exports)=>{ ${graphicsShell} })(graphicsExports);
function check(value,message){if(!value)throw new Error(message);}
check(exports.Sprite.Assembler===assemblerExports.spriteAssembler&&labelExports.Label.Assembler===assemblerExports.labelAssembler,'native assembler manager registration');
const rendererManager = new n2d.UIRendererManager();
const node=new jsb.Node('sprite-api-shell');
const transform=new n2d.UITransform(node); let events=0;
node.getComponent=()=>({_native:transform}); node.emit=()=>{events++;};
const sprite=new exports.Sprite();sprite.node=node;sprite.onLoad();
check(cclegacy.Sprite===exports.Sprite&&sprite.fillRange===0,'native shell identity/default');
check(!('prepare' in sprite._native),'native Sprite preparation stays internal');
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
const sharedView=sprite.sharedMaterials;
const instanceView=sprite.materials;
const originalSlot=instanceView[1];
sharedView[1]=custom;
check(sharedView===sprite.sharedMaterials&&sprite._native.getSharedMaterial(1)===custom&&sprite.getRenderMaterial(1)===originalSlot,'shared array writes preserve an existing instance');
instanceView[1]=null;
check(sprite._native.getRenderMaterial(1)===custom&&originalSlot.owner===null,'clearing an instance reveals its updated shared slot');
sharedView.splice(1,1,normal,custom);
check(sprite._native.getSharedMaterialCount()===3&&sprite._native.getSharedMaterial(2)===custom,'splice updates native shared storage');
delete sharedView[2];
check(!(2 in sprite.sharedMaterials)&&sprite._native.getSharedMaterial(2)===null,'deleted array element stays a hole');
sharedView.length=2;
check(sprite._native.getSharedMaterialCount()===2,'direct length assignment truncates the shared array');
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
const polygon=new jsb.SpriteFrame();
polygon.setRect(0,0,40,36);polygon.setPixelsToUnit(4);polygon.setPivotX(0.25);polygon.setPivotY(0.75);
const positions=polygon.transformMeshPositions([-20,-18,1,20,-18,2,0,18,0]);
check(JSON.stringify(positions)===JSON.stringify([-2.5,-6.75,1,7.5,-6.75,2,2.5,2.25,0]),'authored polygon pivot and scale');
sprite.spriteFrame=frame;check(events===1,'frame without texture retained with editor event');
const texture=new jsb.Texture2D();texture.create(4,4);frame.resetWithTexture(texture);
rendererManager.updateAllDirtyRenderers();check(transform.getWidth()===4,'late texture/frame update');
const spriteAssembler=assemblerExports.spriteAssembler.getAssembler(sprite);
sprite._color.r=64;sprite._color.a=128;spriteAssembler.updateColor(sprite);
check(Math.abs(sprite._native.getRenderEntity().getColorAlpha()-128/255)<0.00001,'native assembler color forwarding');
spriteAssembler.updateUVs(sprite);spriteAssembler.updateRenderData(sprite);
rendererManager.updateAllDirtyRenderers();check(transform.getWidth()===4,'native Sprite geometry still prepares after assembler invalidation');
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
const label=new labelExports.Label(); label.node=labelNode;
check(label.contentWidth===0,'Label contentWidth starts at zero');
label.contentWidth=19.123456789;
label.onLoad();
check(label.contentWidth===19.123456789,'Label preserves pre-load contentWidth');
const labelAssembler=assemblerExports.labelAssembler.getAssembler(label);
label.string='native adapter';labelAssembler.updateRenderData(label);
check(labelTransform.getWidth()>0,'native Label assembler builds text');
label.enableWrapText=true;label.fontSize=16;label.lineHeight=20;
for(const force of [false,true]){
 for(const mode of [1,2,3,0]){
    label.overflow=mode;labelTransform.setContentSizeXY(72,80);
    label.string=['one line','second line'].join(String.fromCharCode(10));
    label.updateRenderData(force);
    const width=labelTransform.getWidth(),height=labelTransform.getHeight();
    if(mode===1||mode===2)check(width===72&&height===80,'fixed Label bounds on immediate update');
    if(mode===3)check(width===72&&height>0&&height!==80,'Label resize-height preserves width');
    if(mode===0)check(width>0&&width!==72&&height>0&&height!==80,'unconstrained Label measures immediately');
 }
}
label._color.r=96;labelAssembler.updateColor(label);
labelAssembler.updateRenderData(label);
check(readLabelCoverage(label._native)>0,'native Label still renders after assembler color update');
label.sharedMaterials=[custom,normal];
const bitmapForResize=new jsb.BitmapFont();
label.font=bitmapForResize;
const fontCalls=[];
const fontPrototype=n2d.Label.prototype;
const fontMethods=['setFont','setFontSize','setFontAsset'];
const originals=fontMethods.map(name=>fontPrototype[name]);
try {
 fontMethods.forEach((name,index)=>{fontPrototype[name]=function(value){fontCalls.push(name);return originals[index].call(this,value);};});
 label.fontSize=18.25; label.fontSize=18.25;
 label.fontFamily='Verdana';
 check(label._native.getFontAsset()===bitmapForResize&&label.fontSize===18.25,'bitmap font is retained during resize');
 check(fontCalls.join(',')==='setFontSize,setFont','isolated Label font changes: '+fontCalls.join(','));
} finally {fontMethods.forEach((name,index)=>{fontPrototype[name]=originals[index];});}
label.font=null;
label.fontSize=23.75;
label.updateRenderData(true);
check(label.actualFontSize===23.75&&readLabelCoverage(label._native)>0,'fractional resize renders after switching back to the system font');
for (const key of ['isBold','isItalic','isUnderline','underlineHeight','enableOutline','outlineWidth','enableShadow','shadowBlur']) {
 const setter='set'+key[0].toUpperCase()+key.slice(1);
 const prototype=n2d.Label.prototype;
 const original=prototype[setter], initial=label[key];
 const changed=typeof initial==='boolean' ? !initial : initial+0.25;
 const calls=[];
 prototype[setter]=function(value){calls.push(value);return original.call(this,value);};
 try {
  label[key]=initial; label[key]=changed; label[key]=changed; label[key]=initial;
  check(calls.length===2&&calls[0]===changed&&calls[1]===initial,'Label JSB setter transitions '+key+' calls='+calls.length);
 } finally {prototype[setter]=original;}
}
const labelInstances=label.materials;
check(labelInstances.length===2&&labelInstances[0].parent===custom&&labelInstances[1].owner===label,'Label actual shell native material slots');
const labelOld=labelInstances[1];
const callbackSlots=[];
label._onRebuildPSO=(slot,material)=>{
 check(material===labelOld&&label.getRenderMaterial(slot)===material,'callback targets a live Label draw material');
 callbackSlots.push(slot);
};
label.setMaterialInstance(labelOld,0);
labelOld.onPassStateChange(true);
labelOld.onPassStateChange(false);
label.setSharedMaterial(null,1);
labelOld.onPassStateChange(false);
label.setMaterialInstance(labelOld,1);
label.setSharedMaterial(null,0);
labelOld.onPassStateChange(false);
label.sharedMaterials=[null];
labelOld.onPassStateChange(false);
check(callbackSlots.join(',')==='1,0,1','callback preserves its original slot, moves on replacement, and detaches on removal');
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
graphics.onLoad();
check(graphics._native===preLoadGraphics,'onLoad retains the Graphics that recorded the rectangle');
rendererManager.updateAllDirtyRenderers();
const graphicsEntity=graphics._native.getRenderEntity();
check(graphicsEntity.getRenderDrawInfosSize()===1,'rectangle submits a single draw');
const rectangleDraw=graphicsEntity.getRenderDrawInfoAt(0);
check(rectangleDraw.vbCount===4 && rectangleDraw.ibCount===6,'pre-load rectangle submits four vertices and six indices');
graphics.clear();
check(graphics._native.getSharedMaterial(0),'Graphics builtin material resolves in native');
graphics.lineCap=2;graphics.lineJoin=1;graphics.miterLimit=3;graphics.lineWidth=6;
graphics.moveTo(-400,-100);graphics.lineTo(400,-100);graphics.lineTo(400,200);graphics.stroke();
rendererManager.updateAllDirtyRenderers();
check(graphicsEntity.getRenderDrawInfosSize()===1,'stroke submits a single draw');
const strokeDraw=graphicsEntity.getRenderDrawInfoAt(0);
check(strokeDraw.vbCount>4 && strokeDraw.ibCount>6,'actual Graphics shell submits native stroke mesh');
const maskNode=new jsb.Node('graphics-stencil-shell');const maskUI=new n2d.UITransform(maskNode);
const mask=new n2d.Mask();mask.setNode(maskNode);mask.setType(2);graphics._setMask(mask);
rendererManager.updateAllDirtyRenderers();
check(mask.getRenderEntity().getRenderDrawInfosSize()===1,'native Mask reads shell geometry without texture');
const stencilDraw=mask.getRenderEntity().getRenderDrawInfoAt(0);
check(stencilDraw.vbCount===strokeDraw.vbCount && stencilDraw.ibCount===strokeDraw.ibCount,'stencil submits the source stroke geometry');
graphics.clear();rendererManager.updateAllDirtyRenderers();
check(mask.getRenderEntity().getRenderDrawInfosSize()===0,'native Mask follows clear without JS polling');
graphics.fillRect(-700,-400,1400,800);rendererManager.updateAllDirtyRenderers();
check(mask.getRenderEntity().getRenderDrawInfosSize()===1,'native Mask follows geometry replacement');
graphics.onDestroy();rendererManager.updateAllDirtyRenderers();
check(mask.getRenderEntity().getRenderDrawInfosSize()===0,'Graphics shell destroy unbinds source');
mask.setType(0);mask.setRadius(20);maskUI.setContentSizeXY(100,80);
check(mask.isHitWorldPointXY(0,0)&&!mask.isHitWorldPointXY(49,39),'native rounded Mask hit bindings');
check(maskUI.hitTestWorldXY(0,0)&&!maskUI.hitTestWorldXY(49,39),'native UITransform ancestor Mask test bindings');
check(!maskUI.hitTestXY(0,0)&&!maskUI.hitTestXY(0,0,3),'screen hit binding supports default and explicit window id without scene');
mask.setNode(null);maskUI.detach();
transform.detach();
class Vec3 {
 constructor(x=0,y=0,z=0){this.set(x,y,z);}
 set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}
 clone(){return new Vec3(this.x,this.y,this.z);}
}
const vertexExports={};
function frameRequire(id){
 if(id==='../../core')return {cclegacy,Vec2,Vec3,isValid:()=>true};
 if(id==='../../core/math/vec3')return {Vec3};
 if(id==='./sprite-frame-vertices')return vertexExports;
 if(id==='../utils/dynamic-atlas/atlas')return {Atlas:{releaseFrame(){},trackClone(){}}};
 if(id==='../../native-binding/decorators')return {patch_cc_SpriteFrame(){},patch_cc_Mesh(){}};
 if(id==='../../3d/assets/mesh'){
     const moduleExports={};
     ((exports,require)=>{ ${meshModule} })(moduleExports,frameRequire);
     return moduleExports;
 }
 throw new Error(id);
}
jsb.Asset.prototype._ctor=function(){};
// The engine installs CCObject.destroy from TypeScript; exercise its native destruction call.
jsb.CCObject.prototype.destroy=function(){return this._destroy();};
jsb.SpriteFrame.prototype.emit=function(){};
((exports,require)=>{ ${frameModules[0]} })(vertexExports,frameRequire);
((exports,require)=>{ ${frameModules[1]} })({},id=>id.startsWith('../../asset/assets/')?{}:frameRequire(id));
const meshFrame=new jsb.SpriteFrame();
meshFrame.texture=texture;
meshFrame.rect={x:1,y:0,width:2,height:3};
meshFrame.pixelsToUnit=2;
meshFrame.pivot={x:0.25,y:0.75};
check(meshFrame.mesh===null,'mesh lazy before ensure');
meshFrame.ensureMeshData();
const mesh=meshFrame.mesh,vertices=meshFrame.vertices;
const expectedPositions=[-0.25,-1.125,0,0.75,-1.125,0,-0.25,0.375,0,0.75,0.375,0];
function equalArray(actual,expected){return JSON.stringify(Array.from(actual))===JSON.stringify(expected);}
check(equalArray(mesh.readAttribute(0,'a_position'),expectedPositions),'mesh vertex buffer');
check(equalArray(mesh.readAttribute(0,'a_texCoord'),[0.25,0.25,0.75,0.25,0.25,1,0.75,1]),'mesh UV buffer');
check(equalArray(mesh.readIndices(0),[0,1,2,2,1,3]),'mesh index buffer');
check(mesh.struct.vertexBundles.length===1,'2D entry loads public mesh wrapper');
check(equalArray(vertices.uv,[1,4,3,4,1,1,3,1]),'mesh pixel UV');
const meshMin=mesh.getMinPosition(),meshMax=mesh.getMaxPosition();
check(meshMin!=null&&meshMax!=null,'native mesh exposes both bounds');
meshFrame.ensureMeshData();meshFrame.texture=texture;
check(meshFrame.mesh===mesh,'repeated ensure and unchanged texture retain mesh');
const copy=meshFrame.clone();
check(copy.mesh!==mesh&&equalArray(copy.mesh.readAttribute(0,'a_position'),expectedPositions),'clone owns mesh');
const larger=new jsb.Texture2D();larger.create(8,8);meshFrame.texture=larger;
check(meshFrame.mesh!==mesh&&meshFrame.vertices===vertices&&vertices.rawPosition[0].x===-4,'texture refresh rebuild');
const emptyFrame=new jsb.SpriteFrame();emptyFrame.meshType=1;emptyFrame.ensureMeshData();
check(emptyFrame.mesh.getStruct().vertexBundles[0].view.count===0&&emptyFrame.vertices.indexes.length===0,'empty polygon mesh');
return 'OK';
}catch(error){return String(error.stack||error);}})()`;
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,script);console.log(output);

