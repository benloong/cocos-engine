/* Native-only SpriteFrame cloning through the actual JSB shell and ordinary Sprite. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const repo = path.resolve(__dirname, '../../..');
const compile = file => ts.transpileModule(fs.readFileSync(path.join(repo, file), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2019, module: ts.ModuleKind.CommonJS },
}).outputText;
const shell = compile('cocos/2d/assets/sprite-frame.jsb.ts');
const vertices = compile('cocos/2d/assets/sprite-frame-vertices.ts');
const output = path.join(__dirname, 'build/sprite-frame-lifetime-probe.js');
const script = `(function () { try {
const cclegacy = {}, js = { getClassId: () => 'cc.Texture2D' };
const isValid = (object, strict) => !!object && !(object._objFlags & (strict ? 5 : 1));
class Rect { constructor(x=0,y=0,width=0,height=0) { Object.assign(this,{x,y,width,height}); } }
class Size { constructor(width=0,height=0) { Object.assign(this,{width,height}); } }
class Vec2 { constructor(x=0,y=0) { Object.assign(this,{x,y}); } }
class Vec3 { constructor(x=0,y=0,z=0) { Object.assign(this,{x,y,z}); } }
class Vec4 { constructor(x=0,y=0,z=0,w=0) { Object.assign(this,{x,y,z,w}); } }
const vertexExports = {};
function require(id) {
    if (id === '../../core') return {cclegacy,isValid,js,Rect,Size,Vec2,Vec3,Vec4};
    if (id === '../../core/math/vec3') return {Vec3};
    if (id === './sprite-frame-vertices') return vertexExports;
    if (id === '../../asset/assets/texture-2d') return {Texture2D:jsb.Texture2D};
    if (id === '../../asset/assets/texture-base') return {TextureBase:jsb.TextureBase};
    if (id === '../../native-binding/decorators') return {patch_cc_SpriteFrame(){}};
    if (id === '../../asset/assets/asset' || id === '../../asset/assets/image-asset' || id === '../../3d/assets/mesh') return {};
    throw new Error('Unexpected lifetime probe import: ' + id);
}
jsb.Asset.prototype._ctor = function () {};
jsb.CCObject.prototype.destroy = function () { return this._destroy(); };
jsb.SpriteFrame.prototype.emit = function () {};
((exports,require) => { ${vertices} })(vertexExports,require);
((exports,require) => { ${shell} })({},require);
let cycle = 0, assertions = 0;
function check(value,message) { ++assertions; if (!value) throw new Error('cycle '+cycle+': '+message); }
function snapshot(frame) {
    return JSON.stringify([frame._serialize(),frame.flipUVX,frame.flipUVY,frame.uv,frame.uvSliced]);
}
const first = new jsb.Texture2D(), replacement = new jsb.Texture2D();
first.create(32,64); replacement.create(64,32);
const host = new jsb.Node('frame-clone-lifetime'), layout = new n2d.UITransform(host);
const sprite = new n2d.Sprite(); sprite.setNode(host);
const manager = new n2d.UIRendererManager(), retained = [];
for (let repeat=0; repeat<4; ++repeat) for (let type=0; type<3; ++type) for (let sizeMode=0; sizeMode<3; ++sizeMode) for (let flags=0; flags<32; ++flags) {
    const source = new jsb.SpriteFrame();
    const trimmed = !!(flags & 8);
    source.reset({texture:first,rect:new Rect(3,4,12,10),originalSize:new Size(trimmed?20:12,trimmed?24:10),
        offset:new Vec2(trimmed?2:0,trimmed?-3:0),isRotate:!!(flags&1),borderLeft:1,borderRight:2,borderTop:3,borderBottom:4},true);
    source.flipUVX=!!(flags&2); source.flipUVY=!!(flags&4); source.packable=!!(flags&16);
    source.atlasUuid='clone-lifetime'; source.pixelsToUnit=2; source.pivot=new Vec2(.25,.75);
    const original = snapshot(source), clone = source.clone(), chain = clone.clone();
    check(snapshot(clone)===original && snapshot(chain)===original,'clone and clone-of-clone copy geometry, UV and metadata');
    check(clone.texture===first && chain.texture===first,'clones share the original texture');
    check(clone.rect!==source.rect && clone.offset!==source.offset && clone.originalSize!==source.originalSize && clone.pivot!==source.pivot,
        'clone math views have independent identity');
    source.rect.x=8; source.originalSize.width=30; source.pivot.x=0;
    source.texture=replacement;
    check(snapshot(clone)===original && snapshot(chain)===original,'source writes and texture replacement preserve both clones');
    check(source.destroy() && isValid(source) && !isValid(source,true),'source queues real deferred destruction');
    jsb.CCObject.deferredDestroy();
    check(!isValid(source) && source.texture===null && clone.texture===first,'source destruction clears its texture and preserves clone');
    source._textureSource=replacement; source.texture=replacement;
    check(source.texture===null,'late dependency and public texture writes cannot restore destroyed source');
    sprite.setType(type); sprite.setSizeMode(sizeMode); layout.setContentSizeXY(17,19); sprite.setFrame(clone);
    manager.updateAllDirtyRenderers();
    check(layout.getWidth()===(sizeMode===0?17:sizeMode===1?12:trimmed?20:12)
        && layout.getHeight()===(sizeMode===0?19:sizeMode===1?10:trimmed?24:10),'ordinary Sprite uses surviving clone dimensions');
    clone.rect.width=11; clone.offset.x=1; clone.insetLeft=.5;
    manager.updateAllDirtyRenderers();
    check(snapshot(chain)===original && clone.rect.width===11,'editing clone geometry leaves clone-of-clone unchanged');
    check(layout.getWidth()===(sizeMode===0?17:sizeMode===1?11:trimmed?20:12),'bound Sprite consumes clone revision');
    sprite.clearFrame();
    check(clone.destroy(),'clone queues destruction after consumer unbind'); jsb.CCObject.deferredDestroy();
    check(clone.texture===null && snapshot(chain)===original && chain.texture===first,'clone-of-clone survives intermediate release');
    sprite.setFrame(chain); manager.updateAllDirtyRenderers(); sprite.clearFrame();
    check(chain.destroy(),'last clone queues destruction'); jsb.CCObject.deferredDestroy();
    check(chain.texture===null && !isValid(chain),'last retained clone releases its texture');
    retained.push(source,clone,chain); ++cycle;
}
sprite.setNode(null); layout.detach();
check(cycle===1152 && retained.length===3456,'all 288 state combinations repeat four times');
check(retained.every(frame=>!isValid(frame) && frame.texture===null),'all retained asset wrappers remain destroyed');
check(isValid(first,true) && isValid(replacement,true),'shared textures remain owned by the caller');
check(first._destroy() && replacement._destroy(),'caller releases its shared textures'); jsb.CCObject.deferredDestroy();
check(!isValid(first) && !isValid(replacement),'shared textures finish deferred destruction');
console.log('sprite frame clone lifetime: PASS ('+cycle+' cycles, '+retained.length+' retained frames, '+assertions+' assertions)');
return 'OK';
} catch(error) { return String(error.stack || error); } })()`;
fs.mkdirSync(path.dirname(output), {recursive:true});
fs.writeFileSync(output, script);
console.log(output);
