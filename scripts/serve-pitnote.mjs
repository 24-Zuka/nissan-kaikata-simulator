// Local test server. Applies the distribution's _headers and Pages-style HTML redirects.
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../pitnote/',import.meta.url));
const rules=[];for(const line of fs.readFileSync(path.join(root,'_headers'),'utf8').split('\n')){if(!line.trim()||line.startsWith('#'))continue;if(!/^\s/.test(line))rules.push({path:line,headers:[]});else rules.at(-1).headers.push(line.trim());}
http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');let pathname=decodeURIComponent(url.pathname);if(pathname.endsWith('.html')){res.writeHead(302,{Location:pathname.slice(0,-5)});res.end();return;}
 const target=path.resolve(root,'.'+pathname);if(target!==path.resolve(root)&&!target.startsWith(root)){res.writeHead(403);res.end();return;}
 let file=target;if(pathname.endsWith('/'))file=path.join(target,'index.html');else if(!fs.existsSync(file))file+='.html';
 if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
 const headers={};for(const rule of rules){const regex=new RegExp('^'+rule.path.split('*').map(x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*')+'$');if(!regex.test(pathname))continue;for(const h of rule.headers){if(h.startsWith('! '))delete headers[h.slice(2).toLowerCase()];else{const idx=h.indexOf(':');const key=h.slice(0,idx).toLowerCase(),value=h.slice(idx+1).trim();headers[key]=headers[key]?headers[key]+', '+value:value;}}}
 headers['content-type']=({'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream';res.writeHead(200,headers);fs.createReadStream(file).pipe(res);
}).listen(4190,'127.0.0.1',()=>console.log('Local PITNOTE test server on 4190'));
