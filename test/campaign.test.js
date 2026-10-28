import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Campaign } from '../server/campaign.js';
import { Game } from '../server/game.js';
test('persistent identity survives rename; absent characters unaffected; infection and free rescue', () => {
 const c = new Campaign(); const g = new Game(); g.campaign = c;
 c.join('1','alice','red'); c.join('2','absent','red');
 g.chat('alice','!human'); g.start(); g.chat('alice','!attack');
 g.teams.red.line=0; g.finish();
 assert.equal(c.data.characters['1'].infected,true);
 assert.equal(c.data.characters['2'].chapters,0);
 assert.equal(c.data.supplies,3);
 const restored=new Campaign(JSON.parse(JSON.stringify(c.data)));
 restored.identify('1','renamed'); assert.match(restored.status('renamed'),/INFECTED/);
 assert.equal(restored.rescue('renamed',g),true);
 assert.equal(restored.data.supplies,0);
 assert.equal(restored.data.characters['1'].infected,false);
 assert.equal(Object.keys(restored.data.characters).length,2);
});
test('infection puts a returning player on Zombies; no empty-round supply farming', () => {
 const c=new Campaign(); const g=new Game();g.campaign=c;
 c.join('1','a','red');c.data.characters['1'].infected=true;g.chat('a','!human');g.start();
 assert.equal(g.players.get('a'),'blue');g.finish();assert.equal(c.data.supplies,0);
});
test('Twitch convoy outcomes and receipt replay survive restart; gifted subscription is not double awarded', () => {
 const c=new Campaign();
 assert.equal(c.event('channel.raid',{},'raid'),true);
 const restored=new Campaign(JSON.parse(JSON.stringify(c.data)));
 assert.equal(restored.event('channel.raid',{},'raid'),false);
 assert.equal(restored.event('channel.subscribe',{is_gift:true},'gift-recipient'),false);
 restored.event('channel.subscription.gift',{},'gift');assert.equal(restored.data.supplies,1);
 const g=new Game(); g.campaign=restored;g.chat('a','!human');g.start();g.chat('a','!attack');g.teams.blue.line=0;g.finish();
 assert.equal(restored.data.supplies,7);assert.equal(restored.data.objective,null);
 assert.equal(restored.data.settlement,80);
 assert.match(restored.data.chronicle.map(x=>x.text).join(' '),/evacuation secured/);
});
import { openStorage } from '../server/storage.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
test('self-hosted storage restores characters, campaign, chronicle and receipts without exposing IDs', async () => {
 const dir=await mkdtemp(path.join(tmpdir(),'frenemies-campaign-'));
 try {
  const c=new Campaign();c.join('12345','viewer','red');c.event('channel.hype_train.begin',{},'receipt');
  let store=await openStorage({dataDir:dir});await store.put('channel',{campaign:c.data});await store.close();
  store=await openStorage({dataDir:dir});const loaded=new Campaign(store.data.channel.campaign);
  assert.equal(loaded.data.characters['12345'].name,'viewer');
  assert.equal(loaded.event('channel.hype_train.begin',{},'receipt'),false);
  assert.equal(loaded.snapshot().objective.title,'Hype evacuation');
  assert.equal(JSON.stringify(loaded.snapshot()).includes('12345'),false);
  await store.close();
 } finally {await rm(dir,{recursive:true,force:true});}
});
