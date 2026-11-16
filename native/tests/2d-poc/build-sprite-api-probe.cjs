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
const script=`(function () { try {
const cclegacy={};
class Vec2 { constructor(x=0,y=0){this.x=x;this.y=y;} set(value){this.x=value.x;this.y=value.y;} }
class Color {constructor(r=255,g=255,b=255,a=255){this.r=r;this.g=g;this.b=b;this.a=a;} equals(v){return this.r===v.r&&this.g===v.g&&this.b===v.b&&this.a===v.a;} set(v){Object.assign(this,v);} }
class UIRenderer {
 constructor(){this._materials=[];this._materialInstances=[];this._color=new Color();this._customMaterial=null;this._srcBlendFactor=2;this._dstBlendFactor=4;this.priority=0;this.enabledInHierarchy=true;}
}
function require(id){
 if(id==='internal:constants')return {EDITOR:true};
 if(id==='cc.decorator')return new Proxy({}, {get:(_,name)=>['serializable','executeInEditMode','disallowMultiple','editable'].includes(name)?()=>{}:()=>()=>{}});
 if(id==='../../core')return {cclegacy,ccenum:()=>{},warnID:()=>{},Color,Vec2};
 if(id==='../assets/font')return {Font:jsb.Font};
 if(id==='../../core/math/vec2')return {Vec2};
 if(id==='../../core/math/color')return {Color};
 if(id==='../assets/sprite-frame')return {SpriteFrame:jsb.SpriteFrame};
 if(id==='../assets/sprite-atlas')return {SpriteAtlas:jsb.SpriteAtlas};
 if(id==='../framework/ui-transform')return {UITransform:n2d.UITransform};
 if(id==='../framework/ui-renderer')return {UIRenderer};
 if(id==='../framework/native-ui-materials')return materialAPIExports;
 throw new Error(id);
}
jsb.Material.prototype._ctor=function(){};
jsb.MaterialInstance.prototype._registerListeners=function(){};
const materialExports={}; ((exports)=>{ ${materialShell} })(materialExports);
const materialAPIExports={}; ((exports)=>{ ${materialAPIs} })(materialAPIExports);
const exports={};
${source}
const labelExports={}; ((exports)=>{ ${labelShell} })(labelExports);
function check(value,message){if(!value)throw new Error(message);}
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
const texture=new jsb.Texture2D();texture.create(4,4);frame.resetWithTexture(texture);
sprite._native.prepare(1);check(transform.getWidth()===4,'late texture/frame update');
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
check(Object.getOwnPropertyDescriptor(center,'x').get===undefined&&center.x===0.5,'destroy detaches center view');
const labelNode=new jsb.Node('label-material-shell');
const labelTransform=new n2d.UITransform(labelNode);
labelNode.getComponent=()=>({_native:labelTransform});
const label=new labelExports.Label(); label.node=labelNode; label.onLoad();
label.sharedMaterials=[custom,normal];
const labelInstances=label.materials;
check(labelInstances.length===2&&labelInstances[0].parent===custom&&labelInstances[1].owner===label,'Label actual shell native material slots');
const labelOld=labelInstances[1];
label.sharedMaterials=[null];
check(labelOld.owner===null&&label.getRenderMaterial(0)===null,'Label truncation releases owner and explicit null');
label.customMaterial=custom;
const labelCurrent=label.getMaterialInstance(0);
label.onDestroy();
check(labelCurrent.owner===null&&label.sharedMaterials.length===0,'Label destroy clears native and JS material references');
labelTransform.detach();
transform.detach();return 'OK';
}catch(error){return String(error.stack||error);}})()`;
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,script);console.log(output);

