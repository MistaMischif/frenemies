import {test} from 'node:test';import assert from 'node:assert/strict';import {Campaign} from '../server/campaign.js';import {Economy,png} from '../server/economy.js';import {Game} from '../server/game.js';import {readFileSync} from 'node:fs';
const setup=()=>{const c=new Campaign(),e=new Economy(c),g=new Game();g.campaign=c;g.economy=e;c.join('1','alice','red');c.join('2','bob','blue');g.chat('alice','!human');g.chat('bob','!zombie');return {c,e,g}};
function battle(g){g.start();for(let i=0;i<5;i++){g.chat('alice','!attack');g.chat('bob','!defend');g.advance(2000);}g.winner='red';}
test('eligible rewards are once per battle, once daily bonus, no duplicate redemption; ownership survives rename/reload',()=>{
 const {c,e,g}=setup();battle(g);const now=Date.parse('2026-10-29T10:00:00Z');e.finish(g,now);assert.equal(e.account('1').balance,35);assert.equal(e.account('2').balance,30);e.finish(g,now);assert.equal(e.account('1').balance,35);
 e.command('1','alice','!redeem human-purple','red',now);assert.equal(e.account('1').balance,5);e.command('1','alice','!redeem human-purple','red',now);assert.equal(e.account('1').balance,5);
 assert.throws(()=>e.command('2','bob','!equip human-purple','blue'),/Unlock/);e.command('1','alice','!equip human-purple','red');
 const loaded=new Campaign(JSON.parse(JSON.stringify(c.data)));loaded.identify('1','renamed');const persisted=new Economy(loaded);assert.equal(persisted.account('1').equipped.red,'human-purple');assert.equal(persisted.account('1').balance,5);
 g.status='finished';battle(g);e.finish(g,now);assert.equal(e.account('1').balance,20);
 g.status='finished';battle(g);e.finish(g,now+86400000);assert.equal(e.account('1').balance,55);assert.deepEqual(e.analytics(now+86400000).d1,{eligible:2,returned:2,rate:1});assert.equal(e.analytics(now).d7.rate,null);
});
test('no rewards for joins, paid-only participation, short battles or one-sided farming; ten reward battles per day',()=>{
 const {e,g}=setup();g.start();g.active.add('alice');g.elapsed=12000;e.finish(g);assert.equal(e.account('1').balance,0);
 g.status='finished';battle(g);g.elapsed=9000;e.finish(g);assert.equal(e.account('1').balance,0);
 g.status='finished';battle(g);g.active.delete('bob');e.finish(g);assert.equal(e.account('1').balance,0);
 for(let i=0;i<12;i++){g.status='finished';battle(g);e.finish(g,Date.parse('2026-10-29T10:00:00Z'));}assert.equal(e.account('1').balance,170);
});
test('creator drafts stay out of shop, missions pay once with bounded rewards and do not reset on republish',()=>{
 const {e,g}=setup();e.author({action:'mission',title:'Hold the line',story:'Your town survives.',objective:'attack',target:1,reward:20});const m=e.d.missions[0];assert.equal(e.catalog('key').missions.length,0);e.author({action:'publish',id:m.id,published:true});battle(g);e.finish(g);assert.equal(e.account('1').balance,55);assert.equal(e.account('2').balance,30);
 e.author({action:'publish',id:m.id,published:false});e.author({action:'publish',id:m.id,published:true});g.status='finished';battle(g);e.finish(g);assert.equal(e.account('1').balance,70);
 assert.throws(()=>e.author({action:'mission',title:'X',story:'Y',objective:'win',target:0,reward:999}));
});
test('PNG art bounded, private ledger never enters catalog/roster and retired equipped items remain',()=>{
 const {e,g}=setup();const image='data:image/png;base64,'+readFileSync('public/characters/char02V01.png').toString('base64');assert.ok(png(image));assert.throws(()=>png('data:image/svg+xml;base64,PHN2Zz4='));
 e.author({action:'item',name:'Custom',team:'red',price:0,image});const i=e.d.items.at(-1);assert.equal(e.catalog('key').items.some(x=>x.id===i.id),false);e.author({action:'publish',id:i.id,published:true});e.command('1','alice','!redeem '+i.id,'red');e.command('1','alice','!equip '+i.id,'red');e.author({action:'publish',id:i.id,published:false});assert.match(e.roster(g,'key').red[0].asset,/item-art/);assert.equal('accounts' in e.catalog('key'),false);assert.equal('ledger' in e.catalog('key'),false);
});
