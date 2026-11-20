'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const project=path.resolve(process.argv[2]||path.join(__dirname,'../../../../cocos-m1-test'));
const configuration = process.argv[3] || 'Debug';
if (!['Debug', 'Release'].includes(configuration)) throw new Error('Expected Debug or Release');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const web=read(path.join(__dirname,'build/bitmap-web-captures/manifest.json')).layoutMetrics;
const nativeCaptures = path.join(project, 'build/windows/proj', configuration, 'm6-bitmap-captures');
const native = read(path.join(nativeCaptures, 'layout-metrics.json'));
if(web.length!==80||native.length!==80)throw Error('Expected 80 layout captures on each backend');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');const captures=[];
for(let i=0;i<web.length;i++){
 const w=web[i],n=native[i];if(w.name!==n.name||w.frameProfile!==n.frameProfile)throw Error('Layout names differ');
 for (const key of ['width', 'height', 'actualFontSize', 'sourceFontSize', 'metadataFontSize',
     'rectX', 'rectY', 'originalWidth', 'originalHeight', 'offsetX', 'offsetY']) {
     if (!Number.isFinite(n[key]) || !Number.isFinite(w[key]) || Math.abs(w[key] - n[key]) > .0001) {
         throw Error(w.name + ' ' + key + ': native ' + n[key] + ', Web ' + w[key]);
     }
 }
 const expected=fs.readFileSync(path.join(__dirname,'build/bitmap-web-captures',w.name+'.rgba'));
 const actual=fs.readFileSync(path.join(nativeCaptures,n.name+'.rgba'));
 if(expected.length!==262144||actual.length!==262144)throw Error('Invalid RGBA size');
 let maxDifference=0,differingChannels=0;for(let at=0;at<actual.length;at++){const delta=Math.abs(actual[at]-expected[at]);maxDifference=Math.max(maxDifference,delta);if(delta)differingChannels++;}
 captures.push({...n,maxDifference,differingChannels,nativeSha256:hash(actual),webSha256:hash(expected)});
 console.log(n.name+': max='+maxDifference+', channels='+differingChannels);
}
const passed=captures.every(c=>c.maxDifference<=1);fs.writeFileSync(path.join(__dirname,configuration === 'Debug' ? 'build/bitmap-layout-comparison.json' : 'build/bitmap-layout-release-comparison.json'),JSON.stringify({tolerance:1,passed,captures},null,2)+'\n');if(!passed)process.exitCode=1;
