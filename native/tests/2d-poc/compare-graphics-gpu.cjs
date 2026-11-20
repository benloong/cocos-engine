'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const native=path.resolve(process.argv[2]||path.join(__dirname,'build/graphics-gpu-native'));
const web=path.resolve(process.argv[3]||path.join(__dirname,'build/graphics-gpu-web'));
const a=JSON.parse(fs.readFileSync(path.join(native,'manifest.json'))),b=JSON.parse(fs.readFileSync(path.join(web,'manifest.json')));
if(a.backend!=='native'||b.backend!=='web'||a.snapshot!==b.snapshot||JSON.stringify(a.captures)!==JSON.stringify(b.captures)||a.captures.length!==116) throw new Error('Snapshot/backend/case set mismatch');
const prepared=JSON.parse(fs.readFileSync(path.join(__dirname,'build/graphics-gpu-project/m6-gpu-snapshot.json')));
if(prepared.snapshot!==a.snapshot||new Set(a.captures).size!==116) throw new Error('Stale or duplicate captures');
if(require('./graphics-gpu-snapshot.cjs')().snapshot!==a.snapshot) throw new Error('Sources changed after capture preparation');
if([a,b].some(x=>x.width!==256||x.height!==256)) throw new Error('Unexpected capture dimensions');
if(JSON.stringify(a.hits)!==JSON.stringify(b.hits)||a.hits?.length!==22||new Set(a.hits.map(x=>x.name)).size!==22||a.hits.some(x=>x.actual!==x.expected)) throw new Error('Hit-test expectations/backend results mismatch');
if(JSON.stringify(a.roots)!==JSON.stringify(b.roots)||a.roots?.length!==11||new Set(a.roots.map(x=>x.name)).size!==11||a.roots.some(x=>x.actual!==x.expected)) throw new Error('Root registry expectations/backend results mismatch');
if(JSON.stringify(a.scenes)!==JSON.stringify(b.scenes)||a.scenes?.cycles!==1000||a.scenes.assertions!==4998||a.scenes.texturesCreated!==1000||a.scenes.texturesDestroyed!==1000||a.scenes.collections!==10||a.scenes.samples?.length!==5||a.scenes.checks?.length!==19||a.scenes.checks.some(x=>x.actual!==x.expected)) throw new Error('Scene transition/resource expectations/backend results mismatch');
for (const backend of [a, b]) {
    const sizes = backend.shrinkSizes;
    if (sizes?.length !== 8 || !sizes.every(Number.isInteger)
        || sizes[0] !== 8 || sizes[1] !== 32 || sizes[2] !== 8
        || sizes[3] !== 8 || sizes[4] !== 33 || sizes[5] !== 8
        || sizes[6] <= 0 || sizes[6] >= 32 || sizes[7] !== 32) {
        throw new Error('Unexpected Label shrink/restore sizes: ' + JSON.stringify(sizes));
    }
    if (backend.labelLayout?.length !== 8) throw new Error('Incomplete immediate Label layout matrix on ' + backend.backend);
    for (const force of [false, true]) {
        for (const overflow of [0, 1, 2, 3]) {
            const row = backend.labelLayout.find(x => x.force === force && x.overflow === overflow);
            const fixedHeight = overflow === 1 || overflow === 2;
            if (!row || !(row.width > 0 && row.height > 0) || (row.width === 72) !== (overflow !== 0) || (row.height === 80) !== fixedHeight) {
                throw new Error('Unexpected immediate Label bounds: ' + JSON.stringify(row));
            }
            if (force) {
                const ordinary = backend.labelLayout.find(x => !x.force && x.overflow === overflow);
                if (ordinary.width !== row.width || ordinary.height !== row.height) throw new Error('Forced layout changed unchanged text bounds');
            }
        }
    }
    if (backend.batchDrawCalls?.['sprite-batch-1'] !== 1 || backend.batchDrawCalls?.['sprite-batch-128'] !== 1) {
        throw new Error('Expected one draw call for one or 128 adjacent tinted sprites on ' + backend.backend);
    }
}
for (const row of a.labelLayout) {
    const web = b.labelLayout.find(x => x.force === row.force && x.overflow === row.overflow);
    if (Math.abs(row.height - web.height) > 0.001 || Math.abs(row.width - web.width) > 0.001) {
        throw new Error('Label layout bounds differ across platforms: ' + JSON.stringify({native:row,web}));
    }
}
if (!a.shrinkSizes.every((size,index) => size === b.shrinkSizes[index])) throw new Error('Windows and Web resolve different SHRINK font sizes');
const centers={
    'prefab-atlas-sprite':[255,0,0,255],'prefab-atlas-mesh-left':[255,0,0,255],'prefab-atlas-mesh-right':[0,255,0,255],
    'ui-priority-original':[0,0,255,255],'ui-priority-updated':[255,0,0,255],
    'ui-priority-equal':[255,0,0,255],'ui-priority-reparented':[255,0,0,255],
    'root-order-registration':[64,0,128,255],'root-order-reordered':[128,0,64,255],
    'root-first-disabled':[0,0,128,255],'root-first-enabled':[128,0,64,255],
    'root-first-destroyed':[0,0,128,255],'root-both-disabled':[0,0,0,255],
    'root-canvas-pair':[128,64,0,255],'root-canvas-disabled':[128,0,0,255],
    'root-canvas-reenabled':[128,64,0,255],'root-canvas-destroyed':[0,0,0,255],
    'scene-camera-overlay':[64,0,128,255],'scene-camera-priority':[128,0,0,255],
    'scene-camera-layer':[128,0,0,255],'scene-camera-disabled':[128,0,0,255],
    'scene-camera-clear':[0,0,128,255],'scene-camera-swapped':[128,0,64,255],
    'scene-camera-moved':[0,0,128,255],'scene-camera-target-main':[0,0,128,255],
    'scene-camera-target-secondary':[128,0,0,255],'scene-camera-restored':[64,0,128,255],
    'scene-cycle-1':[255,0,0,255],'scene-cycle-250':[0,0,255,255],
    'scene-cycle-500':[0,0,255,255],'scene-cycle-750':[0,0,255,255],
    'scene-cycle-1000':[0,0,255,255],'scene-final-empty':[0,0,0,255],
    'scene-atlas-first':[255,0,0,255],'scene-atlas-second':[0,255,0,255],'scene-atlas-unloaded':[0,0,0,255],
};
for (const name of Object.keys(centers)) {
    if (!a.captures.includes(name)) throw new Error('Missing root or scene transition capture: ' + name);
}
const sanity={
    'prefab-atlas-sprite':1024,'prefab-atlas-mesh-left':4096,'prefab-atlas-mesh-right':1920,
    'sprite-batch-1':64,'sprite-batch-128':8192,
    'sprite-radial-quadrant':1008,'sprite-radial-quadrant-updated':1008,
    'sprite-radial-center':2016,'sprite-radial-center-updated':3024,
    'sprite-radial-empty':0,'sprite-radial-empty-updated':4032,
    'sprite-sliced-resize':4032,'sprite-sliced-resize-updated':160,
    'sprite-sliced-insets':160,'sprite-sliced-insets-updated':160,
    'sprite-sliced-rotated':1344,'sprite-sliced-rotated-updated':48,
    'sprite-tiled-plain':2880,'sprite-tiled-insets':2880,'sprite-tiled-insets-updated':2880,
    'sprite-tiled-compact':2880,'sprite-tiled-compact-updated':128,'sprite-tiled-rotated':864,
    'sprite-tiled-one-axis':2880,'sprite-tiled-no-center':1280,
    'fill-rect':6400,'large-local-coordinates':6400,'clear-and-replace':2400,
    'large-mesh-chunks':20000,'mask-rect':6400,'mask-inverted':46400,
    'mask-custom':3500,'mask-empty':52800,'mask-empty-inverted':52800,
    'mask-nested-empty':16800,'mask-multichunk':20000,
    'mask-ellipse-segments':8000,'mask-ellipse-segments-updated':12560,
    'mask-mixed-frame':12400,'mask-mixed-frame-updated':6400,
    'mask-alpha-0.2':12000,'mask-alpha-0.5':6000,'mask-alpha-0.8':0,
    'mask-independent-thresholds':6400,'mask-independent-thresholds-updated':6400,
};
const geometryCases = ['fill-rect', 'curves', 'ellipse', 'arc', 'round-rect', 'clear-and-replace',
    'sprite-radial-rotated', 'sprite-radial-rotated-updated', 'prefab-atlas-radial', 'prefab-atlas-radial-rotated'];
for (let cap = 0; cap < 3; cap++) {
    for (let join = 0; join < 3; join++) geometryCases.push(`stroke-${cap}-${join}`);
}
for (const name of [...Object.keys(sanity), ...geometryCases]) {
    if (!a.captures.includes(name)) throw new Error('Missing graphics geometry capture: ' + name);
}
const results=[];
for(const name of a.captures) {
    const actual=fs.readFileSync(path.join(native,name+'.rgba')),expected=fs.readFileSync(path.join(web,name+'.rgba'));
    if(actual.length!==262144||expected.length!==262144) throw new Error('Invalid capture size: '+name);
    if(name in centers && centers[name].some((channel,i)=>Math.abs(expected[(128*256+128)*4+i]-channel)>1)) throw new Error('Root blend/order sanity failed: '+name);
    if(name.startsWith('scene-cycle-')&&[0,255,0,255].some((channel,i)=>expected[(128*256+218)*4+i]!==channel)) throw new Error('Persistent renderer sanity failed: '+name);
    if (name === 'mask-mixed-frame' || name === 'mask-mixed-frame-updated') {
        const samples = [[-20, name === 'mask-mixed-frame' ? [0,0,255] : [0,0,0]],
            [24, [0,255,0]], [48, [255,0,0]], [80, [255,255,0]]];
        for (const [x, rgb] of samples) {
            const offset = (128 * 256 + 128 + x) * 4;
            if (rgb.some((channel, i) => expected[offset + i] !== channel)) {
                throw new Error('Mixed scene sample mismatch at x=' + x + ' in ' + name);
            }
        }
    }
    if (name.startsWith('mask-independent-thresholds')) {
        for (const x of [-84, -44, 44, 84]) {
            const red = (x < 0) !== name.endsWith('-updated') ? 255 : 0;
            if (expected[(128 * 256 + 128 + x) * 4] !== red) throw new Error('Stencil threshold mismatch: ' + name + ' at x=' + x);
        }
    }
    let max=0,channels=0,pixels=0,colored=0;
    for(let i=0;i<actual.length;i+=4) {
        let different=false;
        for(let c=0;c<4;c++) { const d=Math.abs(actual[i+c]-expected[i+c]);max=Math.max(max,d);if(d>1){channels++;different=true;} }
        if(different) pixels++;
        if(expected[i]||expected[i+1]||expected[i+2]) colored++;
    }
    if (geometryCases.includes(name) && colored === 0) throw new Error('Empty geometry capture: ' + name);
    if(name in sanity && colored!==sanity[name]) throw new Error(`Web sanity failed for ${name}: ${colored} colored pixels, expected ${sanity[name]}`);
    results.push({name,max,pixels,channels,colored,pass:max<=1,
        nativeSha256:crypto.createHash('sha256').update(actual).digest('hex'),
        webSha256:crypto.createHash('sha256').update(expected).digest('hex')});
}
const result={snapshot:a.snapshot,width:a.width,height:a.height,environment:{native:a.environment,web:b.environment},scenes:a.scenes,roots:a.roots,hits:a.hits,labelLayout:{native:a.labelLayout,web:b.labelLayout},shrinkSizes:{native:a.shrinkSizes,web:b.shrinkSizes},batchDrawCalls:{native:a.batchDrawCalls,web:b.batchDrawCalls},tolerance:1,pass:results.every(x=>x.pass),results};
for (const name of ['sprite-radial-quadrant', 'sprite-radial-rotated']) {
    const original = results.find(row => row.name === name);
    const updated = results.find(row => row.name === name + '-updated');
    if (original.webSha256 !== updated.webSha256 || original.nativeSha256 !== updated.nativeSha256) {
        throw new Error('Expected equivalent radial images before and after update: ' + name);
    }
}
const slicedBefore = results.find(row => row.name === 'sprite-sliced-insets');
const slicedAfter = results.find(row => row.name === 'sprite-sliced-insets-updated');
const slicedResized = results.find(row => row.name === 'sprite-sliced-resize-updated');
if (slicedResized.webSha256 !== slicedBefore.webSha256 || slicedResized.nativeSha256 !== slicedBefore.nativeSha256) {
    throw new Error('Resizing a sliced Sprite must match constructing it at the smaller size');
}
if (slicedBefore.webSha256 === slicedAfter.webSha256) throw new Error('Sliced inset update did not change its Web image');
const tiledBefore = results.find(row => row.name === 'sprite-tiled-insets');
const tiledAfter = results.find(row => row.name === 'sprite-tiled-insets-updated');
const tiledResized = results.find(row => row.name === 'sprite-tiled-compact');
if (tiledBefore.webSha256 !== tiledResized.webSha256 || tiledBefore.nativeSha256 !== tiledResized.nativeSha256) {
    throw new Error('Equivalent tiled sprites must have the same initial image');
}
if (tiledBefore.webSha256 === tiledAfter.webSha256 || tiledBefore.nativeSha256 === tiledAfter.nativeSha256) {
    throw new Error('Tiled inset update did not change both images');
}
fs.writeFileSync(path.join(__dirname,'build/graphics-gpu-comparison.json'),JSON.stringify(result,null,2));
for(const row of results) console.log(`${row.pass?'PASS':'FAIL'} ${row.name}: max=${row.max}, pixels=${row.pixels}, Web colored=${row.colored}`);
if(!result.pass) process.exitCode=1;
