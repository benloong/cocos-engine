/* Exercise the actual font prototype shells against generated native bindings. */
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const repo = path.resolve(__dirname, '../../..');
const output = path.join(__dirname, 'build/font-assets-probe.js');
const names = ['font', 'ttf-font', 'bitmap-font', 'label-atlas'];
const modules = names.map(name => JSON.stringify('./' + name) + ': function (require, exports) {\n' + ts.transpileModule(fs.readFileSync(path.join(repo, 'cocos/2d/assets/' + name + '.jsb.ts'), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2019, module: ts.ModuleKind.CommonJS } }).outputText + '\n}').join(',\n');
const script = `
(function () { try {
const cclegacy = {}, js = { createMap: () => Object.create(null) };
let initialized = 0;
jsb.Asset.prototype._ctor = function () { initialized++; };
Object.defineProperty(jsb.Asset.prototype, 'nativeUrl', { get () { return this._nativeUrl || ''; } });
Object.defineProperty(jsb.SpriteFrame.prototype, 'texture', { get () { return this.getTexture(); } });
jsb.Asset.prototype.destroy = function () { return this._destroy(); };
const modules = { ${modules} }, cache = {};
function require(id) {
    if (id === '../../core') return { cclegacy, js, path: { extname: s => s.slice(s.lastIndexOf('.')) }, warnID: () => {} };
    if (id === '../../asset/assets/asset') return {};
    if (id === './sprite-frame') return { SpriteFrame: jsb.SpriteFrame };
    if (id === '../../native-binding/decorators') return { patch_cc_Font() {}, patch_cc_TTFFont() {}, patch_cc_BitmapFont() {}, patch_cc_LabelAtlas() {} };
    if (!cache[id]) { cache[id] = {}; modules[id](require, cache[id]); }
    return cache[id];
}
function check(value, message) { if (!value) throw new Error(message); }
const { Font } = require('./font'), { TTFFont } = require('./ttf-font');
const { BitmapFont } = require('./bitmap-font'), { LabelAtlas } = require('./label-atlas');
const ttf = new TTFFont();
ttf._nativeUrl = ${JSON.stringify(path.join(repo, 'tests/fixtures/Thonburi.ttf').replaceAll('\\', '/'))};
ttf._nativeAsset = 'Thonburi_LABEL';
check(ttf instanceof Font && ttf.getFontDataSize() > 1000, 'real TTF bytes loaded');
check(ttf._fontFamily === 'Thonburi_LABEL', 'TTF alias native roundtrip');
const font = new LabelAtlas();
check(font instanceof BitmapFont && font instanceof Font, 'native font hierarchy');
check(initialized === 2, 'Asset constructor hook: ' + initialized);
const config = { fontDefDictionary: {65: {rect: {x: 0, y: 0, width: 2, height: 2}, xAdvance: 2}}, kerningDict: {4259905: -1} };
font.fntConfig = config; font.fontSize = 2; font.fntDataStr = 'source';
const frame = new jsb.SpriteFrame(), texture = new jsb.Texture2D(); texture.create(2, 2); frame.setTexture(texture); font.spriteFrame = frame;
let rejected = false;
try { font.fntConfig = []; } catch (error) { rejected = error instanceof TypeError; }
check(rejected, 'invalid configuration rejected');
check(font.getGlyphCount() === 1 && font.getKerning(65, 65) === -1, 'native parsed config');
check(font.fontDefDictionary.texture === texture && font.fontDefDictionary.getLetter('65').w === 2, 'deprecated view reads native');
font.fntConfig.fontDefDictionary[65].xAdvance = 3; font.onLoaded();
check(font.getGlyphData()[7] === 3, 'onLoaded commits edited serialization view');
const stale = font.fntConfig;
stale.fontDefDictionary[65].xAdvance = 99;
check(font.setConfigJson(JSON.stringify(config)), 'native config update');
font.onLoaded();
check(font.getGlyphData()[7] === 2 && font.fntConfig !== stale, 'stale JS view cannot overwrite native config');
for (const FontClass of [BitmapFont, LabelAtlas]) {
    const reloaded = new FontClass();
    reloaded.fntConfig = config;
    const retainedView = reloaded.fntConfig;
    const retainedRevision = reloaded.getRevision();
    const retainedConfigRevision = reloaded.getConfigRevision();
    for (const invalid of [
        { fontDefDictionary: {65: {rect: {width: 1e100}}} },
        { fontDefDictionary: {65: {rect: {height: -1}}} },
        { fontDefDictionary: {65: {rect: {}, xAdvance: '2'}} },
        { kerningDict: {'4294967296': 1} },
        { kerningDict: {'4259905': 1e100} },
        { kerningDict: {'65': {'65': 1e100}} },
    ]) {
        let rejected = false;
        try { reloaded.fntConfig = invalid; } catch (error) { rejected = error instanceof TypeError; }
        check(rejected, 'unsafe numeric config rejected through JSB');
        check(reloaded.getRevision() === retainedRevision && reloaded.getConfigRevision() === retainedConfigRevision,
            'rejected config preserves native revisions');
        check(reloaded.fntConfig === retainedView && reloaded.getGlyphData()[7] === 2 && reloaded.getKerning(65, 65) === -1,
            'rejected config preserves JS view and native glyph/kerning data');
    }
    const edited = reloaded.fntConfig;
    edited.fontDefDictionary[65].xAdvance = 99;
    reloaded.setConfigJson(JSON.stringify(config));
    reloaded.onLoaded();
    check(reloaded.getGlyphData()[7] === 2 && reloaded.fntConfig !== edited, 'identical native reload invalidates old view');
    reloaded.fntConfig.fontDefDictionary[65].xAdvance = 3;
    reloaded.spriteFrame = frame; reloaded.fontSize = 4;
    reloaded.onLoaded();
    check(reloaded.getGlyphData()[7] === 3, 'dependency and size writes preserve pending config edits');
    reloaded.destroy();
    const releasedRevision = reloaded.getRevision();
    reloaded.fntConfig = config;
    reloaded.fntConfig = null;
    reloaded.onLoaded();
    check(reloaded.getRevision() === releasedRevision && reloaded.fntConfig === null, 'late JS configuration assignments ignore released font');
}
const label = new n2d.Label(); label.setFontAsset(font);
check(label.getFontAsset() === font, 'Label native asset binding');
for (let i = 0; i < 1000; i++) { label.setFontAsset(ttf); label.setFontAsset(font); label.setFontAsset(null); }
for (const FontClass of [BitmapFont, LabelAtlas]) {
    for (let i = 0; i < 1000; i++) {
        const cycle = new FontClass();
        cycle.spriteFrame = frame; cycle.fntConfig = config;
        const view = cycle.fontDefDictionary;
        label.setFontAsset(cycle);
        cycle.clearNativeData();
        check(!cycle._atlasView && !cycle.spriteFrame && cycle.getGlyphCount() === 0, 'clear drops all font owned data');
        check(view.texture === texture, 'old compatibility view does not destroy shared texture');
        cycle.spriteFrame = frame; cycle.fntConfig = config;
        cycle.destroy();
        cycle.fntConfig = config; cycle.spriteFrame = frame; cycle.onLoaded();
        check(cycle.isReleased() && cycle.fntConfig === null && !cycle.spriteFrame && !cycle._atlasView, 'destroyed font cycle cannot resurrect data');
        label.setFontAsset(null);
    }
}
font.clearNativeData();
check(font.spriteFrame === null && font.fntConfig === null && font.getGlyphCount() === 0, 'bitmap release');
font.spriteFrame = frame; font.fntConfig = config; font.fontDefDictionary;
font.destroy();
check(font.isReleased() && !font._atlasView && !font.spriteFrame, 'destroy drops native and JS compatibility refs');
font.spriteFrame = frame;
check(!font.spriteFrame && !font.setConfigJson(JSON.stringify(config)), 'released bitmap rejects late dependency and config writes');
check(font.fntConfig === null, 'released bitmap config view stays empty');
font.onLoaded();
check(font.getGlyphCount() === 0, 'late bitmap onLoaded does not recommit a released config view');
ttf.initDefault(); check(ttf.getFontDataSize() === 0 && ttf._nativeAsset === 'Arial', 'TTF default resets data');
ttf.destroy(); check(ttf.getFontDataSize() === 0 && ttf._nativeAsset === null, 'TTF destroy releases bytes');
const ttfReleasedRevision = ttf.getRevision();
ttf.initDefault('late-default');
check(ttf.getRevision() === ttfReleasedRevision && ttf._nativeAsset === null, 'released TTF ignores default initialization');
ttf._nativeAsset = 'Late_FONT';
check(ttf._nativeAsset === null && ttf.getFontDataSize() === 0, 'released TTF rejects late loader writes');
return 'OK';
} catch (error) { return String(error.stack || error); } })()
`;
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, script);
console.log(output);


