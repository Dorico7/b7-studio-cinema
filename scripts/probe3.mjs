import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root='/home/ubuntu/b7-studio-cinema'; const dist=path.join(root,'dist');
const srv=http.createServer((q,s)=>{const u=decodeURIComponent(q.url.split('?')[0]);const f=path.join(dist,u==='/'?'index.html':u);if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end();}s.writeHead(200,{'Content-Type':f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':f.endsWith('.json')?'application/json':'text/html'});fs.createReadStream(f).pipe(s);}).listen(0,'127.0.0.1');
await new Promise(r=>srv.on('listening',r));
const port=srv.address().port;
const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await b.newPage({viewport:{width:1200,height:900}});
p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto(`http://127.0.0.1:${port}/index.html`);
await p.waitForFunction(()=>window.__B7_READY__===true,null,{timeout:120000});
await p.waitForTimeout(1200);
const stats=await p.evaluate(async()=>{
  const out={};
  for (const t of [0,1,3]) {
    window.b7.renderFrame(t);
    const b64=window.b7.captureRGBA();
    const bin=atob(b64); const n=bin.length; let sum=0,cnt=0;
    for(let i=0;i<n;i+=4*97){sum+=(bin.charCodeAt(i)+bin.charCodeAt(i+1)+bin.charCodeAt(i+2))/3;cnt++;}
    out[t]=Math.round(sum/cnt);
  }
  const st=window.__B7_STAGE__;
  out.res=[st.width,st.height];
  return out;
});
console.log('app mode médias:', stats);
await b.close(); srv.close();
