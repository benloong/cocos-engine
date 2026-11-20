'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const base=path.join(__dirname,'build');
const args = process.argv.slice(2);
const m6Gate = args.includes('--m6-gate');
const captureDirs = args.filter(arg => arg !== '--m6-gate');
if (captureDirs.length > 2 || captureDirs.some(arg => arg.startsWith('--'))) {
    throw Error('Usage: compare-richtext-gpu.cjs [--m6-gate] [native capture directory] [web capture directory]');
}
const nativeDir=path.resolve(captureDirs[0]||path.join(base,'richtext-gpu-native'));
const webDir=path.resolve(captureDirs[1]||path.join(base,'richtext-gpu-web'));
const read=dir=>JSON.parse(fs.readFileSync(path.join(dir,'manifest.json')));
const a=read(nativeDir),b=read(webDir);
if (!/^[0-9a-f]{64}$/.test(a.executableSha256)) throw Error('Missing native executable hash');
const lifecycle=a.text?.lifecycle;
if(!lifecycle?.http?.interrupted||!lifecycle.http.loaded||!lifecycle.http.cachePathResolved||!lifecycle.http.released||!lifecycle.http.cacheRemoved||!lifecycle.http.missingRejected||!lifecycle.http.failedFilesRemoved||!lifecycle.http.cancelledAndResumed||lifecycle.http.bytes!==223404)throw Error('Incomplete HTTP font lifecycle evidence');
if(!lifecycle||lifecycle.cycles!==1000||lifecycle.cacheHits!==1000||lifecycle.bytesPerLoad!==223404||!lifecycle.assignmentFailureRolledBack||!lifecycle.retrySucceeded||!lifecycle.missingRejected||!lifecycle.deferredDestroyFinished||!Number.isInteger(lifecycle.cacheBefore)||lifecycle.cacheBefore!==lifecycle.cacheAfter)throw Error('Incomplete remote font lifecycle evidence');
const { wordWrapNames, richTextNames, shadowNames, captures } = require('./richtext-gpu-cases.cjs');
if(a.backend!=='native'||b.backend!=='web'||a.snapshot!==b.snapshot||a.snapshot!==require('./graphics-gpu-snapshot.cjs')('richtext').snapshot)throw Error('Stale/source/backend mismatch');
const expectedWrap = [
    [1, 74, 110, 24], [2, 74, 110, 25], [3, 74, 67.8, 24],
    [3, 120, 127.8, 24], [3, 74, 157.8, 24], [3, 62, 127.8, 24], [3, 116, 127.8, 24],
];
for(const value of [a,b]) {
    const interaction = value.text.interaction;
    if (!interaction?.sameWithShadowTag || !interaction.repainted || !interaction.destroyed
        || interaction.widths?.join() !== '160,96' || interaction.calls?.join() !== 'first,second') {
        throw Error('Incomplete styled RichText interaction: ' + value.backend);
    }
    const wordWrap = value.text.labelWordWrap;
    if (JSON.stringify(wordWrap?.map(row => row.name)) !== JSON.stringify(wordWrapNames)
        || wordWrap.some(({ overflow, width, height, fontSize }, index) => {
            const [expectedOverflow, expectedWidth, expectedHeight, expectedSize] = expectedWrap[index];
            return overflow !== expectedOverflow || width !== expectedWidth || !Number.isFinite(height)
                || Math.abs(height - expectedHeight) > 0.001 || fontSize !== expectedSize;
        })) {
        throw Error('Incomplete TTF Label word wrap: ' + value.backend);
    }
    if (JSON.stringify(value.text.shadowLayout?.map(row=>row.name)) !== JSON.stringify(shadowNames)) throw Error('Incomplete Label shadow layouts');
    const coverage = value.text.hardShadowCoverage;
    const centers = value.text.blurredShadowCenters;
    if (!Array.isArray(centers) || centers.length !== 2 || centers.some(({sign, dx, dy}, i) =>
        sign !== (i === 0 ? 1 : -1) || !Number.isFinite(dx) || !Number.isFinite(dy) || Math.abs(dx) > 1 || Math.abs(dy) > 1)) {
        throw Error('Missing or misplaced blurred shadow: ' + value.backend);
    }
    if (!Array.isArray(coverage) || coverage.length !== 2 || coverage.some(count => !Number.isInteger(count) || count <= 0)) {
        throw Error('Missing positive and negative hard shadow GPU checks: ' + value.backend);
    }
    if(value.width!==256||value.height!==256||JSON.stringify(value.captures)!==JSON.stringify(captures)||!value.text.loaded||!value.text.released||JSON.stringify(value.text.metrics.map(x=>x.name))!==JSON.stringify(richTextNames))throw Error('Incomplete RichText capture/font lifecycle evidence');
}
if(a.text.nativeBytes!==223404||b.text.nativeBytes!==null)throw Error('Unexpected TTF source size');
if(a.text.raster?.length!==richTextNames.length||a.text.raster.some((row,index)=>row.name!==richTextNames[index]||!row.visible))throw Error('Native Batcher did not render every RichText case');
const rows=[];
// Web RichText treats shadow as an unknown tag and retains the nested color spans.
for (const [dir,manifest] of [[nativeDir,a],[webDir,b]]) {
    const bytes = name => fs.readFileSync(path.join(dir,name+'.rgba'));
    if (!bytes('text-bidi-override').equals(bytes('text-bidi-visual'))) throw Error('RTL override differs from its visual order: '+dir);
    if (!bytes('text-shadow-tag').equals(bytes('text-colors'))) throw Error('RichText shadow tag changed the colored control image: '+dir);
    const [control, edited] = ['text-colors','text-shadow-tag'].map(name=>manifest.text.metrics.find(row=>row.name===name));
    if (control.width!==edited.width || control.height!==edited.height || JSON.stringify(control.segments)!==JSON.stringify(edited.segments)) {
        throw Error('RichText edit did not restore the control layout: '+dir);
    }
}
const canonical=value=>typeof value==='number'?Math.fround(value):Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,item])=>[key,canonical(item)])):value;
function shadowCoverage(bytes, width) {
    let pixels = 0, minX = width, maxX = -1;
    for (let i = 0; i < bytes.length; i += 4) {
        if (bytes[i + 1] <= bytes[i]) continue;
        const x = (i / 4) % width;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        ++pixels;
    }
    return { pixels, minX, maxX };
}
const nativeMetrics = a.text.labelWordWrap.concat(a.text.metrics, a.text.shadowLayout);
const webMetrics = b.text.labelWordWrap.concat(b.text.metrics, b.text.shadowLayout);
for(let n=0;n<captures.length;n++) {
    const name=captures[n],actual=fs.readFileSync(path.join(nativeDir,name+'.rgba')),reference=fs.readFileSync(path.join(webDir,name+'.rgba'));
    if(actual.length!==256*256*4||reference.length!==actual.length)throw Error('Invalid RGBA dimensions');
    const nativeSha256 = crypto.createHash('sha256').update(actual).digest('hex');
    const webSha256 = crypto.createHash('sha256').update(reference).digest('hex');
    if (nativeSha256 !== a.captureSha256?.[name]) throw Error('Native capture hash mismatch: ' + name);
    if (webSha256 !== b.captureSha256?.[name]) throw Error('Web capture hash mismatch: ' + name);
    let pixels=0,webColored=0,nativeColored=0;
    const differingPixelsByChannel = [0, 0, 0, 0];
    const maxByChannel = [0, 0, 0, 0];
    for(let i=0;i<actual.length;i+=4) {
        let mismatch=false;
        for (let c = 0; c < 4; c++) {
            const difference = Math.abs(actual[i+c] - reference[i+c]);
            maxByChannel[c] = Math.max(maxByChannel[c], difference);
            if (difference > 1) {
                differingPixelsByChannel[c]++;
                mismatch = true;
            }
        }
        if(mismatch)pixels++;
        if(actual[i]||actual[i+1]||actual[i+2])nativeColored++;
        if(reference[i]||reference[i+1]||reference[i+2])webColored++;
    }
    const max = Math.max(...maxByChannel);
    if(!webColored)throw Error(`Empty Web reference: ${name}`);
    const layoutEqual=JSON.stringify(canonical(nativeMetrics[n]))===JSON.stringify(canonical(webMetrics[n]));
    const row = {name,max,pixels,webColored,nativeColored,layoutEqual,pass:max<=1&&layoutEqual,
        native:nativeMetrics[n],web:webMetrics[n],
        nativeSha256,webSha256,differingPixelsByChannel,maxByChannel};
    if (name.startsWith('label-shadow-blur-')) {
        row.shadowCoverage = { native: shadowCoverage(actual, a.width), web: shadowCoverage(reference, b.width) };
        for (const [backend, coverage] of Object.entries(row.shadowCoverage)) {
            if (!coverage.pixels) throw Error('Missing blurred shadow: ' + backend + '/' + name);
            const halfWidth = row[backend].textureWidth / 2;
            if ((name.endsWith('clipped-negative') && coverage.minX !== a.width / 2 - halfWidth)
                || (name.endsWith('clipped-positive') && coverage.maxX !== a.width / 2 + halfWidth - 1)) {
                throw Error('Shadow does not reach the clip edge: ' + backend + '/' + name);
            }
        }
    }
    rows.push(row);
}
const result={snapshot:a.snapshot,font:{source:'tests/fixtures/Thonburi.ttf',sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../../../tests/fixtures/Thonburi.ttf'))).digest('hex'),bytes:a.text.nativeBytes,loaded:true,released:true,lifecycle},environment:{native:a.environment,web:b.environment},interaction:{native:a.text.interaction,web:b.text.interaction},pass:rows.every(x=>x.pass),results:rows};
result.executableSha256 = a.executableSha256;
const deferredPixels = new Set();
if (m6Gate) {
    const permitted = new Set(['text-bold', 'text-outline', 'text-nested']);
    for (const row of rows) {
        if (permitted.has(row.name) && row.layoutEqual && !row.pass) deferredPixels.add(row.name);
    }
    result.m6Gate = {
        pass: rows.every(row => row.pass || deferredPixels.has(row.name)),
        deferredPixels: [...deferredPixels],
    };
}
fs.writeFileSync(path.join(base,'richtext-gpu-comparison.json'),JSON.stringify(result,null,2)+'\n');
for (const row of rows) {
    const status = row.pass ? 'PASS' : deferredPixels.has(row.name) ? 'DEFER' : 'FAIL';
    console.log(`${status} ${row.name}: layout=${row.layoutEqual}, max=${row.max}, pixels=${row.pixels}, colored=${row.nativeColored}/${row.webColored}`);
}
if (!(result.m6Gate?.pass ?? result.pass)) process.exitCode = 1;
