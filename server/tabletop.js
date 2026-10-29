import { randomUUID, randomInt } from 'node:crypto';
export const SCENARIOS = [
 {id:'woodland',name:'Woodland approach',unlock:1,text:'Rounds 4 and 8: both teams gain a shield as a new wave arrives.'},
 {id:'moles',name:'Mole ambush',unlock:2,text:'Odd rounds: Zombies are underground; Human attacks deal zero. Even rounds: revealed.'},
 {id:'shields',name:'Shield formation',unlock:3,text:'Zombies gain a shield before rounds 1, 5 and 9. Humans receive Frenzy on those rounds.'},
 {id:'mech',name:'Mega Mech prototype',unlock:5,text:'Zombie majority can choose Missile (+3 next attack, twice/battle) or Brace (shield, once/battle) instead of its normal action.'}
];
export class Tabletop {
 constructor(game,campaign) {
  this.game=game;this.campaign=campaign;this.enabled=false;this.turn=0;this.scenario='woodland';
  campaign.data.tabletop ||= {completed:0,red:{launcher:0,bipod:0,sensor:0,equipped:false},blue:{launcher:0,bipod:0,sensor:0,equipped:false}};
  this.reset();
 }
 reset(){this.turn=0;this.frenzy={red:false,blue:false};this.barrage={red:0,blue:0};this.eventUsed=false;this.resolved=null;this.missiles=2;this.braces=1;this.boss='';}
 configure(enabled,scenario='woodland'){
  if(['running','paused'].includes(this.game.status)) throw Error('Finish the battle before changing pace.');
  const found=SCENARIOS.find(s=>s.id===scenario);if(!found||found.unlock>this.campaign.data.tabletop.completed+1)throw Error('That encounter is not unlocked.');
  this.enabled=enabled;this.scenario=scenario;this.reset();
 }
 start(){this.reset();this.prepare();}
 prepare(){
  const r=this.turn+1,g=this.game;
  if(this.scenario==='woodland'&&[4,8].includes(r))for(const t of ['red','blue'])g.teams[t].shield=true;
  if(this.scenario==='shields'&&[1,5,9].includes(r)){g.teams.blue.shield=true;this.frenzy.red=true;}
 }
 damage(t,base){
  let damage=base+(this.campaign.data.tabletop[t].equipped?2:0)+(this.frenzy[t]?3:0)+(this.barrage[t]>0?3:0);
  this.frenzy[t]=false;if(this.barrage[t]>0)this.barrage[t]--;
  if(this.scenario==='moles'&&t==='red'&&this.turn%2===1)return 0;
  return Math.min(25,damage);
 }
 reveal(expected){
  const g=this.game;if(!this.enabled||g.status!=='running')throw Error('Start a tabletop battle first.');
  if(expected!==this.turn)throw Error('Round already changed. Refresh before revealing.');
  if(!g.votes.size && g.elapsed>=g.freezeUntil)throw Error('Enter physical votes or wait for chat votes before revealing.');
  this.resolved=g.totals();this.turn++;g.elapsed=this.turn*10000;
  // A tabletop round represents ten game seconds: Surge recurs every three rounds.
  if(this.boss){
   for(const [name] of g.votes)if(g.players.get(name)==='blue')g.votes.delete(name);
   if(this.boss==='missile'){this.frenzy.blue=true;this.missiles--;}
   if(this.boss==='brace'){g.teams.blue.shield=true;this.braces--;}
  }
  if(g.elapsed>=g.freezeUntil)g.tick();else g.votes.clear();
  if(g.status==='running'&&this.turn>=12)g.finish();
  this.eventUsed=false;this.boss='';if(g.status==='running')this.prepare();
 }
 finish(){
  if(!this.enabled||!this.game.active.size)return;
  const d=this.campaign.data.tabletop;const component=['launcher','bipod','sensor'][d.completed%3];
  for(const t of ['red','blue'])d[t][component]++;
  d.completed++;this.campaign.note(`Tabletop encounter ${d.completed} complete. Both factions salvage one ${component}.`);
 }
 craft(t){
  if(!['red','blue'].includes(t)||['running','paused'].includes(this.game.status))throw Error('Craft between battles.');
  const gear=this.campaign.data.tabletop[t];if(gear.equipped||!['launcher','bipod','sensor'].every(k=>gear[k]>0))throw Error('Need launcher, bipod and sensor; one support weapon per faction.');
  for(const k of ['launcher','bipod','sensor'])gear[k]--;gear.equipped=true;
  this.campaign.note(`${t==='red'?'Humans':'Zombies'} craft a support weapon: +2 Attack, capped at 25.`);this.campaign.changed();
 }
 event(){
  if(!this.enabled||this.game.status!=='running'||this.eventUsed)throw Error('Draw at most one event per running round.');
  const events=['reinforcements','convoy','frenzy','barrage','supplies','quiet'];const kind=events[randomInt(events.length)];
  this.eventUsed=true;
  if(kind==='reinforcements')for(const t of ['red','blue'])this.game.teams[t].line=Math.min(100,this.game.teams[t].line+2);
  if(kind==='convoy')this.campaign.event('channel.raid',{},randomUUID());
  if(kind==='frenzy')this.frenzy={red:true,blue:true};
  if(kind==='barrage')this.barrage={red:3,blue:3};
  if(kind==='supplies')this.campaign.data.supplies=Math.min(99,this.campaign.data.supplies+1);
  this.campaign.note(`Tabletop event: ${kind}.`);this.campaign.changed();this.game.say(`TABLETOP EVENT: ${kind}`);return kind;
 }
 emergency(name){
  const d=this.campaign.data,chars=Object.values(d.characters),c=d.characters[this.campaign.names.get(name)];
  if(['running','paused'].includes(this.game.status)||!c?.infected||d.supplies>=3||!chars.length||!chars.every(c=>c.infected))throw Error('Emergency recovery needs every registered character infected and fewer than 3 supplies, between battles.');
  c.infected=false;c.rescues++;c.faction='red';this.game.players.set(name,'red');d.settlement=Math.max(0,d.settlement-10);
  this.campaign.note(`Emergency recovery: ${name} volunteers. Refuge loses 10 integrity; no supplies spent.`);
  if(!d.settlement){d.settlement=50;this.campaign.note('Emergency evacuation: new refuge at 50 integrity.');}
  this.campaign.changed();
 }
 snapshot(){return {enabled:this.enabled,turn:this.turn,scenario:this.scenario,scenarios:SCENARIOS,gear:this.campaign.data.tabletop,frenzy:this.frenzy,barrage:this.barrage,eventUsed:this.eventUsed,resolved:this.resolved,missiles:this.missiles,braces:this.braces,boss:this.boss};}
}
