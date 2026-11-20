'use strict';
const fs = require('node:fs');
const path = require('node:path');

const repo = path.resolve(__dirname, '../../..');
const args = process.argv.slice(2);
const rootProbe = args[0] === '--render-root';
const name = rootProbe ? 'old-render-root' : 'old-ui-opacity';
const project = path.join(__dirname, 'build', `${name}-project`);
const arg = args[rootProbe ? 1 : 0];
const bundles = ['--build-default', '--build-fallback', '--build-web'];

if (bundles.includes(arg)) {
    const compile = JSON.parse(fs.readFileSync(path.join(project, 'build/windows/cocos.compile.config.json'), 'utf8')).buildEngineParam;
    const fallback = arg === '--build-fallback';
    const web = arg === '--build-web';
    const output = web ? path.join(project, 'build/web-mobile/cocos-js') : compile.output;
    require(path.join(repo, 'scripts/ensure-pal.cjs'))();
    const { buildEngine } = require(path.join(repo, 'node_modules/@cocos/ccbuild'));
    buildEngine({
        engine: repo,
        out: fallback ? path.join(__dirname, 'build', `${name}-fallback`) : output,
        platform: web ? 'HTML5' : compile.platformType,
        mode: 'BUILD',
        features: compile.includeModules,
        flags: { ...compile.flags, ...(fallback ? { [rootProbe ? 'USE_JS_RENDER_ROOT_2D' : 'USE_JS_UI_OPACITY']: true } : {}) },
        moduleFormat: 'system',
        compress: !compile.debug,
        sourceMap: compile.sourceMaps,
        inlineEnum: compile.inlineEnum,
        nativeCodeBundleMode: compile.nativeCodeBundleMode,
        targets: compile.targets,
    }).then(() => {
        process.stdout.write('M6_OLD_UI_ENGINE_READY\n', () => process.exit(0));
    }).catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
} else {
    const source = path.resolve(arg || path.join(repo, '../cocos-m1-test'));
    if (!fs.existsSync(path.join(source, 'assets/resources/M1Prefab.prefab'))) throw new Error('Original cocos-m1-test project not found');
    fs.mkdirSync(project, { recursive: true });
    for (const name of ['assets', 'assets.meta', 'settings', 'native', 'package.json', 'tsconfig.json']) {
        fs.cpSync(path.join(source, name), path.join(project, name), { recursive: true });
    }
    const fixture = rootProbe ? 'OldRenderRootProbe.ts' : 'OldUIOpacityProbe.ts';
    fs.copyFileSync(path.join(__dirname, 'fixtures/acceptance', fixture), path.join(project, 'assets/scripts/M1Test.ts'));
    const config = JSON.parse(fs.readFileSync(path.join(source, 'm1-build-config.json'), 'utf8'));
    for (const platform of ['windows', 'web-mobile']) {
        const output = { ...config, platform, outputName: platform };
        fs.writeFileSync(path.join(project, `build-${platform}.json`), JSON.stringify(output, null, 2) + '\n');
    }
    console.log(project);
}
