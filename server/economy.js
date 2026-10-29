import { randomUUID } from "node:crypto";
const day = now => new Date(now).toISOString().slice(0,10);
const text = (s,max=80) => typeof s === 'string' && s.trim().length>0 && s.trim().length<=max && !/[\x00-\x1f]/.test(s);
export const STARTERS = [
 {id:'human-starter',name:'C2G Human',team:'red',price:0,asset:'/characters/char01V01.png',published:true},
 {id:'zombie-starter',name:'C2G Zombie',team:'blue',price:0,asset:'/characters/zmb01V01.png',published:true},
 {id:'human-purple',name:'C2G Purple survivor',team:'red',price:30,asset:'/characters/char02V01.png',published:true},
 {id:'human-rebel',name:'C2G Little rebel',team:'red',price:75,asset:'/characters/char03V01.png',published:true},
 {id:'zombie-green',name:'C2G Green jacket',team:'blue',price:30,asset:'/characters/zmb01V02.png',published:true},
 {id:'zombie-purple',name:'C2G Purple jacket',team:'blue',price:60,asset:'/characters/zmb01V03.png',published:true},
 {id:'zombie-coat',name:'C2G Long coat',team:'blue',price:90,asset:'/characters/zmb01V04.png',published:true}
];
export function png(input) {
 const m=/^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/.exec(String(input||''));
 if(!m)throw Error('Upload a PNG using the image picker.');
 const b=Buffer.from(m[1],'base64');
 if(b.length<45||b.length>256*1024||b.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||b.subarray(12,16).toString()!=='IHDR')throw Error('PNG must be under 256 KB.');
 const w=b.readUInt32BE(16),h=b.readUInt32BE(20);
 if(w<1||h<1||w>512||h>512)throw Error('PNG dimensions must be at most 512 x 512.');
 return 'data:image/png;base64,'+b.toString('base64');
}
export class Economy {
 constructor(campaign){this.campaign=campaign;campaign.data.economy ||= {version:1,currency:'Coins',title:'Frenemies',items:structuredClone(STARTERS),missions:[],accounts:{},ledger:[],days:{},receipts:[]};}
 get d(){return this.campaign.data.economy;}
 account(id){return this.d.accounts[id] ||= {balance:0,owned:['human-starter','zombie-starter'],equipped:{red:'human-starter',blue:'zombie-starter'},days:[],completed:[],progress:{},firstDay:null};}
 entry(id,delta,kind,reference,now){const a=this.account(id);a.balance+=delta;this.d.ledger.push({id:randomUUID(),player:id,delta,balance:a.balance,kind,reference,at:new Date(now).toISOString()});this.d.ledger=this.d.ledger.slice(-10000);}
 bucket(now){const key=day(now);this.d.days[key] ||= {battles:0,issued:0,redeemed:0,events:{},observedMs:0};for(const old of Object.keys(this.d.days))if(old<day(now-90*86400000))delete this.d.days[old];return this.d.days[key];}
 command(id,name,raw,team,now=Date.now()){
 const parts=raw.trim().toLowerCase().split(/\s+/),cmd=parts[0],item=this.d.items.find(i=>i.id===parts[1]);
 const a=this.account(id);
 if(cmd==='!wallet'&&parts.length===1)return `${name}: ${a.balance} ${this.d.currency}. First eligible battle each UTC day: +20. !shop / !inventory`;
 if(cmd==='!missions'&&parts.length===1)return `${name}: ${this.d.missions.filter(m=>m.published).map(m=>m.title+' '+(a.progress[m.id]||0)+'/'+m.target+(a.completed.includes(m.id)?' complete':'')).join(' / ')||'No published missions.'}`;
 if(cmd==='!inventory'&&parts.length===1)return `${name}: ${a.owned.join(', ')}. Equip: !equip item-id`;
 if(cmd==='!shop'&&parts.length===1)return `${this.d.title} shop: ${this.d.items.filter(i=>i.published&&i.price>0).slice(0,4).map(i=>i.id+' '+i.price).join(' / ')} ${this.d.currency}. !redeem item-id`;
 if(!['!redeem','!equip'].includes(cmd)||parts.length!==2)throw Error('Use !wallet, !shop, !inventory, !redeem item-id or !equip item-id.');
 if(!item)throw Error('Unknown item. See the channel shop.');
 if(cmd==='!redeem'){
  if(a.owned.includes(item.id))return `${name}: you already own ${item.name}. Use !equip ${item.id}.`;
  if(!item.published)throw Error('This item is not available.');
  if(a.balance<item.price)throw Error(`Need ${item.price-a.balance} more ${this.d.currency} for ${item.name}.`);
  this.entry(id,-item.price,'redeem',item.id,now);a.owned.push(item.id);this.bucket(now).redeemed+=item.price;
  return `${name} unlocked ${item.name}. !equip ${item.id}`;
 }
 if(!a.owned.includes(item.id))throw Error('Unlock this item first.');
 a.equipped[item.team]=item.id;
 return `${name} equipped ${item.name}${team!==item.team?' for their other faction':''}.`;
 }
 finish(game,now=Date.now()){
 if(game.tabletop?.enabled||game.territory?.s.status==='active')return;
 const receipt=game.battleId;if(!receipt||this.d.receipts.includes(receipt))return;
 this.d.receipts.push(receipt);this.d.receipts=this.d.receipts.slice(-2000);
 const b=this.bucket(now);b.battles++;
 const current=day(now),both=game.counts().red>0&&game.counts().blue>0;
 for(const [name,votes] of game.participation){
  const id=this.campaign.names.get(name);if(!id||votes<2||game.elapsed<10000||!both)continue;
  const a=this.account(id);a.firstDay ||= current;
  let visit=a.days.find(v=>v.day===current);if(!visit){visit={day:current,battles:0};a.days.push(visit);a.days=a.days.filter(v=>v.day>=day(now-90*86400000));}
  visit.battles++;if(visit.battles>10)continue;
  const won=game.players.get(name)===game.winner;
  let reward=10+(won?5:0)+(visit.battles===1?20:0);
  this.entry(id,reward,'battle',receipt,now);b.issued+=reward;
  for(const m of this.d.missions.filter(m=>m.published&&!a.completed.includes(m.id))){
   const advance=m.objective==='play'?1:m.objective==='win'?(won?1:0):Math.min(1,game.actionCounts?.get(name)?.[m.objective]||0);
   a.progress[m.id]=Math.min(m.target,(a.progress[m.id]||0)+advance);
   if(a.progress[m.id]>=m.target){a.completed.push(m.id);this.entry(id,m.reward,'mission',m.id,now);b.issued+=m.reward;this.campaign.note(`${name} completed ${m.title}: ${m.story}`);}
  }
 }
 }
 author(body){
 if(body.action==='settings'){
  if(!text(body.currency,20)||!text(body.title,60))throw Error('Choose a currency name (20 characters) and title (60 characters).');
  if(body.humanName!==undefined&&(!text(body.humanName,24)||!text(body.zombieName,24)))throw Error('Faction labels must be 1-24 characters.');
  this.d.currency=body.currency.trim();this.d.title=body.title.trim();this.d.factions={red:body.humanName||'Humans',blue:body.zombieName||'Zombies'};return;
 }
 if(body.action==='item'){
  if(this.d.items.length>=40||!text(body.name,40)||!['red','blue'].includes(body.team)||!Number.isInteger(body.price)||body.price<0||body.price>500)throw Error('Maximum 40 skins; name 1-40 characters; price 0-500; choose a faction.');
  this.d.items.push({id:'skin-'+randomUUID().slice(0,8),name:body.name.trim(),team:body.team,price:body.price,image:png(body.image),published:false});return;
 }
 if(body.action==='mission'){
  if(this.d.missions.length>=12||!text(body.title,60)||!text(body.story,240)||!['play','win','attack','defend','heal','surge'].includes(body.objective)||!Number.isInteger(body.target)||body.target<1||body.target>50||!Number.isInteger(body.reward)||body.reward<0||body.reward>50)throw Error('Up to 12 missions; target 1-50 eligible battles, reward 0-50. Complete title and story.');
  this.d.missions.push({id:'mission-'+randomUUID().slice(0,8),title:body.title.trim(),story:body.story.trim(),objective:body.objective,target:body.target,reward:body.reward,published:false});return;
 }
 if(body.action==='publish'){
  const entry=[...this.d.items,...this.d.missions].find(i=>i.id===body.id);if(!entry||typeof body.published!=='boolean')throw Error('Select an existing draft.');entry.published=body.published;if(body.published)entry.everPublished=true;return;
 }
 throw Error('Unknown creator action.');
 }
 catalog(key,owner=false){return {title:this.d.title,currency:this.d.currency,factions:this.d.factions||{red:'Humans',blue:'Zombies'},items:this.d.items.filter(i=>owner||i.published).map(({image,...i})=>({...i,asset:image?`/item-art/${key}/${i.id}`:i.asset})),missions:this.d.missions.filter(m=>owner||m.published)};}
 roster(game,key,now=Date.now()){
 const result={red:[],blue:[]};for(const [name,team] of game.players){const id=this.campaign.names.get(name),a=this.d.accounts[id];const item=this.d.items.find(i=>i.id===(a?.equipped[team]||team+'-starter'))||this.d.items.find(i=>i.team===team);if(item)result[team].push({name,item:item.name,asset:item.image?`/item-art/${key}/${item.id}`:item.asset});}
 // Rotate bounded samples, rather than broadcasting every account and balance.
 for(const team of ['red','blue']){const list=result[team],offset=Math.floor(now/8000)*3;result[team]=list.length<=3?list:Array.from({length:3},(_,i)=>list[(offset+i)%list.length]);}return result;
 }
 analytics(now=Date.now()){
 const today=day(now),accounts=Object.values(this.d.accounts),cohort=n=>{const eligible=accounts.filter(a=>a.firstDay&&a.firstDay<=day(now-n*86400000)&&a.firstDay>=day(now-80*86400000));const returned=eligible.filter(a=>a.days.some(d=>d.day===day(Date.parse(a.firstDay+'T00:00:00Z')+n*86400000)));
 return {eligible:eligible.length,returned:returned.length,rate:eligible.length?returned.length/eligible.length:null};};
 return {definition:'Players completing an eligible battle; UTC calendar-day D1/D7, not viewers or watch-time retention. Last 90 days; matured cohorts from last 80 days.',today,accounts:accounts.length,d1:cohort(1),d7:cohort(7),days:Object.entries(this.d.days).sort(([a],[b])=>b.localeCompare(a)).map(([date,b])=>({date,...b,players:accounts.filter(a=>a.days.some(v=>v.day===date)).length})),ledgerEntries:this.d.ledger.length};
 }
}
