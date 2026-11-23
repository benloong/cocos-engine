'use strict';
const path=require('path');
const root=path.resolve(__dirname,'../../..');
process.chdir(root);
require(path.join(root,'scripts/ensure-pal.cjs'))();
const { buildEngine }=require(path.join(root,'node_modules/@cocos/ccbuild'));
const platform=process.argv[2]||'WINDOWS';
const mode=process.argv[3]||'graphics';
if(!['graphics','richtext'].includes(mode))throw new Error('Unknown probe mode');
if(!['WINDOWS','HTML5'].includes(platform)) throw new Error('Unknown probe platform');
const isNative=platform==='WINDOWS';
if (process.argv.length > 4) throw new Error('Expected only a platform and probe mode');
const out=path.join(__dirname,`build/${mode}-gpu-project/build/${isNative?'windows/data/src':'web-mobile'}/cocos-js`);
const features=['base','2d','rich-text','graphics','mask','ui','affine-transform','custom-pipeline','custom-pipeline-builtin-scripts'];
if(!isNative)features.splice(1,0,'gfx-webgl');
buildEngine({
    engine:root,out,
    platform,mode:'BUILD',features,
    flags:{DEBUG:true,NET_MODE:0,SERVER_MODE:false},moduleFormat:'system',compress:false,sourceMap:false,inlineEnum:true,
    nativeCodeBundleMode:'wasm',targets:'chrome 80',
}).then(()=>console.log('M6_GPU_ENGINE_READY')).catch(error=>{console.error(error);process.exitCode=1;});
