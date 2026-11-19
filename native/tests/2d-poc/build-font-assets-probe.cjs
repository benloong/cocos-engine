/* Exercise the actual font prototype shells against generated native bindings. */
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const repo = path.resolve(__dirname, '../../..');
const output = path.join(__dirname, 'build/font-assets-probe.js');
const names = ['font', 'ttf-font', 'bitmap-font', 'label-atlas'];
const modules = names.map(name => JSON.stringify('./' + name) + ': function (require, exports) {\n' + ts.transpileModule(fs.readFileSync(path.join(repo, 'cocos/2d/assets/' + name + '.jsb.ts'), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2019, module: ts.ModuleKind.CommonJS } }).outputText + '\n}').join(',\n');
const loaderModule = ts.transpileModule(fs.readFileSync(path.join(repo, 'cocos/2d/utils/font-loader.ts'), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2019, module: ts.ModuleKind.CommonJS } }).outputText;
const script = `
(function () { try {
const cclegacy = {}, js = { createMap: () => Object.create(null) };
let initialized = 0;
jsb.Asset.prototype._ctor = function () { initialized++; };
Object.defineProperty(jsb.Asset.prototype, 'nativeUrl', { get () { return this._nativeUrl || ''; } });
Object.defineProperty(jsb.SpriteFrame.prototype, 'texture', { get () { return this.getTexture(); } });
jsb.Asset.prototype.destroy = function () { return this._destroy(); };
let createFontAsset;
const modules = { ${modules}, './font-loader': function (require, exports) { ${loaderModule} } }, cache = {};
function require(id) {
    if (id === '../../core') return { cclegacy, js, path: { extname: s => s.slice(s.lastIndexOf('.')) }, warnID: () => {} };
    if (id === '../../asset/assets/asset') return {};
    if (id === './sprite-frame') return { SpriteFrame: jsb.SpriteFrame };
    if (id === './font-family') return {};
    if (id === '../../core/global-exports') return { ccwindow: { document: {} } };
    if (id === '../../asset/asset-manager/downloader') return { default: { register() {} } };
    if (id === '../../asset/asset-manager/factory') return { default: { register(handlers) { createFontAsset = handlers['.ttf']; } } };
    if (id === '../assets/ttf-font') return require('./ttf-font');
    if (id === '../../native-binding/decorators') return { patch_cc_Font() {}, patch_cc_TTFFont() {}, patch_cc_BitmapFont() {}, patch_cc_LabelAtlas() {} };
    if (!cache[id]) { cache[id] = {}; modules[id](require, cache[id]); }
    return cache[id];
}
function check(value, message) { if (!value) throw new Error(message); }
const { Font } = require('./font'), { TTFFont } = require('./ttf-font');
const { BitmapFont } = require('./bitmap-font'), { LabelAtlas } = require('./label-atlas');
for (const FontClass of [BitmapFont, LabelAtlas]) {
    const sized = new FontClass();
    for (const size of [-1, 0, 12.5]) {
        sized.fontSize = size;
        check(sized.fontSize === size, 'finite font sizes preserve fallback and fractional values');
    }
    const revision = sized.getRevision(), configRevision = sized.getConfigRevision();
    for (const size of [NaN, Infinity, -Infinity, 1e100, 12.5]) {
        sized.fontSize = size;
        check(sized.fontSize === 12.5 && sized.getRevision() === revision,
            'invalid or unchanged font size preserves data and revision through JSB');
    }
    check(sized.getConfigRevision() === configRevision, 'size validation preserves configuration revision');
    sized.destroy();
    const releasedRevision = sized.getRevision();
    sized.fontSize = 24;
    check(sized.fontSize === -1 && sized.getRevision() === releasedRevision, 'late font size cannot restore released data');
}
const ttf = new TTFFont();
check(!('getIdentity' in Font.prototype), 'native font cache identity must stay internal');
check(!('getFontData' in ttf) && !('setFontData' in ttf), 'raw TTF byte test accessors are absent from JSB');
ttf._nativeUrl = ${JSON.stringify(path.join(repo, 'tests/fixtures/Thonburi.ttf').replaceAll('\\', '/'))};
ttf._nativeAsset = 'Thonburi_LABEL';
check(jsb.loadFont('Thonburi_LABEL', "url('" + ttf._nativeUrl + "')") === 'Thonburi_LABEL', 'real platform font alias registration');
check(ttf instanceof Font && ttf.getFontDataSize() > 1000, 'real TTF bytes loaded');
check(ttf._fontFamily === 'Thonburi_LABEL', 'TTF alias native roundtrip');
const font = new LabelAtlas();
check(font instanceof BitmapFont && font instanceof Font, 'native font hierarchy');
check(initialized === 4, 'Asset constructor hook: ' + initialized);
const outlinedLabel = new n2d.Label();
for (const method of ['setBitmapAtlas', 'clearBitmapFont', 'clearGlyphs', 'addGlyph', 'clearKerning', 'addKerning']) {
    check(!(method in outlinedLabel), 'unexpected direct bitmap table binding: ' + method);
}
const outlinedNode = new jsb.Node('font-stroke-probe'), outlinedTransform = new n2d.UITransform(outlinedNode);
outlinedLabel.setNode(outlinedNode);
outlinedLabel.setFontAsset(ttf); outlinedLabel.setFontSize(24); outlinedLabel.setLineHeight(30); outlinedLabel.setString('Atlas 123');
outlinedLabel.updateRenderData();
check(Math.abs(outlinedTransform.getWidth() - 95.9765625) < 0.001, 'Label consumes the registered custom font: ' + outlinedTransform.getWidth());
const baseCoverage = readLabelCoverage(outlinedLabel);
const originalPath = ttf.getSourcePath(), originalSize = ttf.getFontDataSize(), originalRevision = ttf.getRevision();
ttf._nativeUrl = originalPath + '.missing';
ttf._nativeAsset = 'Replacement_LABEL';
check(ttf.getRevision() === originalRevision && ttf._nativeAsset === 'Thonburi_LABEL'
    && ttf.getSourcePath() === originalPath && ttf.getFontDataSize() === originalSize,
    'unreadable replacement preserves the loaded font and its alias');
outlinedLabel.updateRenderData();
check(Math.abs(outlinedTransform.getWidth() - 95.9765625) < 0.001 && readLabelCoverage(outlinedLabel) === baseCoverage,
    'attached Label retains metrics and glyph coverage after a failed replacement');
ttf._nativeUrl = ${JSON.stringify(path.resolve(repo, 'editor/assets/default_fonts/builtin-freetype/OpenSans-Regular.ttf').replaceAll('\\', '/'))};
ttf._nativeAsset = 'Replacement_LABEL';
outlinedLabel.updateRenderData();
check(ttf.getRevision() === originalRevision + 1 && ttf.getSourcePath() === ttf._nativeUrl
    && ttf._nativeAsset === 'Replacement_LABEL' && Math.abs(outlinedTransform.getWidth() - 101.9296875) < 0.001,
    'retry publishes the new font once and refreshes the attached Label');
ttf._nativeUrl = originalPath;
ttf._nativeAsset = 'Thonburi_LABEL';
outlinedLabel.setEnableOutline(true); outlinedLabel.setOutlineWidth(3); outlinedLabel.updateRenderData();
check(Math.abs(outlinedTransform.getWidth() - 101.9765625) < 0.001 && readLabelCoverage(outlinedLabel) > baseCoverage,
    'Label renders a real native text stroke with preserved layout margins');
outlinedLabel.setFontAsset(null);
outlinedLabel.setNode(null);
require('./font-loader');
const originalNativeAsset = Object.getOwnPropertyDescriptor(TTFFont.prototype, '_nativeAsset');
const assignmentFailure = new Error('injected font assignment failure');
let partialFont, completionCount = 0;
Object.defineProperty(TTFFont.prototype, '_nativeAsset', { ...originalNativeAsset, set(value) {
    originalNativeAsset.set.call(this, value); partialFont = this;
    throw assignmentFailure;
} });
try {
    createFontAsset(ttf._nativeUrl, 'M6RollbackFont_LABEL', {}, (error, asset) => {
        completionCount++;
        check(error === assignmentFailure && asset === null, 'font factory reports assignment failure once');
    });
    check(completionCount === 1 && partialFont.isReleased() && partialFont.getFontDataSize() === 0 && partialFont._fontFamily === null,
        'factory rollback destroys the real native font after bytes and alias were acquired');
} finally { Object.defineProperty(TTFFont.prototype, '_nativeAsset', originalNativeAsset); }
let missingFont;
Object.defineProperty(TTFFont.prototype, '_nativeAsset', { ...originalNativeAsset, set(value) {
    originalNativeAsset.set.call(this, value); missingFont = this;
} });
try {
    createFontAsset(ttf._nativeUrl + '.missing', 'M6MissingFont_LABEL', {}, (error, asset) => {
        check(error instanceof Error && asset === null, 'missing native font source is a factory error');
    });
    check(missingFont.isReleased() && !missingFont.getFontDataSize() && missingFont._fontFamily === null,
        'unavailable source releases the failed native font rather than returning a fallback asset');
} finally { Object.defineProperty(TTFFont.prototype, '_nativeAsset', originalNativeAsset); }
createFontAsset(ttf._nativeUrl, 'M6RollbackFont_LABEL', {}, (error, asset) => {
    check(!error && asset.getFontDataSize() > 1000 && !asset.isReleased(), 'font factory succeeds after rollback');
    asset.destroy();
});
for (let iteration = 0; iteration < 1000; iteration++) {
    const first = new TTFFont(), second = new TTFFont();
    first._nativeUrl = ttf._nativeUrl; second._nativeUrl = ttf._nativeUrl;
    first._nativeAsset = 'M6SharedFont_LABEL'; second._nativeAsset = 'M6SharedFont_LABEL';
    const sharedLabel = new n2d.Label();
    sharedLabel.setNode(outlinedNode);
    sharedLabel.setFontAsset(second); sharedLabel.setFontSize(24); sharedLabel.setString('Atlas 123');
    first.destroy();
    sharedLabel.updateRenderData();
    check(second.getFontDataSize() > 1000 && Math.abs(sharedLabel.getTTFContentWidth() - 95.9765625) < 0.001 && readLabelCoverage(sharedLabel) > 0,
        'destroying one actual JSB font preserves shared alias and native Label selection');
    second.clearNativeData(); second._nativeAsset = 'M6SharedFont_LABEL';
    sharedLabel.updateRenderData();
    check(second.getFontDataSize() > 1000 && Math.abs(sharedLabel.getTTFContentWidth() - 95.9765625) < 0.001 && readLabelCoverage(sharedLabel) > 0,
        'cleared actual JSB font can reload its alias and source');
    second.destroy(); sharedLabel.setFontAsset(null);
    sharedLabel.setNode(null);
}
outlinedTransform.detach();
const config = { fontDefDictionary: {65: {rect: {x: 0, y: 0, width: 2, height: 2}, xAdvance: 2}}, kerningDict: {4259905: -1} };
const originalJson = JSON.stringify(config);
font.fntConfig = JSON.parse(originalJson); font.fontSize = 2; font.fntDataStr = 'source';
const frame = new jsb.SpriteFrame(), texture = new jsb.Texture2D(); texture.create(2, 2); frame.setTexture(texture); font.spriteFrame = frame;
let rejected = false;
try { font.fntConfig = []; } catch (error) { rejected = error instanceof TypeError; }
check(rejected, 'invalid configuration rejected');
check(!('getGlyphCount' in font), 'glyph count test helper is absent from the binding');
check(font.getGlyphData().length === 8 && font.getKerning(65, 65) === -1, 'native parsed config');
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
    const assigned = JSON.parse(originalJson);
    reloaded.fntConfig = assigned;
    assigned.fontDefDictionary[65].xAdvance = 5;
    reloaded.onLoaded();
    check(reloaded.getGlyphData()[7] === 5, 'onLoaded reads edits made through assigned configuration');
    assigned.fontDefDictionary[65].xAdvance = 2;
    reloaded.onLoaded();
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
        check(!cycle._atlasView && !cycle.spriteFrame && cycle.getGlyphData().length === 0, 'clear drops all font owned data');
        check(view.texture === texture, 'old compatibility view does not destroy shared texture');
        cycle.spriteFrame = frame; cycle.fntConfig = config;
        cycle.destroy();
        cycle.fntConfig = config; cycle.spriteFrame = frame; cycle.onLoaded();
        check(cycle.isReleased() && cycle.fntConfig === null && !cycle.spriteFrame && !cycle._atlasView, 'destroyed font cycle cannot resurrect data');
        label.setFontAsset(null);
    }
}
font.clearNativeData();
check(font.spriteFrame === null && font.fntConfig === null && font.getGlyphData().length === 0, 'bitmap release');
font.spriteFrame = frame; font.fntConfig = config; font.fontDefDictionary;
font.destroy();
check(font.isReleased() && !font._atlasView && !font.spriteFrame, 'destroy drops native and JS compatibility refs');
font.spriteFrame = frame;
check(!font.spriteFrame && !font.setConfigJson(JSON.stringify(config)), 'released bitmap rejects late dependency and config writes');
check(font.fntConfig === null, 'released bitmap config view stays empty');
font.onLoaded();
check(font.getGlyphData().length === 0, 'late bitmap onLoaded does not recommit a released config view');
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


