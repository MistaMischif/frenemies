import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync,writeFileSync} from 'node:fs';import {webcrypto} from 'node:crypto';import {Campaign} from '../server/campaign.js';import {TerritoryGame} from '../server/territory.js';
class Element {
 constructor(tag='div'){this.tag=tag;this.children=[];this.attributes={};this.style={};this.dataset={};this.value='';this.textContent='';this.hidden=false;}
 setAttribute(k,v){this.attributes[k]=String(v)}
 append(...nodes){this.children.push(...nodes)}
 replaceChildren(...nodes){this.children=[...nodes]}
 get childNodes(){return this.children}get options(){return this.children}
}
test('territory interface renders all regions/figures and enemy destination selection preserves acting figure',async()=>{
 const elements={};for(const [,id]of readFileSync('public/territory.html','utf8').matchAll(/id="([^"]+)"/g)){elements[id]=new Element(id==='map'?'svg':'div');elements[id].setAttribute('id',id)}
 const campaign=new Campaign(),game=new TerritoryGame(campaign);game.execute({action:'start',revision:0,requestId:'ui-start'});
 const payload=()=>({csrf:'test-only',persistent:true,state:game.snapshot(),campaign:campaign.snapshot(),overlay:'/territory/test',bridge:'/api/living-table/test'});
 const context=vm.createContext({document:{getElementById:id=>elements[id],createElement:tag=>new Element(tag),createElementNS:(_,tag)=>new Element(tag)},location:{pathname:'/territory'},crypto:webcrypto,Uint8Array,fetch:async(_,options)=>{if(options?.method==='POST')game.execute(JSON.parse(options.body));return {ok:true,status:200,json:async()=>payload()}},setInterval:()=>0});
 vm.runInContext(readFileSync('public/territory.js','utf8'),context);await vm.runInContext('update()',context);
 assert.equal(elements.map.children.filter(n=>n.attributes.class?.includes('region')).length,12);assert.equal(elements.map.children.filter(n=>n.attributes.class==='figure').length,6);
 vm.runInContext('regionNodes.B1.g.onclick()',context);assert.equal(vm.runInContext('selected',context),'H1');assert.equal(vm.runInContext('target',context),'B1');
 await vm.runInContext("post({action:'move',pieceId:'H1',target:'A2'})",context);assert.equal(game.s.pieces.H1.location,'A2');assert.match(elements['piece-info'].textContent,/A2/);
 if(process.env.FRENEMIES_SVG_PREVIEW){
  const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
  const serialize=n=>{const a={...n.attributes};if(a.href?.startsWith('/'))a.href='data:image/png;base64,'+readFileSync('public'+a.href).toString('base64');if(n.style.transform)a.transform=n.style.transform.replaceAll('px','');if(n.style.display)a.display=n.style.display;return '<'+n.tag+' '+Object.entries(a).map(([k,v])=>k+'="'+escape(v)+'"').join(' ')+'>'+escape(n.textContent)+n.children.map(serialize).join('')+'</'+n.tag+'>'};
  elements.map.setAttribute('xmlns','http://www.w3.org/2000/svg');elements.map.setAttribute('viewBox','0 0 1200 825');elements.map.setAttribute('width',1200);elements.map.setAttribute('height',825);
  const css=readFileSync('public/territory.css','utf8');let svg=serialize(elements.map);svg=svg.replace('><', '><style>'+css+'</style><');writeFileSync(process.env.FRENEMIES_SVG_PREVIEW,svg);
 }
});
