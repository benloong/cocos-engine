'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const base=path.join(__dirname,'build');
const nativeDir=path.resolve(process.argv[2]||path.join(base,'richtext-gpu-native'));
const webDir=path.join(base,'richtext-gpu-web');
const read=dir=>JSON.parse(fs.readFileSync(path.join(dir,'manifest.json')));
const a=read(nativeDir),b=read(webDir);
const lifecycle=a.text?.lifecycle;
if(!lifecycle?.http?.interrupted||!lifecycle.http.loaded||!lifecycle.http.cachePathResolved||!lifecycle.http.released||!lifecycle.http.cacheRemoved||!lifecycle.http.missingRejected||lifecycle.http.bytes!==223404)throw Error('Incomplete HTTP font lifecycle evidence');
if(!lifecycle||lifecycle.cycles!==1000||lifecycle.cacheHits!==1000||lifecycle.bytesPerLoad!==223404||!lifecycle.assignmentFailureRolledBack||!lifecycle.retrySucceeded||!lifecycle.missingRejected||!lifecycle.deferredDestroyFinished||!Number.isInteger(lifecycle.cacheBefore)||lifecycle.cacheBefore!==lifecycle.cacheAfter)throw Error('Incomplete remote font lifecycle evidence');
const expected=['text-basic','text-bold','text-italic','text-underline','text-outline','text-nested','text-colors','text-wrap-left','text-wrap-center','text-wrap-right','text-multiline','text-unicode'];
if(a.backend!=='native'||b.backend!=='web'||a.snapshot!==b.snapshot||a.snapshot!==require('./graphics-gpu-snapshot.cjs')('richtext').snapshot)throw Error('Stale/source/backend mismatch');
for(const value of [a,b]) {
    if(value.width!==256||value.height!==256||JSON.stringify(value.captures)!==JSON.stringify(expected)||!value.text.loaded||!value.text.released||JSON.stringify(value.text.metrics.map(x=>x.name))!==JSON.stringify(expected))throw Error('Incomplete RichText capture/font lifecycle evidence');
}
if(a.text.nativeBytes!==223404||b.text.nativeBytes!==null)throw Error('Unexpected TTF source size');
if(a.text.raster?.length!==expected.length||a.text.raster.some((row,index)=>row.name!==expected[index]||row.labels.length!==a.text.metrics[index].segments.length||row.labels.some(label=>!(label.opaque>0&&label.width>0&&label.height>0))))throw Error('Native Batcher did not prepare every visible text segment');
const rows=[];
const canonical=value=>typeof value==='number'?Math.fround(value):Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,item])=>[key,canonical(item)])):value;
for(let n=0;n<expected.length;n++) {
    const name=expected[n],actual=fs.readFileSync(path.join(nativeDir,name+'.rgba')),reference=fs.readFileSync(path.join(webDir,name+'.rgba'));
    if(actual.length!==256*256*4||reference.length!==actual.length)throw Error('Invalid RGBA dimensions');
    let max=0,pixels=0,webColored=0,nativeColored=0;
    for(let i=0;i<actual.length;i+=4) {
        let mismatch=false;
        for(let c=0;c<4;c++){const d=Math.abs(actual[i+c]-reference[i+c]);max=Math.max(max,d);if(d>1)mismatch=true;}
        if(mismatch)pixels++;
        if(actual[i]||actual[i+1]||actual[i+2])nativeColored++;
        if(reference[i]||reference[i+1]||reference[i+2])webColored++;
    }
    if(!webColored)throw Error(`Empty Web reference: ${name}`);
    const layoutEqual=JSON.stringify(canonical(a.text.metrics[n]))===JSON.stringify(canonical(b.text.metrics[n]));
    rows.push({name,max,pixels,webColored,nativeColored,layoutEqual,pass:max<=1&&layoutEqual,
        native:a.text.metrics[n],web:b.text.metrics[n],
        nativeSha256:crypto.createHash('sha256').update(actual).digest('hex'),webSha256:crypto.createHash('sha256').update(reference).digest('hex')});
}
const result={snapshot:a.snapshot,font:{source:'tests/fixtures/Thonburi.ttf',sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../../../tests/fixtures/Thonburi.ttf'))).digest('hex'),bytes:a.text.nativeBytes,loaded:true,released:true,lifecycle},environment:{native:a.environment,web:b.environment},pass:rows.every(x=>x.pass),results:rows};
fs.writeFileSync(path.join(base,'richtext-gpu-comparison.json'),JSON.stringify(result,null,2)+'\n');
for(const row of rows)console.log(`${row.pass?'PASS':'FAIL'} ${row.name}: layout=${row.layoutEqual}, max=${row.max}, pixels=${row.pixels}, colored=${row.nativeColored}/${row.webColored}`);
if(!result.pass)process.exitCode=1;
