'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('typescript');
const { spawnSync } = require('node:child_process');
const { buildEngine, StatsQuery } = require('@cocos/ccbuild');

const root = path.resolve(__dirname, '../../..');
const output = path.join(__dirname, 'build/feature-matrix');
const features = ['2d', 'rich-text', 'mask', 'graphics'];
const publicNames = ['Sprite', 'RichText', 'Mask', 'Graphics'];

function emittedExports (file) {
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, false, ts.ScriptKind.JS);
    if (source.parseDiagnostics.length) throw new Error('Invalid emitted JS: ' + file);
    const names = new Set();
    function visit (node) {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'exports') {
            const first = node.arguments[0];
            if (first && ts.isStringLiteral(first)) names.add(first.text);
            if (first && ts.isObjectLiteralExpression(first)) {
                for (const property of first.properties) if (property.name) names.add(property.name.text);
            }
        }
        ts.forEachChild(node, visit);
    }
    visit(source);
    return names;
}

async function buildVariant (platform, bits) {
    process.chdir(root);
    require('../../../scripts/ensure-pal.cjs')();
    const selected = features.filter((_, index) => bits & (1 << index));
    const out = path.join(output, platform, String(bits));
    const common = ['base', 'affine-transform', 'custom-pipeline', 'custom-pipeline-builtin-scripts'];
    if (platform === 'HTML5') common.push('gfx-webgl');
    const result = await buildEngine({ engine: root, out, platform, mode: 'BUILD', features: [...common, ...selected],
        flags: { DEBUG: false, NET_MODE: 0, SERVER_MODE: false }, moduleFormat: 'system', compress: false,
        sourceMap: false, inlineEnum: true, nativeCodeBundleMode: 'wasm', targets: 'chrome 80' });
    if (!Object.hasOwn(result.chunkDepGraph, 'cc.js')) throw new Error('Missing engine entry');
    const file = path.join(out, 'cc.js');
    const names = emittedExports(file);
    for (const name of ['NativeUITransformPoc', 'NativeSpritePoc']) {
        if (names.has(name)) throw new Error(platform + '/' + bits + ' exports retired M0 component ' + name);
    }
    const exposed = publicNames.filter(name => names.has(name));
    for (const [index, name] of publicNames.entries()) {
        if (names.has(name) !== selected.includes(features[index])) throw new Error(platform + '/' + bits + ' unexpected export state: ' + name);
    }
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ platform, selected, exposed,
        sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') }));
}

async function main () {
    const query = await StatsQuery.create(root);
    if (query.getFeatureUnits().includes('native-2d-poc')) throw new Error('Retired M0 export entry is available');
    if (process.argv[2]) return buildVariant(process.argv[2], Number(process.argv[3]));
    const results = [];
    for (const platform of ['WINDOWS', 'HTML5']) {
        for (const bits of [0, 1, 3, 5, 7, 9, 11, 13, 15]) {
            const run = spawnSync(process.execPath, [__filename, platform, String(bits)], { stdio: 'inherit' });
            if (run.status !== 0) throw new Error('Feature build failed: ' + platform + '/' + bits);
            results.push(JSON.parse(fs.readFileSync(path.join(output, platform, String(bits), 'result.json'))));
        }
    }
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2) + '\n');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
