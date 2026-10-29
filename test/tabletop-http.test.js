import WebSocket from 'ws';
import {test} from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {mkdtemp,rm,readFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';
test('tabletop HTTP authenticates, protects reveals, shares overlay state and saves local campaign',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'frenemies-table-'));const base='http://localhost:43129';
 const child=spawn(process.execPath,['server/index.js'],{env:{...process.env,NODE_ENV:'test',PORT:'43129',PUBLIC_URL:base,DATA_DIR:dir}});
 try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('startup timeout')),10000);child.stdout.on('data',d=>{if(String(d).includes('listening')){clearTimeout(timer);resolve()}});child.on('error',reject)});
  assert.equal((await fetch(base+'/api/tabletop')).status,401);
  let r=await fetch(base);let html=await r.text();let cookie=r.headers.get('set-cookie').split(';')[0];let csrf=html.match(/name="csrf" value="([^"]+)"/)[1];
  r=await fetch(base+'/tabletop/new',{method:'POST',headers:{cookie,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf}),redirect:'manual'});assert.equal(r.status,303);cookie=r.headers.get('set-cookie')?.split(';')[0]||cookie;
  let data=await (await fetch(base+'/api/tabletop',{headers:{cookie}})).json();csrf=data.csrf;assert.equal(data.persistent,true);
  const post=(body,url='/api/tabletop')=>fetch(base+url,{method:'POST',headers:{cookie,'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(body)});
  assert.equal((await fetch(base+'/api/tabletop',{method:'POST',headers:{cookie,'Content-Type':'application/json'},body:'{"action":"event"}'})).status,403);
  assert.equal((await post({action:'start'},'/api/control')).status,400);
  for(const [name,team] of [['a','red'],['b','blue']])assert.equal((await post({action:'join',name,team})).status,200);
  assert.equal((await post({action:'start'},'/api/control')).status,200);
  assert.equal((await post({action:'reveal',turn:0,votes:[{name:'not_a_player',action:'attack'}]})).status,400);
  const votes=[{name:'table_a',action:'defend'},{name:'table_b',action:'defend'}];
  const ws=new WebSocket(data.overlay.replace('http:','ws:').replace('/overlay/','/?overlay='));
  await new Promise((resolve,reject)=>{ws.once('message',resolve);ws.once('error',reject)});
  const nextState=new Promise(resolve=>ws.on('message',raw=>{const state=JSON.parse(raw);if(state.tabletop.turn===1)resolve(state)}));
  const first=await (await post({action:'reveal',turn:0,votes})).json();assert.equal(first.tabletop.turn,1);assert.equal(first.counts.red,1);const streamed=await nextState;assert.equal(streamed.tabletop.turn,1);assert.equal(streamed.teams.red.line,first.teams.red.line);ws.close();
  assert.equal((await post({action:'reveal',turn:0,votes})).status,400);
  for(let turn=1;turn<12;turn++)assert.equal((await post({action:'reveal',turn,votes})).status,200);
  data=await (await fetch(base+'/api/tabletop',{headers:{cookie}})).json();assert.equal(data.state.status,'finished');assert.equal(data.state.campaign.supplies,3);assert.equal(data.state.tabletop.gear.completed,1);
  assert.equal((await fetch(data.overlay)).status,200);
  await new Promise(resolve=>setTimeout(resolve,100));const disk=JSON.parse(await readFile(path.join(dir,'scores.json'),'utf8'));assert.equal(disk['local-tabletop'].campaign.tabletop.completed,1);assert.equal(disk['local-tabletop'].campaign.characters['table:table_a'].chapters,1);
 }finally{child.kill();await new Promise(resolve=>child.once('exit',resolve));await rm(dir,{recursive:true,force:true})}
});
