const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const source = path.resolve(__dirname, '../../../cocos/2d/framework/ui-renderer-manager.ts');
const compiled = ts.transpileModule(fs.readFileSync(source, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2019, module: ts.ModuleKind.CommonJS },
}).outputText;
const probe = `
(function () {
    const exports = {};
    const require = (name) => {
        if (name === 'internal:constants') return { NATIVE: true, DEBUG: false };
        if (name === '../renderer/native-2d') return { NativeUIRendererManager: n2d.UIRendererManager };
        if (name === '../../core') return {};
        throw Error('Unknown manager import: ' + name);
    };
    ${compiled}
    if ('NativeUITransformPoc' in n2d || 'NativeSpritePoc' in n2d) throw Error('Retired M0 component binding');
    if ('getRootNodeAt' in n2d.Batcher2d.prototype || 'getRootNodeCount' in n2d.Batcher2d.prototype) throw Error('Unexpected native root inspection API');
    for (const [className, methods] of [
        ['Sprite', ['isGrayscale', 'isTrim', 'getType', 'getFillType', 'getFillStart', 'getFillRange', 'getSizeMode', 'getRenderEntity']],
        ['Label', ['getCacheMode', 'getFontAsset', 'getUnderlineHeight', 'measureContent', 'isBold', 'isItalic', 'isUnderline', 'updateFont', 'getString']],
        ['Graphics', ['getRenderEntity']],
        ['RichText', ['getString']],
    ]) {
        for (const method of methods) {
            if (method in n2d[className].prototype) throw Error('Unexpected inspection API: ' + className + '.' + method);
        }
    }
    for (const component of [n2d.Sprite, n2d.Label, n2d.Graphics, n2d.Mask, n2d.RichText]) {
        if ('prepareRenderEntity' in component.prototype || 'updateRenderer' in component.prototype) {
            throw Error('Unexpected component-level renderer update binding');
        }
    }
    const manager = n2d.UIRendererManager;
    for (const component of [n2d.Sprite, n2d.Label, n2d.Mask]) {
        if ('setUITransform' in component.prototype) throw Error('Layout ownership must follow the native node');
    }
    if (typeof manager.prototype.updateAllDirtyRenderers !== 'function' || 'updateAllDirtyRenderers' in manager) throw Error('Expected instance method');
    for (const name of ['addRenderer', 'removeRenderer', 'markDirtyRenderer', 'takeDirtyRenderers',
        'getDirtyCount', 'getDirtyNativeRenderer', 'pendingNativeRenderers', 'getInstance']) {
        if (name in manager.prototype || name in manager) throw Error('Unexpected JSB API: ' + name);
    }
    const calls = [];
    const nativeUpdate = manager.prototype.updateAllDirtyRenderers;
    manager.prototype.updateAllDirtyRenderers = function () {
        calls.push('native');
        return nativeUpdate.call(this);
    };
    try {
        const renderer = { _internalId: -1, _dirtyVersion: -1, updateRenderer() { calls.push('js'); } };
        const shared = exports.uiRendererManager;
        shared.addRenderer(renderer);
        shared.markDirtyRenderer(renderer);
        shared.markDirtyRenderer(renderer);
        shared.updateAllDirtyRenderers();
        shared.updateAllDirtyRenderers();
        if (calls.join() !== 'js,native,native') throw Error('Unexpected update order: ' + calls);
    } finally {
        manager.prototype.updateAllDirtyRenderers = nativeUpdate;
    }
    return 'OK';
})();
`;
fs.writeFileSync(path.resolve(__dirname, 'build/renderer-manager-probe.js'), probe);
