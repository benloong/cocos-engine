'use strict';
const path=require('path');
const root=path.resolve(__dirname,'../../..');
process.chdir(root);
require(path.join(root,'scripts/ensure-pal.cjs'))();
const { buildEngine }=require(path.join(root,'node_modules/@cocos/ccbuild'));
const platform=process.argv[2]||'WINDOWS';
if(platform!=='WINDOWS') throw new Error('Use CLI for the Web build, with its normal Web feature selection');
buildEngine({
    engine:root,out:path.join(__dirname,'build/graphics-gpu-project/build/windows/data/src/cocos-js'),
    platform,mode:'BUILD',features:['base','2d','graphics','mask','ui','affine-transform','custom-pipeline','custom-pipeline-builtin-scripts'],
    flags:{DEBUG:true,NET_MODE:0,SERVER_MODE:false},moduleFormat:'system',compress:false,sourceMap:false,inlineEnum:true,
    nativeCodeBundleMode:'wasm',targets:'chrome 80',
}).then(()=>console.log('M6_GPU_ENGINE_READY')).catch(error=>{console.error(error);process.exitCode=1;});
