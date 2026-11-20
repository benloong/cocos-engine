'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {build}=require('./audit-m6.cjs');
module.exports=function graphicsGpuSnapshot(mode='graphics') {
    const root=path.resolve(__dirname,'../../..');
    const fixture=path.join(__dirname,'fixtures/graphics-gpu');
    const report=build(root),fixtureHashes=[];
    function walk(dir) {
        for(const entry of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
            const file=path.join(dir,entry.name);
            if(entry.isDirectory()) walk(file);
            else fixtureHashes.push([path.relative(fixture,file).replaceAll('\\','/'),crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]);
        }
    }
    walk(fixture);
    for (const file of ['cc.config.json', 'cocos/render-scene/core/material-instance.jsb.ts']) {
        fixtureHashes.push([file, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')]);
    }
    if (mode === 'graphics') {
        walk(path.join(root, 'cocos/2d/assembler/sprite'));
        walk(path.join(root, 'cocos/2d/assembler/label'));
        const atlas = path.join(__dirname,'fixtures/acceptance/resources/M6StaticAtlas');
        walk(atlas);
        for (const file of [atlas+'.meta',path.join(root,'editor/assets/effects/for2d/builtin-sprite-renderer.effect'),
            path.join(root,'editor/assets/effects/for2d/builtin-sprite.effect')]) {
            fixtureHashes.push([path.relative(root,file).replaceAll('\\','/'),crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]);
        }
    }
    fixtureHashes.push(['tests/fixtures/Thonburi.ttf',crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'tests/fixtures/Thonburi.ttf'))).digest('hex')]);
    const snapshot=crypto.createHash('sha256').update(JSON.stringify({mode,files:report.files.map(x=>[x.file,x.sha256]),native:report.nativeSourceHashes,fixture:fixtureHashes})).digest('hex');
    return {snapshot,fixtureHashes};
};
