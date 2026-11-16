/* Actual RichText JSB shell and native segment ownership through SWIG. */
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const repo = path.resolve(__dirname, '../../..');
const source = ts.transpileModule(fs.readFileSync(path.join(repo, 'cocos/2d/components/rich-text.jsb.ts'), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2019, module: ts.ModuleKind.CommonJS, experimentalDecorators: true },
}).outputText;
const output = path.join(__dirname, 'build/richtext-runtime-probe.js');
const script = `(function () { try {
const cclegacy = {};
class Component { constructor() { this.enabledInHierarchy = true; } }
class Color {
 constructor(r=255,g=255,b=255,a=255) { this.r=r; this.g=g; this.b=b; this.a=a; }
 clone() { return new Color(this.r,this.g,this.b,this.a); }
}
Color.WHITE = new Color();
function require(id) {
 if(id==='cc.decorator')return new Proxy({}, {get:(_,name)=>['serializable','executeInEditMode'].includes(name)?()=>{}:()=>()=>{}});
 if(id==='internal:constants')return {EDITOR:true};
 if(id==='../../core')return {Color,cclegacy};
 if(id==='../../scene-graph/component')return {Component};
 if(id==='../../scene-graph/node-event')return {NodeEventType:{TOUCH_END:'touch-end'}};
 if(id==='../framework/ui-transform')return {UITransform:n2d.UITransform};
 if(id==='../assets/font')return {Font:jsb.Font};
 if(id==='../assets/sprite-atlas')return {SpriteAtlas:jsb.SpriteAtlas};
 if(id==='./label')return {CacheMode:{NONE:0,BITMAP:1,CHAR:2},HorizontalTextAlignment:{LEFT:0,CENTER:1,RIGHT:2},VerticalTextAlignment:{TOP:0,CENTER:1,BOTTOM:2}};
 throw new Error(id);
}
const exports = {};
${source}
function check(value, message) { if(!value)throw new Error(message); }
const node = new jsb.Node('actual-richtext-shell'), ui = new n2d.UITransform(node);
ui.setAnchorPointXY(0,0);
let pushes=0, calls=0, callback;
ui.setSizeChangedCallback(()=>{pushes++;});
node.getComponent=()=>({_native:ui});
node.on=(_type, listener, owner)=>{callback=event=>listener.call(owner,event);};
node.off=()=>{callback=null;};
node.getComponents=()=>[{enabledInHierarchy:true,tap(event,param){check(param==='arg','click parameter');calls++;}}];
const rich = new exports.RichText(); rich.node=node; rich.string='<b click="tap" param="arg">hit</b>';
rich.onLoad(); rich.onEnable();
const native = rich._native;
check(cclegacy.RichText===exports.RichText&&native.getSegmentCount()===1,'actual shell creates native segment');
const revision=native.getLayoutRevision(), first=native.getSegmentNode(0), previousPushes=pushes;
for(let i=0;i<1000;i++)native.prepareRenderEntity(1);
check(native.getLayoutRevision()===revision&&native.getSegmentNode(0)===first&&pushes===previousPushes,'idle layout and size notifications remain stable');
check(native.getHitSegments(1,1).length===1&&native.getHitSegments(-1000,-1000).length===0,'native hit and miss');
const event={touch:{getUILocation:()=>({x:1,y:1})},propagationStopped:false};
callback(event);check(calls===1&&event.propagationStopped,'actual shell dispatches native hit');
rich.onDisable();check(!callback&&native.getHitSegments(1,1).length===0,'disable releases listener and native hit');
rich.onEnable();
const font=new jsb.TTFFont();font.setFontFamily('Arial');rich.font=font;
const beforeFont=native.getLayoutRevision();font.setFontFamily('Tahoma');native.prepareRenderEntity(1);
check(native.getLayoutRevision()>beforeFont,'native font revision drives layout');
rich.useSystemFont=true;rich.useSystemFont=false;check(rich.font===font,'editor font restore');
const atlas=new jsb.SpriteAtlas(), frame=new jsb.SpriteFrame(), texture=new jsb.Texture2D();
texture.create(4,2);frame.resetWithTexture(texture);atlas.addSpriteFrame('icon',frame);
rich.imageAtlas=atlas;rich.string='<img src="icon"/>tail';
check(native.getSegmentCount()===2&&native.getSegmentSprite(0).getType()===1,'actual shell native image and label');
atlas.removeSpriteFrame('icon');native.prepareRenderEntity(1);
check(native.getSegmentCount()===1&&native.getSegmentLabel(0),'late atlas removal updates native segment graph');
rich.onDestroy();check(!callback&&rich._native===null&&native.getSegmentCount()===0,'destroy releases listener and all native segments');
ui.detach();return 'OK';
}catch(error){return String(error.stack||error);}})()`;
fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, script); console.log(output);
