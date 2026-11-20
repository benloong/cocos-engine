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
 if (id === './ui-transform-sibling-order') return {queueUITransformSiblingOrder() {}};
 throw new Error(id);
}
const exports = {};
${shell}
function check(value,message) { if (!value) throw new Error(message); }
check(!('TextMetrics' in n2d), 'standalone measurement probe leaked into JSB');
const rendererManager = new n2d.UIRendererManager();
const node = new jsb.Node('layout-push'); let changes=0;
node._uiProps = { uiTransformComp: null };
node.emit = function(type) { check(type === 'size-changed','size event'); changes++; };
const ui = new exports.UITransform(); ui.node=node; ui.__preload(); ui.onLoad();
check(node._uiProps.uiTransformComp===ui,'preload registers the shell with its node');
ui.setContentSize(100,10);
check(ui.height===10 && changes===1,'shell setter notifies once');
const label = new n2d.Label(); label.setNode(node);
check(!('getTextureWidth' in label) && !('getTextureHeight' in label) && !('getLineCount' in label) && !('getContentWidth' in label) && !('getContentHeight' in label), 'Label layout diagnostics stay out of JSB');
label.setFontSize(16); label.setLineHeight(20); label.setOverflow(3); label.setString('first line');
rendererManager.updateAllDirtyRenderers();
check(ui.height===ui._native.getHeight() && ui.height>10,'native layout updates JS cache');
let previous=changes;
for(let i=0;i<1000;i++) rendererManager.updateAllDirtyRenderers();
check(changes===previous,'idle frames do not push size events');
label.setString('first\\nsecond\\nthird'); rendererManager.updateAllDirtyRenderers();
check(changes===previous+1 && ui.height===ui._native.getHeight(),'layout change pushes once '+changes+'/'+previous+' h='+ui.height+'/'+ui._native.getHeight());
label.setEnableWrapText(true); label.setString('several words to wrap'); rendererManager.updateAllDirtyRenderers();
const previousHeight=ui.height; ui.setContentSize(25, ui.height); rendererManager.updateAllDirtyRenderers();
check(ui.width===25 && ui.height>previousHeight,'native layout follows width change');
label.setOverflow(0); label.setEnableWrapText(false); label.measureContent(); check(ui.width>25 && ui.width===ui._native.getWidth(),'explicit native measurement');
check(label.getActualFontSize()===16,'native resolved font size');
rendererManager.updateAllDirtyRenderers();
label.setActualFontSize(14.123456789);
check(label.getActualFontSize()===14.123456789,'native Label rounded a manual actualFontSize');
rendererManager.updateAllDirtyRenderers();
check(label.getActualFontSize()===14.123456789,'clean native Label preserves a manual fractional actualFontSize');
label.setOverflow(0); label.setString('underline'); label.setIsUnderline(true); label.setUnderlineHeight(1); rendererManager.updateAllDirtyRenderers();
check(label.getActualFontSize()===16,'text layout replaces manual actualFontSize');
const thin=readLabelCoverage(label); label.setUnderlineHeight(3); rendererManager.updateAllDirtyRenderers();
check(readLabelCoverage(label)>thin,'native underline height changes raster output');
label.setString(''); rendererManager.updateAllDirtyRenderers(); check(label.getActualFontSize()===0,'empty text clears actual font size');
const native = ui._native;
label.setNode(null); ui.onDestroy();
check(node._uiProps.uiTransformComp===null,'destroy clears the node UITransform slot');
previous=changes; native.setContentSizeXY(50,50);
check(changes===previous,'detach releases callback');
const replacement = new exports.UITransform(); replacement.node=node; replacement.__preload(); replacement.onLoad();
ui.onDestroy();
check(node._uiProps.uiTransformComp===replacement,'destroying the old shell preserves its replacement');
replacement.onDestroy();
check(node._uiProps.uiTransformComp===null,'replacement releases the node slot');
return 'OK';
} catch(error) { return String(error.stack||error); } })()`;
fs.mkdirSync(path.dirname(output), {recursive:true});
fs.writeFileSync(output,script); console.log(output);
