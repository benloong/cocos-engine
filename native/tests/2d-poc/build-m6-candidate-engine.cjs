/* Build and fingerprint a clean Windows Native candidate without touching Web outputs. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const {buildEngine} = require('@cocos/ccbuild');
const {readRollupStats, rendered2DModules, assertNoWebAssemblers} = require('./audit-windows-bundle.cjs');
async function main() {
    if (process.argv.length !== 4) throw new Error('Usage: node build-m6-candidate-engine.cjs <clean-engine> <new-output>');
    const engine = path.resolve(process.argv[2]), out = path.resolve(process.argv[3]);
    const git = (...args) => execFileSync('git', ['-C',engine,...args], {encoding:'utf8'}).trim();
    if (git('status','--porcelain')) throw new Error('Candidate source must be clean');
    if (fs.existsSync(out)) throw new Error('Candidate engine output must be new');
    const revision = git('rev-parse','HEAD');
    const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    process.chdir(engine);
    require(path.join(engine,'scripts/ensure-pal.cjs'))();
    const options = {
        engine, out, mode:'BUILD', platform:'WINDOWS',
        features:['base','2d','rich-text','graphics','mask','ui','affine-transform','custom-pipeline','custom-pipeline-builtin-scripts'],
        flags:{DEBUG:true,LOAD_BULLET_MANUALLY:false,NET_MODE:0,SERVER_MODE:false},
        moduleFormat:'system', compress:false, sourceMap:false, inlineEnum:true,
        nativeCodeBundleMode:'wasm', targets:'chrome 80', visualize:{file:path.join(out,'modules.html')},
    };
    const result = await buildEngine(options);
    const stats = readRollupStats(options.visualize.file);
    const modules = rendered2DModules(stats);
    assertNoWebAssemblers(modules);
    for (const name of ['sprite','label','mask','graphics']) {
        if (!modules.some(m=>m.bytes>0 && m.id.endsWith('/'+name+'.jsb.ts'))) throw new Error('Missing Native override: '+name);
    }
    const sourceHashes = {};
    for (const meta of Object.values(stats.nodeMetas)) {
        // Rollup visualizer makes Windows IDs root-relative (e.g. \cocos\...).
        const file = /^[A-Za-z]:/.test(meta.id) ? meta.id : path.resolve(engine,meta.id.replace(/^[\\/]+/, ''));
        if (fs.existsSync(file) && fs.statSync(file).isFile()) {
            sourceHashes[path.relative(engine,file).replaceAll('\\','/')] = hash(file);
        }
    }
    for (const name of ['label','mask','graphics']) if (!sourceHashes['cocos/2d/components/'+name+'.jsb.ts']) throw new Error('Missing source fingerprint: '+name);
    const chunks = Object.fromEntries(Object.keys(result.chunkDepGraph).map(file=>[file,hash(path.join(out,file))]));
    if (!chunks['cc.js']) throw new Error('Missing cc.js');
    if (git('rev-parse','HEAD')!==revision || git('status','--porcelain')) throw new Error('Candidate source changed during build');
    fs.writeFileSync(path.join(out,'candidate-engine.json'),JSON.stringify({revision,options,chunks,modules,sourceHashes},null,2)+'\n');
    console.log('M6_CANDIDATE_ENGINE_PASS '+JSON.stringify({revision,chunks,modules:modules.length,sourceFiles:Object.keys(sourceHashes).length}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
