import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../server/game.js';
import {Campaign} from '../server/campaign.js';
test('join balances new rosters, preserves remembered factions and infection, and cannot switch midbattle',()=>{
 const g=new Game({host:'host',blockedNames:['blocked']});g.campaign=new Campaign();
 assert.equal(g.chat('host','!join'),false);assert.equal(g.chat('blocked','!join'),false);
 assert.equal(g.chat('one','!join'),true);assert.equal(g.players.get('one'),'red');
 assert.equal(g.chat('two','!join'),true);assert.equal(g.players.get('two'),'blue');
 g.campaign.join('3','returning','blue');g.chat('returning','!join');assert.equal(g.players.get('returning'),'blue');
 g.campaign.join('4','infected','red');g.campaign.data.characters['4'].infected=true;g.chat('infected','!join');assert.equal(g.players.get('infected'),'blue');
 g.start();assert.equal(g.chat('one','!join'),false);assert.equal(g.chat('one','!zombie'),false);
 assert.deepEqual(g.counts(),{red:0,blue:0});
});
test('recap counts accepted votes only, records finish once and resets next battle',()=>{
 let saves=0;const g=new Game({save:()=>saves++});g.chat('one','!human');g.chat('two','!zombie');g.start();
 g.chat('one','!attack');g.chat('one','!attack');g.chat('two','!defend');g.advance(2000);
 g.chat('one','!heal');g.advance(2000);g.finish();
 assert.equal(g.recap.acceptedVotes,3);assert.equal(g.recap.participants,2);assert.equal(g.recap.duration,4);
 assert.deepEqual(g.recap.contributors,[{name:'one',votes:2},{name:'two',votes:1}]);
 const before=JSON.stringify(g.snapshot());g.finish();assert.equal(JSON.stringify(g.snapshot()),before);assert.equal(saves,1);
 g.start();assert.equal(g.recap,null);assert.equal(g.participation.size,0);
});
