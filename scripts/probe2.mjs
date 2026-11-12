import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root='/home/ubuntu/b7-studio-cinema'; const dist=path.join(root,'dist');
const project=JSON.parse(fs.readFileSync(path.join(dist,'presets/derinkuyu.b7.json'),'utf8'));
const server=http.createServer((q,s)=>{const u=decodeURIComponent(q.url.split('?')[0]);const f=path.join(dist,u==='/'?'index.html':u);if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end();}s.writeHead(200,{'Content-Type':f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':f.endsWith('.json')?'application/json':'text/html'});fs.createReadStream(f).pipe(s);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await b.newPage({viewport:{width:540,height:960}});
await p.addInitScript((x)=>{window.__B7_PROJECT__=x;},project);
await p.goto(`http://127.0.0.1:${server.address().port}/index.html?render=1`);
await p.waitForFunction(()=>window.__B7_READY__===true,null,{timeout:120000});
await p.evaluate(()=>window.b7.setResolution(540,960));
const r=await p.evaluate(async()=>{
  const gl=document.querySelector('#gl'), cap=document.querySelector('#captions');
  const out=document.createElement('canvas'); out.width=540; out.height=960;
  const ctx=out.getContext('2d');
  const t={render:0,compose:0,jpeg:0,raw:0};
  for(let i=0;i<8;i++){
    const a=performance.now(); window.b7.renderFrame(0.5+i*0.9); t.render+=performance.now()-a;
    const c=performance.now(); ctx.drawImage(gl,0,0,540,960); ctx.drawImage(cap,0,0,540,960); t.compose+=performance.now()-c;
    const d=performance.now(); out.toDataURL('image/jpeg',0.95); t.jpeg+=performance.now()-d;
    const e=performance.now(); const c2=out.getContext('2d').getImageData(0,0,540,960).data; let s=''; const chunk=8192; for(let k=0;k<c2.length;k+=chunk){s+=String.fromCharCode.apply(null,c2.subarray(k,k+chunk));} btoa(s); t.raw+=performance.now()-e;
  }
  for(const k in t) t[k]=Math.round(t[k]/8*10)/10;
  return t;
});
console.log(r);
await b.close(); server.close();
