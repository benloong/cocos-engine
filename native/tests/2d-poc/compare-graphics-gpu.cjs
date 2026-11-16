'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const native=path.resolve(process.argv[2]||path.join(__dirname,'build/graphics-gpu-native'));
const web=path.resolve(process.argv[3]||path.join(__dirname,'build/graphics-gpu-web'));
const a=JSON.parse(fs.readFileSync(path.join(native,'manifest.json'))),b=JSON.parse(fs.readFileSync(path.join(web,'manifest.json')));
if(a.backend!=='native'||b.backend!=='web'||a.snapshot!==b.snapshot||JSON.stringify(a.captures)!==JSON.stringify(b.captures)||a.captures.length!==48) throw new Error('Snapshot/backend/case set mismatch');
const prepared=JSON.parse(fs.readFileSync(path.join(__dirname,'build/graphics-gpu-project/m6-gpu-snapshot.json')));
if(prepared.snapshot!==a.snapshot||new Set(a.captures).size!==48) throw new Error('Stale or duplicate captures');
if(require('./graphics-gpu-snapshot.cjs')().snapshot!==a.snapshot) throw new Error('Sources changed after capture preparation');
if([a,b].some(x=>x.width!==256||x.height!==256)) throw new Error('Unexpected capture dimensions');
if(JSON.stringify(a.hits)!==JSON.stringify(b.hits)||a.hits?.length!==19||new Set(a.hits.map(x=>x.name)).size!==19||a.hits.some(x=>x.actual!==x.expected)) throw new Error('Hit-test expectations/backend results mismatch');
const sanity={
    'fill-rect':6400,'large-local-coordinates':6400,'clear-and-replace':2400,
    'large-mesh-chunks':20000,'mask-rect':6400,'mask-inverted':46400,
    'mask-custom':3500,'mask-empty':52800,'mask-empty-inverted':52800,
    'mask-nested-empty':16800,'mask-multichunk':20000,
    'mask-alpha-0.2':12000,'mask-alpha-0.5':6000,'mask-alpha-0.8':0,
};
const results=[];
for(const name of a.captures) {
    const actual=fs.readFileSync(path.join(native,name+'.rgba')),expected=fs.readFileSync(path.join(web,name+'.rgba'));
    if(actual.length!==262144||expected.length!==262144) throw new Error('Invalid capture size: '+name);
    let max=0,channels=0,pixels=0,colored=0;
    for(let i=0;i<actual.length;i+=4) {
        let different=false;
        for(let c=0;c<4;c++) { const d=Math.abs(actual[i+c]-expected[i+c]);max=Math.max(max,d);if(d>1){channels++;different=true;} }
        if(different) pixels++;
        if(expected[i]||expected[i+1]||expected[i+2]) colored++;
    }
    if(name in sanity && colored!==sanity[name]) throw new Error(`Web sanity failed for ${name}: ${colored} colored pixels, expected ${sanity[name]}`);
    results.push({name,max,pixels,channels,colored,pass:max<=1,
        nativeSha256:crypto.createHash('sha256').update(actual).digest('hex'),
        webSha256:crypto.createHash('sha256').update(expected).digest('hex')});
}
const result={snapshot:a.snapshot,width:a.width,height:a.height,environment:{native:a.environment,web:b.environment},hits:a.hits,tolerance:1,pass:results.every(x=>x.pass),results};
fs.writeFileSync(path.join(__dirname,'build/graphics-gpu-comparison.json'),JSON.stringify(result,null,2));
for(const row of results) console.log(`${row.pass?'PASS':'FAIL'} ${row.name}: max=${row.max}, pixels=${row.pixels}, Web colored=${row.colored}`);
if(!result.pass) process.exitCode=1;
