'use strict';
const fs = require('node:fs');
const path = require('node:path');

const repo = path.resolve(__dirname, '../../..');
const args = process.argv.slice(2);
const alternateProbes = new Map([
    ['--render-root', { name: 'old-render-root', fixture: 'OldRenderRootProbe.ts' }],
    ['--graphics-m4', { name: 'm6-graphics-old', fixture: null }],
]);
const alternateProbe = alternateProbes.get(args[0]);
const { name, fixture } = alternateProbe ?? { name: 'old-ui-opacity', fixture: 'OldUIOpacityProbe.ts' };
const project = path.join(__dirname, 'build', `${name}-project`);
const arg = args[alternateProbe ? 1 : 0];
const bundles = ['--build-default', '--build-web'];
if (arg === '--build-fallback') throw new Error('Component TS rollback is no longer supported');

if (bundles.includes(arg)) {
    const compile = JSON.parse(fs.readFileSync(path.join(project, 'build/windows/cocos.compile.config.json'), 'utf8')).buildEngineParam;
    const web = arg === '--build-web';
    const output = web ? path.join(project, 'build/web-mobile/cocos-js') : compile.output;
    require(path.join(repo, 'scripts/ensure-pal.cjs'))();
    const { buildEngine } = require(path.join(repo, 'node_modules/@cocos/ccbuild'));
    buildEngine({
        engine: repo,
        out: output,
        platform: web ? 'HTML5' : compile.platformType,
        mode: 'BUILD',
        features: compile.includeModules,
        flags: compile.flags,
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
    if (fixture) {
        fs.copyFileSync(path.join(__dirname, 'fixtures/acceptance', fixture), path.join(project, 'assets/scripts/M1Test.ts'));
    } else {
        // MSBuild's SWIG command changes directory to the engine root. Use the
        // physical checkout so it can start in a workspace with path restrictions.
        const engine = fs.realpathSync.native(path.join(repo, 'native')).replaceAll('\\', '/');
        const local = 'native/engine/common/localCfg.cmake';
        const original = path.join(source, local);
        const config = fs.existsSync(original) ? fs.readFileSync(original, 'utf8').trimEnd() + '\n' : '';
        fs.writeFileSync(path.join(project, local), `${config}set(COCOS_X_PATH "${engine}")\n`);
    }
    const config = JSON.parse(fs.readFileSync(path.join(source, 'm1-build-config.json'), 'utf8'));
    for (const platform of ['windows', 'web-mobile']) {
        const output = { ...config, platform, outputName: platform };
        fs.writeFileSync(path.join(project, `build-${platform}.json`), JSON.stringify(output, null, 2) + '\n');
    }
    console.log(project);
}
