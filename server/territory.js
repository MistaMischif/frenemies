import {randomInt,createHash,randomUUID} from 'node:crypto';
export const TERRITORIES=Array.from({length:12},(_,i)=>{
 const row=Math.floor(i/4),col=i%4,id=String.fromCharCode(65+col)+(row+1);
 const names=['Ruined lookout','Zombie refuge','Scrap workshop','Graveyard','Old woodland','Community clinic','Salvage yard','Watchtower','Human refuge','Field workshop','Birch grove','Rocky pass'];
 const resources=['sensor','launcher','bipod','supply','bipod','supply','launcher','sensor','supply','launcher','sensor','bipod'];
 return {id,name:names[i],x:col,y:row,resource:resources[i],workshop:['C1','B3'].includes(id),clinic:id==='B2',neighbors:[[col-1,row],[col+1,row],[col,row-1],[col,row+1]].filter(([x,y])=>x>=0&&x<4&&y>=0&&y<3).map(([x,y])=>String.fromCharCode(65+x)+(y+1))};
});
export const FIGURES=[['H1','red','char01V01','A3'],['H2','red','char02V01','B3'],['H3','red','char03V01','C3'],['Z1','blue','zmb01V01','B1'],['Z2','blue','zmb01V02','C1'],['Z3','blue','zmb01V03','D1']].map(([id,team,art,home])=>({id,team,art,home,toyId:'c2g-figure-'+id.toLowerCase()}));
export class TerritoryGame {
 constructor(campaign,{roll=()=>randomInt(1,7)}={}) {this.campaign=campaign;this.roll=roll;this.votes=new Map();campaign.data.territory ||= this.fresh();}
 get s(){return this.campaign.data.territory;}
 fresh(previous){return {schema:1,revision:previous?.revision||0,expedition:(previous?.expedition||0)+1,status:'ready',round:1,side:'red',actions:2,eventUsed:false,winner:null,territories:Object.fromEntries(TERRITORIES.map(t=>[t.id,{owner:['A3','B3','C3'].includes(t.id)?'red':['B1','C1','D1'].includes(t.id)?'blue':null,garrison:1,stock:2}])),pieces:Object.fromEntries(FIGURES.map(f=>{const old=previous?.pieces[f.id],infected=old?.infected||false;return [f.id,{...f,team:infected?'blue':f.team,location:infected?null:f.home,units:infected?0:3,infected,equipped:old?.equipped||false,guard:false,tag:old?.tag||f.toyId}]})),reserves:{red:3,blue:3},inventory:{red:{launcher:0,bipod:0,sensor:0},blue:{launcher:0,bipod:0,sensor:0}},frenzy:{red:false,blue:false},participants:[],events:[],receipts:[],eventReceipts:[]};}
 note(text,extra={}){this.s.events.unshift({revision:this.s.revision+1,text,...extra});this.s.events=this.s.events.slice(0,30);}
 occupied(id){return Object.values(this.s.pieces).find(p=>p.location===id&&p.units>0);}
 territory(id){const t=TERRITORIES.find(t=>t.id===id);if(!t)throw Error('Unknown territory.');return t;}
 count(team){return Object.values(this.s.territories).filter(t=>t.owner===team).length;}
 execute(command){
  const s=this.s,{action,pieceId,target,revision,requestId}=command;
  if(typeof requestId!=='string'||!/^[A-Za-z0-9_-]{8,80}$/.test(requestId))throw Error('A unique request ID is required.');
  const digest=createHash('sha256').update(JSON.stringify(command)).digest('hex'),receipt=s.receipts.find(r=>r.id===requestId);
  if(receipt){if(receipt.digest!==digest)throw Error('Request ID already used for another order.');return false;}
  if(revision!==s.revision)throw Error('Board changed. Refresh before issuing this order.');
  if(action==='start') {if(s.status==='active')throw Error('An expedition is already active.');this.campaign.data.territory=s.status==='finished'?this.fresh(s):s;this.s.status='active';this.note('Expedition begins. Humans act first.');}
  else if(action==='bind') {if(s.status==='active')throw Error('Bind toy identities between expeditions.');const p=s.pieces[pieceId];if(!p||typeof command.tag!=='string'||!/^[A-Za-z0-9:_-]{1,64}$/.test(command.tag)||Object.values(s.pieces).some(q=>q.id!==pieceId&&q.tag===command.tag))throw Error('Use a unique toy tag of letters, numbers, colon, underscore or hyphen.');p.tag=command.tag;this.note(`${pieceId} bound to physical tag ${p.tag}.`);}
  else {
   if(s.status!=='active')throw Error('Start an expedition first.');
   if(action==='event'){
    if(s.eventUsed||s.actions!==2)throw Error('Draw one event before the first action of the faction turn.');
    const deck=['convoy','clinic','frenzy-red','frenzy-blue','reinforcements','quiet'];
    const kind=command.kind||deck[randomInt(deck.length)];if(!deck.includes(kind))throw Error('Unknown world event.');
    if(kind==='convoy'&&!this.campaign.data.objective)this.campaign.data.objective={title:'Territory rescue convoy',source:'territory-event'};
    if(kind==='clinic')this.campaign.data.supplies=Math.min(99,this.campaign.data.supplies+1);
    if(kind==='frenzy-red')s.frenzy.red=true;if(kind==='frenzy-blue')s.frenzy.blue=true;
    if(kind==='reinforcements')for(const t of ['red','blue'])s.reserves[t]=Math.min(12,s.reserves[t]+1);
    s.eventUsed=true;this.note('World event: '+kind);
   }
   else if(action==='end'){this.note(`${s.side==='red'?'Humans':'Zombies'} end their turn.`);this.next();}
   else {
    const p=s.pieces[pieceId];if(!p)throw Error('Select a figure.');
    if(action==='emergency')this.emergency(p);
    else {
     if(p.team!==s.side)throw Error('That figure belongs to the other faction.');
     if(action==='deploy'){const destination=this.territory(target);if(p.location||p.units||s.territories[target].owner!==p.team||this.occupied(target)||s.reserves[p.team]<2)throw Error('Deploy a defeated figure into an empty owned territory for 2 reserves.');s.reserves[p.team]-=2;p.units=2;p.location=destination.id;this.note(`${p.id} deploys at ${target}.`);}
     else {
      if(!p.location||p.units<1)throw Error('Deploy or recover this figure first.');
      const here=this.territory(p.location),tile=s.territories[p.location];
      if(['move','attack'].includes(action)){
       this.territory(target);if(!here.neighbors.includes(target))throw Error('Use a connected neighboring territory; no diagonal moves.');
       const dest=s.territories[target],defender=this.occupied(target);
       if(action==='move'){
        if(defender||dest.owner&&dest.owner!==p.team)throw Error('Move only to an empty friendly or unclaimed territory. Attack enemy territory first.');
        p.location=target;dest.owner=p.team;dest.garrison=1;this.note(`${p.id} moves to ${target} and claims it.`);
       }else {
        if(!dest.owner||dest.owner===p.team)throw Error('Attack an enemy-controlled neighboring territory.');
        if(p.units<2)throw Error('An attack needs at least 2 units on the figure.');
        const ac=Math.min(3,p.units-1),dc=Math.min(2,defender?defender.units:dest.garrison);
        if(command.dice && !['attack','defense'].every(k=>Array.isArray(command.dice[k])&&command.dice[k].length===(k==='attack'?ac:dc)&&command.dice[k].every(v=>Number.isInteger(v)&&v>=1&&v<=6)))throw Error('Enter the exact required number of dice, each from 1 to 6.');
        const attack=(command.dice?[...command.dice.attack]:Array.from({length:ac},this.roll)).sort((a,b)=>b-a),defense=(command.dice?[...command.dice.defense]:Array.from({length:dc},this.roll)).sort((a,b)=>b-a);
        if(p.equipped||s.frenzy[p.team])attack[0]=Math.min(6,attack[0]+(p.equipped?1:0)+(s.frenzy[p.team]?1:0));s.frenzy[p.team]=false;
        if(defender?.guard){defense[0]=Math.min(6,defense[0]+1);defender.guard=false;}
        let aLoss=0,dLoss=0;for(let i=0;i<Math.min(attack.length,defense.length);i++)if(attack[i]>defense[i])dLoss++;else aLoss++;
        p.units-=aLoss;if(defender)defender.units-=dLoss;else dest.garrison-=dLoss;
        const captured=defender?defender.units===0:dest.garrison===0;
        if(captured){if(defender){defender.location=null;defender.guard=false;if(defender.id.startsWith('H')){defender.infected=true;defender.team='blue';this.campaign.note(`${defender.id} was infected in ${target}. Its toy identity and equipment remain.`);}}p.location=target;dest.owner=p.team;dest.garrison=1;}
        this.note(`${p.id} attacks ${target}: attacker loses ${aLoss}, defender loses ${dLoss}${captured?'; territory captured':''}.`,{attack,defense});
       }
      } else if(action==='scavenge'){
       if(tile.stock<1)throw Error('This territory has no salvage remaining this expedition.');tile.stock--;
       if(here.resource==='supply')this.campaign.data.supplies=Math.min(99,this.campaign.data.supplies+1);else s.inventory[p.team][here.resource]++;
       this.note(`${p.id} scavenges one ${here.resource} at ${p.location}.`);
      } else if(action==='craft'){
       const inv=s.inventory[p.team];if(!here.workshop||p.equipped||!['launcher','bipod','sensor'].every(k=>inv[k]>=1))throw Error('At a workshop, spend launcher + bipod + sensor to equip an unequipped figure.');
       for(const k of ['launcher','bipod','sensor'])inv[k]--;p.equipped=true;this.note(`${p.id} crafts support: +1 to its highest attack die, maximum 6.`);
      } else if(action==='reinforce'){
       const amount=Math.min(2,6-p.units,s.reserves[p.team]);if(amount<1)throw Error('Need reserves and space below the 6-unit cap.');s.reserves[p.team]-=amount;p.units+=amount;this.note(`${p.id} adds ${amount} units.`);
      } else if(action==='guard'){if(p.guard)throw Error('This figure is already guarding.');p.guard=true;this.note(`${p.id} guards: +1 highest defense die on its next defense.`);}
      else if(action==='heal'){if(!here.clinic||p.units>=6||this.campaign.data.supplies<1)throw Error('At the clinic spend 1 supply to restore up to 2 units.');this.campaign.data.supplies--;p.units=Math.min(6,p.units+2);this.note(`${p.id} heals at the clinic.`);}
      else if(action==='rescue'){
       const fallen=s.pieces[target];if(p.team!=='red'||!here.clinic||!fallen?.infected||fallen.location||this.campaign.data.supplies<3)throw Error('Human at clinic: spend 3 supplies to recover an infected, off-board Human figure.');
       this.campaign.data.supplies-=3;fallen.infected=false;fallen.team='red';this.note(`${p.id} recovers ${fallen.id}; deploy it on a later action.`);
      } else throw Error('Unknown figure order.');
     }
    }
    s.actions--;if(s.actions===0)this.next();
   }
  }
  this.s.revision++;this.s.receipts.push({id:requestId,digest});this.s.receipts=this.s.receipts.slice(-64);this.votes.clear();return true;
 }
 emergency(p){const s=this.s;if(s.side!=='red'||!p.id.startsWith('H')||!p.infected||this.campaign.data.supplies>=3||!Object.values(s.pieces).filter(q=>q.id.startsWith('H')).every(q=>q.infected))throw Error('Emergency: all three Human figures infected, fewer than 3 supplies, Human turn.');const dest=TERRITORIES.find(t=>s.territories[t.id].owner==='red'&&!this.occupied(t.id));if(!dest)throw Error('No empty Human territory remains.');p.team='red';p.infected=false;p.location=dest.id;p.units=2;this.campaign.data.settlement=Math.max(0,this.campaign.data.settlement-10);if(!this.campaign.data.settlement)this.campaign.data.settlement=50;this.campaign.note(`Emergency recovery: ${p.id}; refuge -10 integrity (evacuate to 50 at zero).`);this.note(`${p.id} returns at ${dest.id} through emergency recovery.`);}
 next(){const s=this.s,previous=s.side;
  if(this.count(previous)>=8){this.finish(previous);return;}
  if(s.side==='blue'&&s.round>=8){const r=this.count('red'),b=this.count('blue');this.finish(r===b?'draw':r>b?'red':'blue');return;}
  if(s.territories.B2.owner==='red'&&this.campaign.data.objective){this.campaign.data.supplies=Math.min(99,this.campaign.data.supplies+3);this.campaign.note('Convoy secured at the clinic: +3 supplies.');this.campaign.data.objective=null;}
  s.side=s.side==='red'?'blue':'red';if(s.side==='red')s.round++;s.actions=2;s.eventUsed=false;s.reserves[s.side]=Math.min(12,s.reserves[s.side]+Math.max(1,Math.floor(this.count(s.side)/3)));
 }
 finish(winner){const s=this.s,c=this.campaign;s.status='finished';s.winner=winner;c.data.settlement=Math.max(0,Math.min(100,c.data.settlement+(winner==='red'?10:winner==='blue'?-10:0)));c.data.supplies=Math.min(99,c.data.supplies+3);if(!c.data.settlement)c.data.settlement=50;
 for(const id of s.participants){const p=c.data.characters[id];if(!p)continue;p.chapters++;if(p.faction===winner)p.wins++;p.stage=p.chapters>=5?'Veteran':'Survivor';}
 c.note(`Territory expedition ${s.expedition}: ${winner==='draw'?'draw':winner==='red'?'Humans win':'Zombies win'}. +3 supplies. Figure injuries and equipment persist.`);c.data.chapter++;this.note('Expedition finished: '+winner);}
 vote(id,name,team,text){if(this.s.status!=='active'||team!==this.s.side||this.votes.has(id))return false;const parts=text.trim().split(/\s+/),[raw,pieceId,target]=parts;const action=raw.slice(1);if(parts.length!==1+(action==='end'?0:['move','attack','rescue','deploy'].includes(action)?2:1))return false;if(!['move','attack','scavenge','craft','reinforce','guard','heal','rescue','deploy','end','emergency'].includes(action))return false;
 const order={action,...(pieceId?{pieceId:pieceId.toUpperCase()}:{}),...(target?{target:target.toUpperCase()}: {})};
 // Validate using a cloned campaign and fixed dice; invalid proposals never consume a vote.
 const check=new TerritoryGame({data:structuredClone(this.campaign.data),note:()=>{}},{roll:()=>3});try{check.execute({...order,revision:this.s.revision,requestId:randomUUID()})}catch{return false;}
 this.votes.set(id,{name,order});return true;}
 resolve(revision,requestId){if(!this.votes.size)throw Error('No valid Twitch orders yet.');const counts=new Map();for(const v of this.votes.values()){const key=JSON.stringify(v.order);counts.set(key,(counts.get(key)||0)+1)}const sorted=[...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));const ids=[...this.votes.keys()];if(revision!==this.s.revision)throw Error('Board changed. Refresh before resolving.');for(const id of ids)if(!this.s.participants.includes(id))this.s.participants.push(id);this.s.participants=this.s.participants.slice(-2000);return this.execute({...JSON.parse(sorted[0][0]),revision,requestId});}
 event(type,event,receipt,players){if(this.s.status!=='active'||this.s.eventReceipts.includes(receipt)||!['channel.raid','channel.hype_train.begin','channel.subscribe','channel.subscription.gift'].includes(type)||(type==='channel.subscribe'&&event.is_gift))return false;this.s.eventReceipts.push(receipt);this.s.eventReceipts=this.s.eventReceipts.slice(-128);
 if(type==='channel.hype_train.begin')for(const team of ['red','blue'])if(event.top_contributions?.some(v=>players.get(v.user_login?.toLowerCase())===team))this.s.frenzy[team]=true;
 this.note('Twitch event reached the territory campaign: '+type);this.s.revision++;this.votes.clear();return true;}
 snapshot(){const {receipts,eventReceipts,participants,...state}=this.s;return {...structuredClone(state),map:TERRITORIES,voteCount:this.votes.size};}
 definition(){return {id:'frenemies-territory-v1',title:'Frenemies: C2G Territories',columns:4,rows:3,cellSize:.075,pieces:Object.values(this.s.pieces).filter(p=>p.location).map(p=>{const t=this.territory(p.location);return {id:p.toyId,label:p.id,x:t.x,y:2-t.y,shape:'Cylinder',color:p.team==='red'?'#b5563b':'#547b48'}})};}
}
