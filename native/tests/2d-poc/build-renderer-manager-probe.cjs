const fs = require('fs');
const path = require('path');
const ts = require('typescript');

function compile(source) {
    return ts.transpileModule(source, {
        compilerOptions: { target: ts.ScriptTarget.ES2019, module: ts.ModuleKind.CommonJS },
    }).outputText;
}

const managerPath = path.resolve(__dirname, '../../../cocos/2d/framework/ui-renderer-manager.ts');
const compiledManager = compile(fs.readFileSync(managerPath, 'utf8'));
const rootPath = path.resolve(__dirname, '../../../cocos/root.jsb.ts');
const root = ts.createSourceFile(rootPath, fs.readFileSync(rootPath, 'utf8'), ts.ScriptTarget.ES2019, true);
const frameMove = root.statements.filter(statement => {
    if (ts.isVariableStatement(statement)) {
        return statement.declarationList.declarations.some(({ name }) =>
            ts.isIdentifier(name) && (name.text === 'nativeUIRendererManager' || name.text === 'oldFrameMove'));
    }
    return ts.isExpressionStatement(statement) && ts.isBinaryExpression(statement.expression)
        && statement.expression.left.getText(root) === 'rootProto.frameMove';
});
if (frameMove.length !== 3) throw Error('Could not find the Native renderer manager and frameMove hook');
const compiledFrameMove = compile(frameMove.map(statement => statement.getText(root)).join('\n'));
const probe = `
(function () {
    const exports = {};
    const require = (name) => {
        if (name === 'internal:constants') return { DEBUG: false };
        if (name === '../../core') return {};
        throw Error('Unknown manager import: ' + name);
    };
    ${compiledManager}
    if ('NativeUITransformPoc' in n2d || 'NativeSpritePoc' in n2d) throw Error('Retired M0 component binding');
    if ('getRootNodeAt' in n2d.Batcher2d.prototype || 'getRootNodeCount' in n2d.Batcher2d.prototype) throw Error('Unexpected native root inspection API');
    for (const [className, methods] of [
        ['Sprite', ['isGrayscale', 'isTrim', 'getType', 'getFillType', 'getFillStart', 'getFillRange', 'getSizeMode', 'getRenderEntity']],
        ['Label', ['getCacheMode', 'getFontAsset', 'getUnderlineHeight', 'measureContent', 'isBold', 'isItalic', 'isUnderline', 'updateFont', 'getString', 'getRenderEntity']],
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
        const NativeUIRendererManager = manager;
        const cclegacy = { director: { getTotalFrames: () => 7 } };
        const rootProto = { frameMove(deltaTime, frame) {
            if (this !== rootProto || deltaTime !== 0.25 || frame !== 7) throw Error('Unexpected frameMove arguments');
            calls.push('frame');
        } };
        ${compiledFrameMove}
        const renderer = { _internalId: -1, _dirtyVersion: -1, updateRenderer() { calls.push('js'); } };
        const shared = exports.uiRendererManager;
        shared.addRenderer(renderer);
        shared.markDirtyRenderer(renderer);
        shared.markDirtyRenderer(renderer);
        shared.updateAllDirtyRenderers();
        rootProto.frameMove(0.25);
        shared.updateAllDirtyRenderers();
        rootProto.frameMove(0.25);
        if (calls.join() !== 'js,native,frame,native,frame') throw Error('Unexpected update order: ' + calls);
    } finally {
        manager.prototype.updateAllDirtyRenderers = nativeUpdate;
    }
    return 'OK';
})();
`;
fs.writeFileSync(path.resolve(__dirname, 'build/renderer-manager-probe.js'), probe);
