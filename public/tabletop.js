const $=id=>document.getElementById(id);let data,csrf,signature='',busy=false,lastTurn=-1;
const teamName=t=>t==='red'?'Humans':'Zombies';
async function post(body,path='/api/tabletop'){
 if(busy)return;busy=true;$('message').textContent='Saving...';
 try{const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(body)});if(!r.ok){const e=await r.json().catch(()=>({error:'Request failed'}));throw Error(e.error)}await update();$('message').textContent='Saved.';}catch(e){$('message').textContent=e.message}finally{busy=false}
}
function text(id,value){$(id).textContent=value}
async function update(){
 const r=await fetch('/api/tabletop');if(r.status===401){$('welcome').hidden=false;$('play').hidden=true;text('connection','SESSION NEEDED');return}if(!r.ok)throw Error('Connection unavailable');
 data=await r.json();csrf=data.csrf;const s=data.state,t=s.tabletop,c=s.campaign;
 $('welcome').hidden=true;$('play').hidden=false;text('connection',t.enabled?'TABLETOP SYNC CONNECTED':'REAL-TIME TWITCH SYNC');
 const current=$('scenario').value; $('scenario').replaceChildren(...t.scenarios.map(e=>{const o=document.createElement('option');o.value=e.id;o.textContent=e.name+(e.unlock>t.gear.completed+1?` (after ${e.unlock-1} encounters)`:'');o.disabled=e.unlock>t.gear.completed+1;return o}));$('scenario').value=current||t.scenario;
 text('encounter',t.scenarios.find(e=>e.id===t.scenario).name);text('condition',t.scenarios.find(e=>e.id===t.scenario).text);text('phase',s.status.toUpperCase()+(t.enabled?' / TABLETOP':' / REAL TIME'));text('round',t.enabled?`ROUND ${Math.min(12,t.turn+1)} / 12`:`${s.remaining}s remaining`);
 text('objective',c.objective?.title||'Hold the settlement');text('last',s.last);text('settlement',`Integrity ${c.settlement} / 100`);text('supplies',`${c.supplies} community supplies`);
 $('rounds').replaceChildren(...Array.from({length:12},(_,i)=>{const x=document.createElement('span');x.textContent=i+1;x.className=i<t.turn?'done':'';return x}));
 for(const team of ['red','blue']){text(team+'-strength',s.teams[team].line);$(team+'-track').value=s.teams[team].line;text(team+'-flags',[s.teams[team].shield?'SHIELD':'',s.teams[team].power?'SURGE READY':'',t.frenzy[team]?'FRENZY +3':'',t.barrage[team]?`BARRAGE ${t.barrage[team]} charges`:'',`${s.counts[team]} participating`].filter(Boolean).join(' / '))}
 text('resolved',t.resolved?Object.entries(t.resolved).map(([team,v])=>teamName(team)+': '+Object.entries(v).map(([a,n])=>`${a} ${n}`).join(', ')).join(' | '):'Votes remain hidden until reveal.');
 const rosterSignature=JSON.stringify(data.characters);if(signature!==rosterSignature){signature=rosterSignature;$('roster').replaceChildren();for(const ch of data.characters){const row=document.createElement('article'),label=document.createElement('span');label.textContent=`${ch.name} / ${ch.stage} / ${ch.infected?'INFECTED':teamName(ch.faction)}${ch.joined?'':' / unseated'} `;row.append(label);for(const [title,action] of [['Recover (3)','rescue'],['Emergency','emergency']]){const b=document.createElement('button');b.textContent=title;b.disabled=!ch.infected;b.onclick=()=>post({action,name:ch.name});row.append(b)}$('roster').append(row)}}
 const names=data.characters.filter(c=>c.local&&c.joined).map(c=>c.name).join(',');if($('votes').dataset.names!==names){$('votes').dataset.names=names;$('votes').replaceChildren(...data.characters.filter(c=>c.local&&c.joined).map(c=>{const label=document.createElement('label');label.textContent=c.name;const select=document.createElement('select');select.dataset.name=c.name;for(const a of ['','attack','defend','heal','surge']){const o=document.createElement('option');o.value=a;o.textContent=a||'No card / absent';select.append(o)}label.append(select);return label}))}
 if(lastTurn!==`${s.round}:${t.turn}`){for(const x of $('votes').querySelectorAll('select'))x.value='';$('boss').value='';lastTurn=`${s.round}:${t.turn}`}
 $('boss-label').hidden=t.scenario!=='mech';$('boss').options[1].disabled=t.missiles===0;$('boss').options[2].disabled=t.braces===0;
 text('gear',['red','blue'].map(team=>{const e=t.gear[team];return `${teamName(team)}: Launcher ${e.launcher}, Bipod ${e.bipod}, Sensor ${e.sensor}${e.equipped?' / SUPPORT EQUIPPED':''}`}).join(' | '));
 text('storage',`${data.persistent?'Persistent campaign':'Temporary demo: download the journal before leaving'}. ${t.gear.completed} tabletop encounters completed. Chapter ${c.chapter}. In-progress battles do not survive a server restart.`);
 $('chronicle').replaceChildren(...c.chronicle.map(n=>{const li=document.createElement('li');li.textContent=`Chapter ${n.chapter}: ${n.text}`;return li}));
 const running=s.status==='running';$('reveal').disabled=!t.enabled||!running;$('event').disabled=!t.enabled||!running||t.eventUsed;$('start').disabled=['running','paused'].includes(s.status);
}
$('join').onsubmit=e=>{e.preventDefault();post({action:'join',name:$('name').value.trim().toLowerCase(),team:$('team').value})};
$('configure').onclick=()=>post({action:'configure',enabled:true,scenario:$('scenario').value});$('realtime').onclick=()=>post({action:'configure',enabled:false,scenario:'woodland'});
$('start').onclick=()=>post({action:'start'},'/api/control');$('pause').onclick=()=>post({action:'pause'},'/api/control');$('event').onclick=()=>post({action:'event'});
$('reveal').onclick=()=>post({action:'reveal',turn:data.state.tabletop.turn,boss:$('boss').value,votes:[...$('votes').querySelectorAll('select')].filter(s=>s.value).map(s=>({name:s.dataset.name,action:s.value}))});
for(const team of ['red','blue'])$('craft-'+team).onclick=()=>post({action:'craft',team});
$('export').onclick=()=>{if(!data)return;const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),campaign:data.state.campaign,characters:data.characters,tabletop:data.state.tabletop},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='frenemies-campaign-journal.json';a.click();URL.revokeObjectURL(url)};
update().catch(e=>text('message',e.message));setInterval(()=>{if(!busy)update().catch(()=>text('connection','DISCONNECTED - retrying'))},2000);
