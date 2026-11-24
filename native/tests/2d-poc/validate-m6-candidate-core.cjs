/* Validate current Native captures against the retained Native core baseline. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function check(value,message){if(!value)throw new Error(message);}
const [current,reference]=process.argv.slice(2).map(p=>path.resolve(p));
if(!current||!reference)throw new Error('Usage: node validate-m6-candidate-core.cjs <run-root> <reference-root>');
const expected=read(path.join(reference,'core-validation.json')).expectedCaptures;
const pixels=read(path.join(reference,'native-pixel-expectations.json'));
const rows=[];
for(const config of ['Debug','Release']){
 const dir=path.join(current,'core-'+config),base=path.join(reference,'gpu-'+config,'captures');
 const m=read(path.join(dir,'captures/manifest.json')),r=read(path.join(base,'manifest.json'));
 check(m.backend==='native'&&m.spriteImplementation==='native'&&m.labelImplementation==='native'&&m.graphicsMaskImplementation==='native','Native implementation required');
 check(JSON.stringify(m.captures)===JSON.stringify(expected),'Core capture scope differs');
 check(m.hits.length===22&&m.roots.length===11&&m.scenes.cycles===1000&&m.scenes.assertions===4998,'Incomplete matrix');
 for(const c of [...m.hits,...m.roots,...m.scenes.checks])check(JSON.stringify(c.actual)===JSON.stringify(c.expected),'Scene check failed: '+c.name);
 const lifecycle=read(path.join(dir,'lifecycle.json'));check(lifecycle.passed&&lifecycle.checks.length>=20&&lifecycle.checks.every(c=>c.passed),'Incomplete lifecycle application checks');
 const images=[];let centers=0,areas=0;
 for(const name of expected){
  const a=fs.readFileSync(path.join(dir,'captures',name+'.rgba')),b=fs.readFileSync(path.join(base,name+'.rgba'));
  const hash=sha(a);if(m.captureSha256)check(hash===m.captureSha256[name],'Capture checksum mismatch: '+name);check(sha(b)===r.captureSha256[name],'Reference checksum mismatch: '+name);
  check(a.length===256*256*4&&a.length===b.length,'Invalid RGBA size');let max=0,colored=0;
  for(let i=0;i<a.length;i++){max=Math.max(max,Math.abs(a[i]-b[i]));if(i%4===0&&(a[i]||a[i+1]||a[i+2]))colored++;}
  check(max<=1,'Native pixel regression: '+name+' max='+max);
  if(pixels.centers[name]){check(pixels.centers[name].every((v,i)=>Math.abs(a[(128*256+128)*4+i]-v)<=1),'Center mismatch: '+name);centers++;}
  if(name in pixels.sanity){check(colored===pixels.sanity[name],'Colored area mismatch: '+name);areas++;}
  images.push({name,sha256:hash,referenceSha256:sha(b),maxDifference:max});
 }
 rows.push({configuration:config,captures:images.length,centers,areas,hits:m.hits.length,roots:m.roots.length,sceneCycles:m.scenes.cycles,sceneAssertions:m.scenes.assertions,lifecycleChecks:lifecycle.checks.length,images});
}
check(rows[0].images.every((x,i)=>x.sha256===rows[1].images[i].sha256),'Debug/Release images differ');
const report={passed:true,tolerance:1,candidateHashSource:'post-run SHA-256; runtime manifest hashes checked when present',reference,configurations:rows};
fs.writeFileSync(path.join(current,'validation.json'),JSON.stringify(report,null,2)+'\n');
console.log('M6_CANDIDATE_CORE_VALIDATED '+JSON.stringify(rows.map(({images,...r})=>r)));
