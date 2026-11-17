/* Reproducible declaration and dependency baseline, not a runtime parity verdict. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('typescript');
const ROOT = path.resolve(__dirname, '../../..');
const OUTPUT = 'docs/native-2d-m6.0-baseline.json';
const TESTS = {
    UITransform:['tests/ui/native-2d-m1-shell.test.ts','native/tests/2d-poc/run-m6-layout-tests.ps1','native/tests/2d-poc/compare-graphics-gpu.cjs'],
    RenderRoot2D:['tests/ui/native-render-root-lifecycle.test.ts','native/tests/2d-poc/compare-graphics-gpu.cjs'],
    UIOpacity:['tests/ui/native-2d-m1-shell.test.ts'],
    Sprite:['tests/ui/native-2d-m2-sprite-shell.test.ts','native/tests/2d-poc/run-sprite-quad-parity.ps1','native/tests/2d-poc/run-m6-sprite-api-tests.ps1','native/tests/2d-poc/run-m6-radial-parity.ps1','tests/ui/native-radial-sprite-parity.test.ts'],
    Label:['tests/ui/native-2d-m3-label-shell.test.ts','native/tests/2d-poc/run-m6-layout-tests.ps1','native/tests/2d-poc/run-m3-label-probe.ps1'],
    Mask:['tests/ui/native-2d-m4-mask-shell.test.ts','native/tests/2d-poc/run-m4-mask-probe.ps1','native/tests/2d-poc/run-m6-sprite-api-tests.ps1','tests/ui/mask-stencil-lifecycle.test.ts','native/tests/2d-poc/compare-graphics-gpu.cjs'],
    Graphics:['tests/ui/native-2d-m6-layout-shell.test.ts','native/tests/2d-poc/run-m4-extra-probe.ps1','native/tests/2d-poc/run-m6-graphics-geometry-parity.ps1','tests/ui/native-graphics-geometry-parity.test.ts','native/tests/2d-poc/run-m6-sprite-api-tests.ps1','native/tests/2d-poc/compare-graphics-gpu.cjs'],
    RichText:['native/tests/2d-poc/run-m5-richtext-probe.ps1','native/tests/2d-poc/run-m6-richtext-parser-parity.ps1','tests/ui/native-richtext-parser-parity.test.ts','native/tests/2d-poc/run-m6-richtext-layout-parity.ps1','tests/ui/native-richtext-layout-parity.test.ts','native/tests/2d-poc/run-m6-richtext-runtime-tests.ps1','tests/ui/native-2d-m6-richtext-shell.test.ts','tests/scene-graph/native-node-constructor.test.ts'],
    Font:['tests/assets/native-font-assets.test.ts','native/tests/2d-poc/run-m6-font-assets-tests.ps1'],
    TTFFont:['tests/assets/native-font-assets.test.ts','native/tests/2d-poc/run-m6-font-assets-tests.ps1'],
    BitmapFont:['tests/assets/native-font-assets.test.ts','native/tests/2d-poc/run-m6-font-assets-tests.ps1'],
    LabelAtlas:['tests/assets/native-font-assets.test.ts','native/tests/2d-poc/run-m6-font-assets-tests.ps1'],
    SpriteFrame:['tests/ui/native-2d-m2-sprite-frame-shell.test.ts','native/tests/2d-poc/run-m6-sprite-frame-tests.ps1'],
    SpriteAtlas:['tests/assets/native-sprite-atlas.test.ts','native/tests/2d-poc/run-m6-sprite-atlas-tests.ps1'],
};
const SCOPE = [
    ['UITransform','framework/ui-transform'], ['UIRenderer','framework/ui-renderer'], ['RenderRoot2D','framework/render-root-2d'],
    ['Sprite','components/sprite'], ['Label','components/label'], ['Mask','components/mask'], ['Graphics','components/graphics'],
    ['RichText','components/rich-text'], ['UIOpacity','components/ui-opacity'], ['LabelOutline','components/label-outline'], ['LabelShadow','components/label-shadow'],
    ['Font','assets/font'], ['TTFFont','assets/ttf-font'], ['BitmapFont','assets/bitmap-font'], ['LabelAtlas','assets/label-atlas'],
    ['SpriteFrame','assets/sprite-frame'], ['SpriteAtlas','assets/sprite-atlas'],
];
function parse(file, text) {
    const source=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true);
    if (source.parseDiagnostics.length) throw new Error('Invalid TypeScript: '+file);
    return source;
}
function decorators(node, source) {
    return (ts.canHaveDecorators(node) ? ts.getDecorators(node) || [] : []).map(d => d.expression.getText(source));
}
function declaration(file, text, name) {
    const source = parse(file, text);
    const node = source.statements.find(n => ts.isClassDeclaration(n) && n.name?.text === name);
    if (!node) {
        const alias=source.statements.some(n=>ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>ts.isIdentifier(d.name)&&d.name.text===name));
        if (!alias) throw new Error(file+': missing class or native alias '+name);
        return {kind:'native-alias', members:[], serialized:[]};
    }
    const members = node.members.filter(m => m.name && !ts.isConstructorDeclaration(m)).map(m => ({
        name:m.name.getText(source), kind:ts.SyntaxKind[m.kind],
        visibility:m.modifiers?.some(x => x.kind === ts.SyntaxKind.PrivateKeyword) ? 'private' : m.modifiers?.some(x => x.kind === ts.SyntaxKind.ProtectedKeyword) ? 'protected' : 'public',
        static:!!m.modifiers?.some(x => x.kind === ts.SyntaxKind.StaticKeyword),
        type:m.type?.getText(source) || null,
        parameters:m.parameters?.map(p => p.getText(source)) || [],
        default:m.initializer?.getText(source) || null,
        decorators:decorators(m, source),
    }));
    return {kind:'class', extends:node.heritageClauses?.map(c => c.getText(source)) || [], decorators:decorators(node,source), members,
        serialized:members.filter(m => m.kind === 'PropertyDeclaration' && m.decorators.some(d => /^(serializable|type\(|property\(|string$|integer$|float$|boolean$)/.test(d))).map(m => ({name:m.name, default:m.default, decorators:m.decorators})),
        enums:source.statements.filter(ts.isEnumDeclaration).map(e => ({name:e.name.text, members:e.members.map(m => ({name:m.name.getText(source), value:m.initializer?.getText(source)||null}))})),
    };
}
function runtimeImports(source) {
    return source.statements.flatMap(node => {
        if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) return [];
        if (!node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier) || node.isTypeOnly || node.importClause?.isTypeOnly) return [];
        const clause = node.importClause;
        if (clause && !clause.name && clause.namedBindings && ts.isNamedImports(clause.namedBindings)
            && clause.namedBindings.elements.every(e => e.isTypeOnly)) return [];
        return [node.moduleSpecifier.text];
    });
}
function inspect(file, text) {
    const source = parse(file,text);
    const printer = ts.createPrinter({removeComments:true});
    const code = printer.printFile(source).split('\n').filter(l => l.trim()).length;
    const frameMethods = [], nativeCalls = [], allocations = [], loops = [];
    const location = node => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
    function walk(node) {
        if (ts.isMethodDeclaration(node) && ['update','lateUpdate','_render','updateRenderer','fillBuffers','postUpdateAssembler'].includes(node.name.getText(source))) frameMethods.push({name:node.name.getText(source), line:location(node)});
        if (ts.isCallExpression(node) && /\b(_native|jsb|n2d)\b/.test(node.expression.getText(source))) nativeCalls.push({expression:node.expression.getText(source), line:location(node)});
        if (ts.isNewExpression(node) && /^(Float32Array|Uint16Array|Uint32Array|RenderData|HtmlTextParser)$/.test(node.expression.getText(source))) allocations.push({type:node.expression.getText(source), line:location(node)});
        if (ts.isForStatement(node) || ts.isForOfStatement(node) || ts.isForInStatement(node) || ts.isWhileStatement(node) || ts.isDoStatement(node)) loops.push(location(node));
        ts.forEachChild(node,walk);
    }
    walk(source);
    return {printedCodeLines:code, runtimeImports:runtimeImports(source), frameMethods, nativeCalls, allocations, loops};
}
function build(root = ROOT) {
    const read = file => fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');
    const config = JSON.parse(read('cc.config.json'));
    const overrides = Object.assign({}, ...(config.moduleOverrides || []).filter(e => /NATIVE/.test(e.test || '')).map(e => e.overrides || {}));
    const cache = new Map();
    const analyze = file => { if (!cache.has(file)) cache.set(file, inspect(file,read(file))); return cache.get(file); };
    const resolve = (from, specifier) => {
        if (!specifier.startsWith('.')) return null;
        const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(from),specifier));
        for (const candidate of [resolved, resolved+'.ts',resolved+'/index.ts']) if (fs.existsSync(path.join(root,candidate)) && fs.statSync(path.join(root,candidate)).isFile()) return overrides[candidate] || candidate;
        return null;
    };
    const closure = start => {
        const seen = new Set(), boundaries = new Set(), unresolved = new Set();
        function visit(file) {
            if (seen.has(file)) return;
            seen.add(file);
            for (const specifier of analyze(file).runtimeImports) {
                const resolved = resolve(file,specifier);
                if (!resolved) { unresolved.add(specifier); continue; }
                if (resolved.startsWith('cocos/2d/')) visit(resolved); else boundaries.add(resolved);
            }
        }
        visit(start);
        return {within2d:[...seen].sort(), boundaries:[...boundaries].sort(), unresolved:[...unresolved].sort()};
    };
    const classes = SCOPE.map(([name,suffix]) => {
        const source = `cocos/2d/${suffix}.ts`, runtime = overrides[source] || source;
        const web = declaration(source,read(source),name), native = declaration(runtime,read(runtime),name);
        const graph = closure(runtime);
        const alias = native.kind === 'native-alias';
        const nativeNames = new Set(native.members.map(m => m.name));
        const fields = new Map(native.serialized.map(m => [m.name,m]));
        const testEntrypoints=TESTS[name] || [];
        for (const test of testEntrypoints) if (!fs.existsSync(path.join(root,test))) throw new Error(`Missing test entrypoint: ${test}`);
        return {name, source, runtime, testEntrypoints, overridden:runtime!==source, web, native:runtime===source?{kind:'web-fallback',reference:source}:native,
            comparison:{
                disposition:alias?'native prototype/binding review required':'declarations only; inherited APIs and behavior require review',
                notDeclaredInShell:alias?[]:[...new Set(web.members.filter(m=>m.visibility==='public'&&!nativeNames.has(m.name)).map(m=>m.name))].sort(),
                missingSerializedDeclarations:alias?[]:web.serialized.filter(m=>!fields.has(m.name)).map(m=>m.name),
                initializerTextDifferences:alias?[]:web.serialized.filter(m=>fields.has(m.name)&&fields.get(m.name).default!==m.default).map(m=>({field:m.name,web:m.default,native:fields.get(m.name).default})),
            },
            imports:graph,
            runtimeFindings:graph.within2d.filter(file => { const info=analyze(file); return info.frameMethods.length || info.allocations.length; }),
        };
    });
    const entrypointImports = closure(overrides['cocos/2d/index.ts'] || 'cocos/2d/index.ts');
    const files = [...new Set([...cache.keys(),...classes.map(c=>c.source)])].sort().map(file => ({file, sha256:crypto.createHash('sha256').update(read(file)).digest('hex'), ...analyze(file)}));
    const nativeFiles = [];
    function nativeWalk(dir) {
        for (const item of fs.readdirSync(path.join(root,dir),{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
            const file=dir+'/'+item.name;
            if (item.isDirectory()) nativeWalk(file);
            else if (/\.(h|cpp)$/.test(file)) nativeFiles.push(file);
        }
    }
    nativeWalk('native/cocos/2d');
    nativeFiles.push('native/cocos/base/Log.cpp', 'native/cocos/core/assets/SimpleTexture.cpp');
    nativeFiles.push('native/cocos/platform/win32/modules/CanvasRenderingContext2DDelegate.h','native/cocos/platform/win32/modules/CanvasRenderingContext2DDelegate.cpp','native/cocos/platform/win32/modules/DirectWriteFont.h','native/cocos/platform/win32/modules/DirectWriteFont.cpp');
    nativeFiles.push('native/cocos/platform/interfaces/modules/canvas/ICanvasRenderingContext2D.h','native/cocos/platform/interfaces/modules/canvas/CanvasRenderingContext2D.h','native/cocos/platform/interfaces/modules/canvas/CanvasRenderingContext2D.cpp','native/cocos/bindings/manual/jsb_platform_win32.cpp','native/cocos/bindings/manual/jsb_platform.h');
    nativeFiles.push('cocos/2d/utils/font-loader.ts','cocos/asset/asset-manager/factory.ts');
    nativeFiles.push('native/cocos/core/component/Component.h','native/cocos/core/component/Component.cpp','native/cocos/core/scene-graph/Node.h','native/cocos/core/scene-graph/Node.cpp','native/cocos/core/Root.h','native/cocos/core/Root.cpp');
    nativeFiles.push('native/tools/swig-config/2d.i','native/tools/swig-config/assets.i','cc.config.json','cocos/native-binding/decorators-2d.generated.ts','cocos/render-scene/core/material-instance.jsb.ts','cocos/scene-graph/node.jsb.ts','cocos/serialization/deserialize-dynamic.ts','native/CMakeLists.txt','scripts/compile-native-ts.js');
    const nativeSourceHashes = nativeFiles.sort().map(file=>({file,sha256:crypto.createHash('sha256').update(read(file)).digest('hex')}));
    return {schema:1, nativeSourceHashes, limitations:['Static declarations do not prove runtime/API/visual parity.','Native aliases use Web types; these types are not evidence of bound native methods.','Import traversal stops at non-2d boundaries; dynamic imports and boundary re-entry need separate review.','Printed AST line counts are informational; they do not implement the final deprecated/type exclusions.','Native call sites are not measured per-frame call counts.'],
        native2dOverrides:Object.fromEntries(Object.entries(overrides).filter(([key])=>key.startsWith('cocos/2d/')).sort()), entrypointImports, classes, files};
}
if (require.main === module) {
    const report = build();
    const output = JSON.stringify(report,null,2)+'\n';
    if (process.argv.includes('--write')) fs.writeFileSync(path.join(ROOT,OUTPUT),output);
    if (process.argv.includes('--check')) {
        if (!fs.existsSync(path.join(ROOT,OUTPUT)) || fs.readFileSync(path.join(ROOT,OUTPUT),'utf8').replace(/\r\n/g,'\n')!==output) {
            console.error('M6 declaration baseline is stale: run node native/tests/2d-poc/audit-m6.cjs --write'); process.exitCode=1;
        }
    }
    for (const c of report.classes) console.log(`${c.name}: ${c.overridden?'override':'Web runtime'}, ${c.comparison.missingSerializedDeclarations.length} missing serialized declarations, ${c.comparison.notDeclaredInShell.length} undeclared public APIs`);
    console.log(`${report.classes.length} classes, ${report.files.length} source files; this is an audit baseline, not a passing parity gate.`);
}
module.exports={build, declaration, runtimeImports, inspect, SCOPE, OUTPUT};
