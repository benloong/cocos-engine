'use strict';
const fs=require('fs'),path=require('path');
const graphicsGpuSnapshot=require('./graphics-gpu-snapshot.cjs');
const root=path.resolve(__dirname,'../../..');
const mode=process.argv.includes('--richtext')?'richtext':'graphics';
const project=path.join(__dirname,`build/${mode}-gpu-project`);
const fixture=path.join(__dirname,'fixtures/graphics-gpu');
const nativeOutput=path.join(__dirname,`build/${mode}-gpu-native`).replaceAll('\\','/');
fs.mkdirSync(project,{recursive:true});
fs.mkdirSync(path.join(project,'build/windows/data'),{recursive:true});
const assetsLink=path.join(project,'build/windows/assets');
if(!fs.existsSync(assetsLink)) fs.symlinkSync(path.join(project,'build/windows/data'),assetsLink,'junction');
fs.cpSync(fixture,project,{recursive:true});
if (mode === 'graphics') {
    const atlas = path.join(__dirname, 'fixtures/acceptance/resources/M6StaticAtlas');
    const resources = path.join(project, 'assets/resources');
    fs.mkdirSync(resources, {recursive:true});
    fs.cpSync(atlas, path.join(resources, 'M6StaticAtlas'), {recursive:true});
    fs.copyFileSync(atlas + '.meta', path.join(resources,'M6StaticAtlas.meta'));
    fs.copyFileSync(path.join(root, 'editor/assets/effects/for2d/builtin-sprite-renderer.effect'), path.join(resources,'AtlasMesh.effect'));
    fs.copyFileSync(path.join(root, 'editor/assets/effects/for2d/builtin-sprite.effect'), path.join(resources,'VariantSprite.effect'));
}
// CLI keeps outputName from the supplied config even when --platform differs.
// Use a separate Web config so building Web cannot replace Windows resources.
const webConfig=JSON.parse(fs.readFileSync(path.join(project,'build-config.json'),'utf8'));
webConfig.platform='web-mobile'; webConfig.outputName='web-mobile';
fs.writeFileSync(path.join(project,'build-config-web.json'),JSON.stringify(webConfig,null,2)+'\n');
const packageFile=path.join(project,'package.json');
const manifest=JSON.parse(fs.readFileSync(packageFile,'utf8'));
manifest.name+='-generated';
fs.writeFileSync(packageFile,JSON.stringify(manifest,null,2)+'\n');
const {snapshot,fixtureHashes}=graphicsGpuSnapshot(mode);
fs.writeFileSync(path.join(project,'m6-gpu-snapshot.json'),JSON.stringify({snapshot,fixtureHashes},null,2)+'\n');
const file=path.join(project,'assets/scripts/M6GraphicsGpuProbe.ts');
fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace('__M6_GPU_OUTPUT__',nativeOutput).replace('__M6_GPU_SNAPSHOT__',snapshot).replace('__M6_GPU_MODE__',mode));
const rich=path.join(project,'assets/scripts/M6RichTextMatrix.ts');
fs.writeFileSync(rich,fs.readFileSync(rich,'utf8').replace('__M6_GPU_FONT__',path.join(root,'tests/fixtures/Thonburi.ttf').replaceAll('\\','/')));
const common=path.join(project,'native/engine/common');
fs.mkdirSync(common,{recursive:true});
const diagnostics=mode==='richtext'?'set(CC_2D_FONT_ALIAS_DIAGNOSTICS ON)\n':'';
fs.writeFileSync(path.join(common,'localCfg.cmake'),`set(COCOS_X_PATH "${root.replaceAll('\\','/')}/native")\n${diagnostics}`);
const game=path.join(common,'Classes/Game.cpp');
if(fs.existsSync(game)) fs.writeFileSync(game,fs.readFileSync(game,'utf8').replace('"0.0.0.0"','"127.0.0.1"'));
console.log(JSON.stringify({project,nativeOutput,snapshot}));
