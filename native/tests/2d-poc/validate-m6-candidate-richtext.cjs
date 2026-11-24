'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const check=(ok,message)=>{if(!ok)throw new Error(message);};
const [current,reference]=process.argv.slice(2).map(p=>path.resolve(p));
if(!current||!reference)throw new Error('Usage: node validate-m6-candidate-richtext.cjs <candidate-root> <reference-root>');
const rows=[];
for(const config of ['Debug','Release']){
 const stage=path.join(current,'richtext-'+config),capture=path.join(stage,'tools/build/richtext-gpu-native');
 const old=path.join(reference,'richtext-'+config,'tools/build/richtext-gpu-native');
 const m=read(path.join(capture,'manifest.json')),r=read(path.join(old,'manifest.json')),t=m.text;
 check(m.backend==='native'&&m.captures.length===62&&JSON.stringify(m.captures)===JSON.stringify(r.captures),'Incomplete Native RichText matrix');
 check(t.loaded&&t.released&&t.nativeBytes===223404&&t.lifecycle.cycles===1000&&t.lifecycle.cacheHits===1000,'Incomplete font lifecycle');
 const life=t.lifecycle;
 for(const key of ['assignmentFailureRolledBack','retrySucceeded','missingRejected','deferredDestroyFinished'])check(life[key],'Font lifecycle failed: '+key);
 check(life.cacheBefore===life.cacheAfter,'Font asset cache not restored');
 for(const [key,value] of Object.entries(life.http))if(typeof value==='boolean')check(value,'HTTP asset state failed: '+key);
 for(const key of ['metrics','raster','labelWordWrap','fractionalFontWidths','hardShadowCoverage','blurredShadowCenters','shadowLayout','interaction','activation','anchorDuringAttach','projectedInput']) {
  check(JSON.stringify(t[key])===JSON.stringify(r.text[key]),'Native layout/behavior differs: '+key);
 }
 check(t.prefab.implementation==='native'&&t.prefab.restoredPixels,'Native Prefab contract failed');
 check(t.segmentLifecycle.cycles===32&&t.segmentLifecycle.eventPairs===4224&&t.segmentLifecycle.ownerReleased,'Segment lifecycle incomplete');
 check(t.retiredNodes.cycles===64&&t.retiredNodes.retained===0&&t.retiredNodes.atlasReleased,'Retired Node ownership incomplete');
 check(t.collectedWrappers.cycles===4&&t.collectedWrappers.collected===8&&t.fontAliasSources.released===4,'Wrapper/alias cleanup incomplete');
 const h=read(path.join(stage,'font-handles.json'));
 check(h.exclusiveReadControl&&h.samples.length===11&&h.samples.every(x=>x.exclusiveRead),'Exclusive font handle checks incomplete');
 check(h.samples.at(-1).gdiObjects===h.samples[0].gdiObjects,'GDI object count did not return to baseline');
 const requests=read(path.join(stage,'tools/build/font-http-normal-requests.json'));
 check(requests.font.complete===31&&requests.font.interrupted===1&&requests.font.cancelled===1&&requests.font.resumed===1,'HTTP transfer counters differ');
 check(requests.aliases.a===1&&requests.aliases.b===1&&requests.queued===0&&requests.missing===6,'HTTP alias/cancel/404 matrix incomplete');
 const images=[];
 for(const name of m.captures){
  const a=fs.readFileSync(path.join(capture,name+'.rgba')),b=fs.readFileSync(path.join(old,name+'.rgba'));
  check(a.length===262144&&b.length===a.length,'Invalid RGBA size');
  check(sha(a)===m.captureSha256[name]&&sha(b)===r.captureSha256[name],'Capture SHA mismatch: '+name);
  let max=0;for(let i=0;i<a.length;i++)max=Math.max(max,Math.abs(a[i]-b[i]));
  check(max<=1,'Native pixel regression: '+name);
  images.push({name,sha256:sha(a),referenceSha256:sha(b),maxDifference:max});
 }
 rows.push({configuration:config,captures:images.length,layoutCases:t.metrics.length,fontCycles:life.cycles,cacheBefore:life.cacheBefore,cacheAfter:life.cacheAfter,requests,handleSamples:h.samples,images});
}
check(rows[0].images.every((x,i)=>x.sha256===rows[1].images[i].sha256),'Debug/Release RichText images differ');
fs.writeFileSync(path.join(current,'validation.json'),JSON.stringify({passed:true,tolerance:1,configurations:rows},null,2)+'\n');
console.log('M6_CANDIDATE_RICHTEXT_VALIDATED '+JSON.stringify(rows.map(({images,handleSamples,...r})=>r)));
