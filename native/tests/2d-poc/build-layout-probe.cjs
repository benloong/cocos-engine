/* Actual UITransform shell + real native Label: no frame polling. */
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const repo = path.resolve(__dirname, '../../..');
const shell = ts.transpileModule(fs.readFileSync(path.join(repo, 'cocos/2d/framework/ui-transform.jsb.ts'), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2019, module: ts.ModuleKind.CommonJS, experimentalDecorators: true },
}).outputText;
const output = path.join(__dirname, 'build/layout-probe.js');
const script = `(function () { try {
class Size {
 constructor(width=0,height=0) { this.width=width; this.height=height; }
 set(w,h) { this.width=w.width===undefined?w:w.width; this.height=w.height===undefined?h:w.height; }
 equals(v) { return this.width===v.width && this.height===v.height; }
 clone() { return new Size(this.width,this.height); }
}
class Vec2 {
 constructor(x=0,y=0) { this.x=x; this.y=y; }
 set(v) { this.x=v.x; this.y=v.y; }
 equals(v) { return this.x===v.x && this.y===v.y; }
}
function require(id) {
 if (id === 'cc.decorator') return new Proxy({}, {get: () => (target, key) => typeof target === 'function' ? target : key !== undefined ? undefined : value => typeof value === 'function' ? value : undefined});
 if (id === 'internal:constants') return {EDITOR:false};
 if (id === '../../scene-graph') return { Component: class {} };
 if (id === '../../core') return {Size,Vec2,Mat4:class {}};
 if (id === '../../game/director') return {director:{}};
 if (id === '../../scene-graph/node-event') return {NodeEventType:{SIZE_CHANGED:'size-changed'}};
 throw new Error(id);
}
const exports = {};
${shell}
function check(value,message) { if (!value) throw new Error(message); }
const rendererManager = new n2d.UIRendererManager();
const node = new jsb.Node('layout-push'); let changes=0;
node.emit = function(type) { check(type === 'size-changed','size event'); changes++; };
const ui = new exports.UITransform(); ui.node=node; ui.onLoad();
ui.setContentSize(100,10);
check(ui.height===10 && changes===1,'shell setter notifies once');
const label = new n2d.Label(); label.setNode(node); label.setUITransform(ui._native);
label.setFontSize(16); label.setLineHeight(20); label.setOverflow(3); label.setString('first line');
rendererManager.updateAllDirtyRenderers();
check(ui.height===label.getContentHeight() && ui.height>10,'native layout updates JS cache');
let previous=changes;
for(let i=0;i<1000;i++) rendererManager.updateAllDirtyRenderers();
check(changes===previous,'idle frames do not push size events');
label.setString('first\\nsecond\\nthird'); rendererManager.updateAllDirtyRenderers();
check(changes===previous+1 && ui.height===label.getContentHeight(),'layout change pushes once '+changes+'/'+previous+' h='+ui.height+'/'+label.getContentHeight());
label.setEnableWrapText(true); label.setString('several words to wrap'); rendererManager.updateAllDirtyRenderers();
const lines=label.getLineCount(); ui.setContentSize(25, ui.height); rendererManager.updateAllDirtyRenderers();
check(ui.width===25 && label.getLineCount()>lines,'native layout follows width change');
label.measureContent(); check(ui.width===label.getContentWidth(),'explicit native measurement');
check(label.getActualFontSize()===16,'native resolved font size');
label.setOverflow(0); label.setString('underline'); label.setIsUnderline(true); label.setUnderlineHeight(1); rendererManager.updateAllDirtyRenderers();
const thin=label.getOpaquePixels(); label.setUnderlineHeight(3); rendererManager.updateAllDirtyRenderers();
check(label.getOpaquePixels()>thin,'native underline height changes raster output');
label.setString(''); rendererManager.updateAllDirtyRenderers(); check(label.getActualFontSize()===0,'empty text clears actual font size');
const native = ui._native;
label.setNode(null); label.setUITransform(null); ui.onDestroy();
previous=changes; native.setContentSizeXY(50,50);
check(changes===previous,'detach releases callback');
return 'OK';
} catch(error) { return String(error.stack||error); } })()`;
fs.mkdirSync(path.dirname(output), {recursive:true});
fs.writeFileSync(output,script); console.log(output);
