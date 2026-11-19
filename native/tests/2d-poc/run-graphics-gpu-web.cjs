'use strict';
const fs=require('fs'),path=require('path'),http=require('http');
const { spawn }=require('child_process');
const { createHash } = require('crypto');
const benchmark = process.argv.includes('--perf');
const mode=process.argv.includes('--richtext')?'richtext':'graphics';
const graphicsProbe=['graphics-metrics','graphics-command'].find(name => process.argv.includes('--'+name));
const projectArg = process.argv.find(arg => arg.startsWith('--project='));
const perfProject = projectArg ? projectArg.slice('--project='.length) : 'perf-project-after';
if (!/^perf-project-after(?:-[0-9a-f]{10})?$/.test(perfProject)) throw new Error('Invalid benchmark project');
const root=path.join(__dirname,'build',graphicsProbe?`${graphicsProbe}-web/app`:benchmark?`${perfProject}/build/web-mobile`:`${mode}-gpu-project/build/web-mobile`);
const output=path.join(__dirname,'build',graphicsProbe?`${graphicsProbe}-web/results`:benchmark?'perf-web':`${mode}-gpu-web`);
const chrome=process.env.CC_GPU_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe';
if(!fs.existsSync(path.join(root,'index.html'))) throw new Error('Build the Web fixture first');
fs.mkdirSync(output,{recursive:true});
const interruptedFont = mode === 'richtext' ? require('./font-http-response.cjs')() : null;
const captureSha256 = Object.create(null);
const logs=[];let doneResolve,doneReject;
const done=new Promise((resolve,reject)=>{doneResolve=resolve;doneReject=reject;});
const server=http.createServer(async(req,res)=>{
    try {
        const url=new URL(req.url,'http://localhost');
        if(req.method==='POST') {
            const chunks=[];let length=0;
            for await(const chunk of req) { length+=chunk.length;if(length>262144) throw new Error('Capture too large');chunks.push(chunk); }
            const body=Buffer.concat(chunks);
            if(url.pathname==='/m6-capture') {
                const name=url.searchParams.get('name');
                if(!/^[a-z0-9.-]+$/.test(name)||body.length!==262144) throw new Error('Bad capture');
                if (mode === 'richtext') {
                    if (Object.hasOwn(captureSha256, name)) throw new Error('Duplicate RichText capture: ' + name);
                    captureSha256[name] = createHash('sha256').update(body).digest('hex');
                }
                fs.writeFileSync(path.join(output,name+'.rgba'),body);
            } else if(url.pathname==='/m6-result') {
                const value=JSON.parse(body.toString());if(value.backend!=='web') throw new Error('Bad backend');
                if (mode === 'richtext') {
                    if (JSON.stringify(Object.keys(captureSha256)) !== JSON.stringify(require('./richtext-gpu-cases.cjs').captures)) {
                        throw new Error('Incomplete RichText capture uploads');
                    }
                    value.captureSha256 = captureSha256;
                }
                fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify(value,null,2));doneResolve(value);
            } else throw new Error('Unknown POST');
            res.writeHead(200);res.end('OK');return;
        }
        if(interruptedFont && url.pathname==='/m6-cancel.ttf') { interruptedFont.serveResumable(req,res); return; }
        if(interruptedFont && url.pathname==='/m6-font.ttf') { interruptedFont.serve(req,res); return; }
        if(url.pathname==='/m6-font.ttf') {
            res.writeHead(200,{'Content-Type':'font/ttf'});
            fs.createReadStream(path.join(__dirname,'../../../tests/fixtures/Thonburi.ttf')).pipe(res);return;
        }
        const relative=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);
        const file=path.resolve(root,'.'+relative);
        if(!file.startsWith(path.resolve(root)+path.sep)) { res.writeHead(403);res.end();return; }
        if(!fs.existsSync(file)||!fs.statSync(file).isFile()) { res.writeHead(404);res.end();return; }
        const mime={'.html':'text/html','.js':'application/javascript','.json':'application/json','.wasm':'application/wasm','.png':'image/png'}[path.extname(file)]||'application/octet-stream';
        res.writeHead(200,{'Content-Type':mime});fs.createReadStream(file).pipe(res);
    } catch(error) { res.writeHead(500);res.end(String(error));doneReject(error); }
});
(async()=>{
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const address=`http://127.0.0.1:${server.address().port}`;
    const profile=path.join(__dirname,`build/gpu-browser-${process.pid}`);
    const browser=spawn(chrome,['--headless=new','--no-first-run','--no-default-browser-check','--ignore-gpu-blocklist','--enable-precise-memory-info','--js-flags=--expose-gc','--remote-debugging-port=0','--user-data-dir='+profile,address],{windowsHide:true,stdio:['ignore','ignore','pipe']});
    browser.on('error',doneReject);
    browser.on('exit',(code,signal)=>doneReject(new Error(`Browser exited: ${code}/${signal}`)));
    let socket;
    browser.stderr.on('data',async chunk=>{
        const line=chunk.toString();logs.push(line);
        const found=/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/.exec(line);
        if(!found) return;
        try {
            const pages=await(await fetch(`http://127.0.0.1:${found[1]}/json/list`)).json();
            const page=pages.find(x=>x.type==='page');if(!page) return;
            socket=new WebSocket(page.webSocketDebuggerUrl);
            socket.onopen=()=>socket.send(JSON.stringify({id:1,method:'Runtime.enable'}));
            socket.onmessage=event=>{
                const msg=JSON.parse(event.data);
                if(msg.method==='Runtime.consoleAPICalled') {
                    const text=msg.params.args.map(x=>x.value??x.description??'').join(' ');logs.push(text);
                    if(text.includes('M6_GPU_CAPTURE')||text.includes('M6_SCENE_PROGRESS')) console.log(text);
                    if(text.includes('M6_GPU_FAIL')) doneReject(new Error(text));
                }
                if(msg.method==='Runtime.exceptionThrown') logs.push(JSON.stringify(msg.params.exceptionDetails));
            };
        } catch(error) { logs.push(String(error)); }
    });
    const timeout=setTimeout(()=>doneReject(new Error('Web capture timeout')),180000);
    try { const result=await done;if(interruptedFont && (interruptedFont.requests.interrupted !== 1 || interruptedFont.requests.complete !== 1 || interruptedFont.requests.cancelled !== 1 || interruptedFont.requests.resumed !== 1)) throw new Error('Unexpected Web font transfers: ' + JSON.stringify(interruptedFont.requests));console.log(`M6_GPU_WEB_READY ${result.captures.length}`); }
    finally { if (interruptedFont) console.log('M6_WEB_FONT_REQUESTS ' + JSON.stringify(interruptedFont.requests)); clearTimeout(timeout);socket?.close();browser.kill();server.close();fs.writeFileSync(path.join(output,'console.log'),logs.join('\n')); }
})().catch(error=>{console.error(error);process.exitCode=1;});
