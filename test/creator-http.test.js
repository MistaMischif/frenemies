import {test} from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {mkdtemp,rm,readFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';
test('creator endpoints authorize edits, publish drafts, isolate public data and persist channel content',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'creator-test-')),base='http://localhost:43132';const child=spawn(process.execPath,['server/index.js'],{env:{...process.env,NODE_ENV:'test',PORT:'43132',PUBLIC_URL:base,DATA_DIR:dir}});
 try{await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('startup timeout')),10000);child.stdout.on('data',d=>{if(String(d).includes('listening')){clearTimeout(timer);resolve();}});child.on('error',reject);});
 assert.equal((await fetch(base+'/api/creator')).status,401);
 let r=await fetch(base),html=await r.text(),cookie=r.headers.get('set-cookie').split(';')[0],csrf=html.match(/name="csrf" value="([^"]+)"/)[1];
 r=await fetch(base+'/territory/new',{method:'POST',redirect:'manual',headers:{cookie,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf})});cookie=r.headers.get('set-cookie')?.split(';')[0]||cookie;
 let d=await(await fetch(base+'/api/creator',{headers:{cookie}})).json();csrf=d.csrf;
 const post=body=>fetch(base+'/api/creator',{method:'POST',headers:{cookie,'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(body)});
 assert.equal((await fetch(base+'/api/creator',{method:'POST',headers:{cookie,'Content-Type':'application/json'},body:'{}'})).status,403);
 assert.equal((await post({action:'settings',title:'Space crew',currency:'Stars',humanName:'Crew',zombieName:'Aliens'})).status,200);
 const image='data:image/png;base64,'+(await readFile('public/characters/char02V01.png')).toString('base64');assert.equal((await post({action:'item',name:'Crew pilot',team:'red',price:30,image})).status,200);
 d=await(await fetch(base+'/api/creator',{headers:{cookie}})).json();const skin=d.items.at(-1),key=d.shop.split('/').pop();let catalog=await(await fetch(base+'/api/shop/'+key)).json();assert.equal(catalog.items.some(i=>i.id===skin.id),false);assert.equal('analytics' in catalog,false);assert.equal('accounts' in catalog,false);assert.equal((await fetch(base+skin.asset)).status,404);assert.equal((await fetch(base+skin.asset,{headers:{cookie}})).status,200);
 assert.equal((await post({action:'publish',id:skin.id,published:true})).status,200);catalog=await(await fetch(base+'/api/shop/'+key)).json();assert.equal(catalog.items.at(-1).name,'Crew pilot');assert.equal((await fetch(base+skin.asset)).headers.get('content-type'),'image/png');
 const saved=JSON.parse(await readFile(path.join(dir,'scores.json'),'utf8'))['local-tabletop'].campaign.economy;assert.equal(saved.currency,'Stars');assert.equal(saved.items.at(-1).published,true);
 assert.equal((await fetch(base+'/api/demo-chat',{method:'POST',headers:{cookie,'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({name:'fake',message:'!join'})})).status,403);
 }finally{child.kill();await new Promise(resolve=>child.once('exit',resolve));await rm(dir,{recursive:true,force:true});}
});
