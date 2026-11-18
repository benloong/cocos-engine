const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const source = path.resolve(__dirname, '../../../cocos/2d/framework/ui-renderer-manager.jsb.ts');
const compiled = ts.transpileModule(fs.readFileSync(source, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2019, module: ts.ModuleKind.CommonJS },
}).outputText;
const probe = `
(function () {
    const exports = {};
    ${compiled}
    const manager = new exports.UIRendererManager();
    const calls = [];
    const make = (name, callback) => {
        const renderer = { _internalId: -1, _dirtyVersion: -1, updateRenderer() {
            calls.push(name);
            if (callback) callback();
        }};
        manager.addRenderer(renderer);
        return renderer;
    };
    let replace = true;
    const first = make('first', () => {
        manager.markDirtyRenderer(first);
        if (replace) {
            replace = false;
            manager.removeRenderer(second);
            manager.addRenderer(second);
            manager.markDirtyRenderer(third);
            manager.updateAllDirtyRenderers();
        }
    });
    const second = make('second'), third = make('third');
    for (const renderer of [first, first, second]) manager.markDirtyRenderer(renderer);
    manager.updateAllDirtyRenderers();
    if (calls.join() !== 'first,third') throw Error('stale registration or duplicate update: ' + calls);
    manager.markDirtyRenderer(second);
    manager.updateAllDirtyRenderers();
    if (calls.join() !== 'first,third,second') throw Error('re-enabled renderer failed');
    let fail = true;
    const retry = make('retry', () => { if (fail) { fail = false; throw Error('retry'); } });
    manager.markDirtyRenderer(retry);
    manager.markDirtyRenderer(first);
    try { manager.updateAllDirtyRenderers(); } catch (err) { if (err.message !== 'retry') throw err; }
    manager.updateAllDirtyRenderers();
    if (calls.slice(-3).join() !== 'retry,retry,first') throw Error('lost pending work: ' + calls);
    manager.updateAllDirtyRenderers();
    if (calls.length !== 6) throw Error('idle queue ran callbacks');
    return 'OK';
})();
`;
fs.writeFileSync(path.resolve(__dirname, 'build/renderer-manager-probe.js'), probe);
