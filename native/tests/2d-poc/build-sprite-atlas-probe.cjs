/* Build the actual JSB shell plus an isolated native-table integration probe. */
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const repo = path.resolve(__dirname, '../../..');
const output = path.join(__dirname, 'build/sprite-atlas-probe.js');
const shell = ts.transpileModule(fs.readFileSync(path.join(repo, 'cocos/2d/assets/sprite-atlas.jsb.ts'), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2019, module: ts.ModuleKind.CommonJS },
}).outputText;
const bootstrap = `
const rawGet = jsb.SpriteAtlas.prototype.getSpriteFrame;
const rawTexture = jsb.SpriteAtlas.prototype.getTexture;
const cclegacy = {};
const js = { createMap: () => Object.create(null) };
const destroyedFlag = 1 << 0, toDestroyFlag = 1 << 2;
const isValid = (object, strict) => !(object._objFlags & (strict ? (destroyedFlag | toDestroyFlag) : destroyedFlag));
let initialized = 0;
jsb.Asset.prototype._ctor = function () { initialized++; };
// Core metadata is covered by Jest; here the real asset classes, ownership,
// argument conversion and native map are exercised with the actual shell.
function require(id) {
    if (id === '../../core') return { cclegacy, isValid, js };
    if (id === '../../asset/assets/asset') return {};
    if (id === '../../native-binding/decorators') return { patch_cc_SpriteAtlas: () => {} };
    throw new Error('Unexpected probe import: ' + id);
}
const exports = {};
function check(value, message) { if (!value) throw new Error(message); }
`;
const probe = `
const { SpriteAtlas } = exports;
const atlas = new SpriteAtlas();
// The standalone harness may have constructed a native atlas before loading this shell.
if (initialized === 0) atlas._ctor();
check(initialized === 1, 'Asset constructor');
const first = new jsb.SpriteFrame(), second = new jsb.SpriteFrame();
const texture = new jsb.Texture2D(); texture.create(4, 4);
first.setTexture(texture); first._uuid = 'first-id'; second._uuid = 'second-id';
atlas.spriteFrames = { hero: first, empty: null };
check(rawGet.call(atlas, 'hero') === first, 'map replacement conversion');
check(!('getSpriteFrameCount' in atlas), 'test count is absent from the binding');
check(!('getRevision' in atlas) && !('getRevision' in first), 'native sprite asset revisions are private');
check(atlas.getSpriteFrameNames().join(',') === 'hero,empty', 'null slot');
check(rawTexture.call(atlas) === texture, 'first texture');
atlas.spriteFrames.hero = second;
check(rawGet.call(atlas, 'hero') === second && rawTexture.call(atlas) === null, 'same-name replacement');
let rejected = false;
try { atlas.spriteFrames.hero = {}; } catch (error) { rejected = error instanceof TypeError; }
check(rejected && atlas.spriteFrames.hero === second && rawGet.call(atlas, 'hero') === second, 'invalid native value is atomic');
delete atlas.spriteFrames.hero;
atlas.addSpriteFrame('hero', first);
check(rawTexture.call(atlas) === null, 'first null slot texture');
atlas.spriteFrames['2'] = first;
atlas.spriteFrames['1'] = second;
check(atlas.getSpriteFrameNames().join(',') === '1,2,empty,hero', 'numeric key order');
Object.defineProperty(atlas.spriteFrames, 'defined', { value: first, enumerable: true, configurable: true });
check(rawGet.call(atlas, 'defined') === first, 'defineProperty');
const dependencies = [];
atlas._deserialize({ name: 'loaded', spriteFrames: ['hero', 'first-id', 'icon', 'second-id', 'empty', ''] },
    { result: { push: (...args) => dependencies.push(args) } });
dependencies[1][0][dependencies[1][1]] = second;
check(rawTexture.call(atlas) === null, 'out-of-order pending first slot');
dependencies[0][0][dependencies[0][1]] = first;
check(rawGet.call(atlas, 'hero') === first && rawTexture.call(atlas) === texture, 'dependency write reaches native');
check(atlas.getSpriteFrameNames().join(',') === 'hero,icon,empty', 'declared dependency order');
const data = atlas._serialize();
check(data.spriteFrames.join(',') === 'hero,first-id,icon,second-id,empty,', 'serialized map');
const pendingMap = dependencies[0][0];
atlas.clear(); pendingMap.hero = second;
check(atlas.getSpriteFrameNames().length === 0, 'late callback after clear');
function beginLoad(target, pairs) {
    const writes = [];
    target._deserialize({ spriteFrames: pairs }, { result: { push: (map, key, uuid, type) => {
        check(type === 'cc.SpriteFrame', 'frame dependency type');
        writes.push(() => { map[key] = uuid === 'first-id' ? first : second; });
    } } });
    return writes;
}
const peer = new SpriteAtlas();
peer.spriteFrames = { shared: first };
for (let cycle = 0; cycle < 1000; ++cycle) {
    const old = beginLoad(atlas, ['hero', 'second-id', 'obsolete', 'second-id']);
    const current = beginLoad(atlas, ['hero', 'first-id', 'icon', 'second-id']);
    current[1]();
    old[0]();
    check(atlas.spriteFrames.hero === null && rawGet.call(atlas, 'hero') === null
        && rawTexture.call(atlas) === null, 'superseded callback cannot fill a pending replacement slot');
    current[0]();
    old[1]();
    check(atlas.getSpriteFrameNames().join(',') === 'hero,icon' && rawGet.call(atlas, 'obsolete') === null
        && rawGet.call(atlas, 'hero') === first && rawGet.call(atlas, 'icon') === second
        && rawTexture.call(atlas) === texture, 'reload preserves new slot order, identities and texture');
    check(atlas._serialize().spriteFrames.join(',') === 'hero,first-id,icon,second-id', 'reload serializes only current dependencies');
}
const late = beginLoad(peer, ['shared', 'first-id', 'pending', 'second-id']);
late[0]();
check(peer._destroy(), 'queue peer atlas destruction');
late[1]();
jsb.CCObject.deferredDestroy();
late[0]();
check(!isValid(peer) && peer.getSpriteFrameNames().length === 0
    && rawGet.call(atlas, 'hero') === first && rawTexture.call(atlas) === texture
    && isValid(first, true) && isValid(texture, true), 'late peer callbacks preserve the surviving atlas and shared assets');
console.log('sprite atlas delayed dependencies: PASS (1000 overlapping reloads and peer destruction)');
for (let i = 0; i < 1000; i++) {
    atlas.spriteFrames = { hero: first };
    atlas.addSpriteFrame('alias', first);
    atlas.spriteFrames.hero = null;
    atlas.clear();
}
check(atlas.getSpriteFrameNames().length === 0, 'replace/clear stress');
atlas.spriteFrames = { hero: first };
Object.freeze(atlas.spriteFrames);
check(!Reflect.set(atlas.spriteFrames, 'hero', null) && rawGet.call(atlas, 'hero') === first, 'frozen map rollback');
atlas.clear();
atlas._deserialize({ spriteFrames: ['hero', 'first-id'] }, { result: { push: (...args) => dependencies.push(args) } });
const outstanding = atlas.spriteFrames;
outstanding.hero = first;
check(atlas._destroy(), 'queue real native destruction');
check(isValid(atlas) && !isValid(atlas, true), 'JSB lifetime flags are deferred');
outstanding.hero = second;
atlas.spriteFrames = { hero: second };
atlas.addSpriteFrame('late', second);
check(atlas.spriteFrames !== outstanding && atlas.getSpriteFrame('hero') === first
    && rawGet.call(atlas, 'hero') === first && atlas.getSpriteFrameNames().join(',') === 'hero', 'pending atlas reads native state and rejects detached writes');
jsb.CCObject.deferredDestroy();
check(!isValid(atlas) && atlas.getSpriteFrameNames().length === 0 && atlas.getTexture() === null, 'native deferred destruction clears the retained wrapper’s table');
return 'OK';
`;
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `(function () { try {\n${bootstrap}\n${shell}\n${probe}\n} catch (error) { return String(error.stack || error); } })()`);
console.log(output);
