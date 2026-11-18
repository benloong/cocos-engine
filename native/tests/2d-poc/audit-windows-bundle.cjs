'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('typescript');
const { buildEngine } = require('@cocos/ccbuild');

const root = path.resolve(__dirname, '../../..');
const deployed = path.resolve(process.argv[2] || path.join(root, '../cocos-m1-test/build/windows/proj/Debug/Resources/src/cocos-js'));
const output = path.join(__dirname, 'build/windows-bundle-audit');
const visualization = path.join(output, 'modules.html');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

// Rollup cannot resolve settings, bundle prerequisites or script packages selected at runtime.
function findRuntimeImports (file) {
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    if (source.parseDiagnostics.length) throw new Error('Invalid emitted JavaScript: ' + file);
    const calls = [];
    function visit (node) {
        if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword
            || (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'import'))) {
            calls.push({ line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, call: node.getText(source) });
        }
        ts.forEachChild(node, visit);
    }
    visit(source);
    return calls;
}

async function main () {
    process.chdir(root);
    require('../../../scripts/ensure-pal.cjs')();
    fs.mkdirSync(output, { recursive: true });
    fs.rmSync(visualization, { force: true });
    // Match the Windows acceptance app's override build. Verify against its
    // deployed bytes so a changed feature set cannot silently pass the audit.
    const result = await buildEngine({
        engine: root, out: output, platform: 'WINDOWS', mode: 'BUILD',
        features: ['2d', 'affine-transform', 'animation', 'audio', 'base', 'custom-pipeline', 'dragon-bones',
            'graphics', 'intersection-2d', 'mask', 'particle-2d', 'physics-2d-box2d', 'profiler', 'rich-text',
            'spine-3.8', 'tiled-map', 'tween', 'ui', 'video', 'websocket', 'webview', 'custom-pipeline-builtin-scripts'],
        flags: { DEBUG: true, LOAD_BULLET_MANUALLY: false, NET_MODE: 0, SERVER_MODE: false },
        moduleFormat: 'system', compress: false, sourceMap: false, inlineEnum: true, nativeCodeBundleMode: 'wasm',
        targets: 'chrome 80', visualize: { file: visualization },
    });
    const chunks = {};
    for (const [file, imports] of Object.entries(result.chunkDepGraph)) {
        const sha256 = hash(path.join(output, file));
        if (sha256 !== hash(path.join(deployed, file))) throw new Error('Deployed chunk differs: ' + file);
        chunks[file] = { sha256, imports, runtimeImports: findRuntimeImports(path.join(deployed, file)) };
    }
    if (!chunks['cc.js']) throw new Error('Missing deployed engine entry');
    const html = fs.readFileSync(visualization, 'utf8');
    const match = /^\s*const data = (\{.*\});$/m.exec(html);
    if (!match) throw new Error('Missing Rollup visualization data');
    const { nodeMetas, nodeParts } = JSON.parse(match[1]);
    const edges = [];
    const modules = [];
    const normalize = id => id.replaceAll('\\', '/');
    for (const module of Object.values(nodeMetas)) {
        const id = normalize(module.id);
        const bytes = Object.values(module.moduleParts).reduce((sum, uid) => sum + nodeParts[uid].renderedLength, 0);
        const in2d = id.includes('/cocos/2d/');
        if (in2d) modules.push({ id, bytes });
        for (const edge of module.imported) {
            const target = normalize(nodeMetas[edge.uid].id);
            if (edge.dynamic || (!in2d && target.includes('/cocos/2d/'))) {
                edges.push({ from: id, to: target, dynamic: !!edge.dynamic });
            }
        }
    }
    if (!modules.some(m => m.bytes > 0 && m.id.endsWith('/sprite.jsb.ts'))) throw new Error('Missing native Sprite override');
    const report = { chunks, modules, edges };
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    console.log('Verified engine chunks:', Object.keys(chunks).length, '2D graph modules:', modules.length,
        'boundary imports:', edges.filter(edge => !edge.dynamic).length, 'dynamic imports:', edges.filter(edge => edge.dynamic).length);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
