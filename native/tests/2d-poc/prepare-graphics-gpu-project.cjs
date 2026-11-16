'use strict';
const fs=require('fs'),path=require('path');
const graphicsGpuSnapshot=require('./graphics-gpu-snapshot.cjs');
const root=path.resolve(__dirname,'../../..');
const project=path.join(__dirname,'build/graphics-gpu-project');
const fixture=path.join(__dirname,'fixtures/graphics-gpu');
const nativeOutput=path.join(__dirname,'build/graphics-gpu-native').replaceAll('\\','/');
fs.mkdirSync(project,{recursive:true});
fs.mkdirSync(path.join(project,'build/windows/data'),{recursive:true});
const assetsLink=path.join(project,'build/windows/assets');
if(!fs.existsSync(assetsLink)) fs.symlinkSync(path.join(project,'build/windows/data'),assetsLink,'junction');
fs.cpSync(fixture,project,{recursive:true});
const packageFile=path.join(project,'package.json');
const manifest=JSON.parse(fs.readFileSync(packageFile,'utf8'));
manifest.name+='-generated';
fs.writeFileSync(packageFile,JSON.stringify(manifest,null,2)+'\n');
const {snapshot,fixtureHashes}=graphicsGpuSnapshot();
fs.writeFileSync(path.join(project,'m6-gpu-snapshot.json'),JSON.stringify({snapshot,fixtureHashes},null,2)+'\n');
const file=path.join(project,'assets/scripts/M6GraphicsGpuProbe.ts');
fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace('__M6_GPU_OUTPUT__',nativeOutput).replace('__M6_GPU_SNAPSHOT__',snapshot));
const common=path.join(project,'native/engine/common');
if(fs.existsSync(common)) {
    fs.writeFileSync(path.join(common,'localCfg.cmake'),`set(COCOS_X_PATH "${root.replaceAll('\\','/')}/native")\n`);
    const game=path.join(common,'Classes/Game.cpp');
    if(fs.existsSync(game)) fs.writeFileSync(game,fs.readFileSync(game,'utf8').replace('"0.0.0.0"','"127.0.0.1"'));
}
console.log(JSON.stringify({project,nativeOutput,snapshot}));
