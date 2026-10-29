import {test} from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {mkdtemp,rm,readFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';
test('territory HTTP persists map, isolates bridge permission and validates observed moves before confirmation',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'c2g-territory-')),base='http://localhost:43130';
 const child=spawn(process.execPath,['server/index.js'],{env:{...process.env,NODE_ENV:'test',PORT:'43130',PUBLIC_URL:base,DATA_DIR:dir}});
 try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('startup timeout')),10000);child.stdout.on('data',d=>{if(String(d).includes('listening')){clearTimeout(timer);resolve()}});child.on('error',reject)});
  assert.equal((await fetch(base+'/api/territory')).status,401);let r=await fetch(base);const html=await r.text();let cookie=r.headers.get('set-cookie').split(';')[0],csrf=html.match(/name="csrf" value="([^"]+)"/)[1];
  r=await fetch(base+'/territory/new',{method:'POST',redirect:'manual',headers:{cookie,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf})});assert.equal(r.status,303);cookie=r.headers.get('set-cookie')?.split(';')[0]||cookie;
  let data=await(await fetch(base+'/api/territory',{headers:{cookie}})).json();csrf=data.csrf;
  const post=(url,body)=>fetch(base+url,{method:'POST',headers:{cookie,'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(body)});
  assert.equal((await fetch(base+'/api/territory',{method:'POST',headers:{cookie,'Content-Type':'application/json'},body:'{}'})).status,403);
  r=await post('/api/territory',{action:'start',revision:0,requestId:'http-start'});assert.equal(r.status,200);data=await r.json();
  assert.equal((await post('/api/control',{action:'start'})).status,409);
  const pair=await(await post('/api/territory/bridge-key',{})).json();assert.equal(pair.key.length,64);
  assert.equal((await fetch(base+'/api/living-table/observe',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,401);
  const observe=body=>fetch(base+'/api/living-table/observe',{method:'POST',headers:{Authorization:'Bearer '+pair.key,'Content-Type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await observe({pieceId:'c2g-figure-h1',target:'A2',revision:1})).status,202);
  let state=await(await fetch(base+'/api/territory',{headers:{cookie}})).json();assert.equal(state.state.pieces.H1.location,'A3');assert.equal(state.observation.target,'A2');
  r=await post('/api/territory',{action:'move',pieceId:'H1',target:'A2',revision:1,requestId:'http-confirm'});assert.equal(r.status,200);data=await r.json();assert.equal(data.state.pieces.H1.location,'A2');
  assert.equal((await observe({pieceId:'c2g-figure-h1',target:'A1',revision:1})).status,409);
  const bridge=await(await fetch(data.bridge)).json();assert.equal(bridge.protocol,'c2g.territory.v1');assert.equal(bridge.definition.pieces.find(p=>p.id==='c2g-figure-h1').y,1);assert.equal(JSON.stringify(bridge).includes(pair.key),false);assert.equal('receipts' in bridge.state,false);
  const saved=JSON.parse(await readFile(path.join(dir,'scores.json'),'utf8'))['local-tabletop'];assert.equal(saved.campaign.territory.pieces.H1.location,'A2');assert.equal(saved.bridgeHash.length,64);assert.notEqual(saved.bridgeHash,pair.key);
  await post('/api/territory/bridge-key',{});assert.equal((await observe({pieceId:'c2g-figure-h1',target:'A1',revision:2})).status,401);
 }finally{child.kill();await new Promise(resolve=>child.once('exit',resolve));await rm(dir,{recursive:true,force:true})}
});
