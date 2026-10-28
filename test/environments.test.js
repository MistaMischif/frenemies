import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseEnvironmentUpload,environmentList} from '../server/environments.js';
test('environment upload rejects unsupported formats, oversized content, and invalid names',()=>{
 assert.throws(()=>parseEnvironmentUpload({name:'x',image:'data:image/svg+xml;base64,PHN2Zz4='}));
 assert.throws(()=>parseEnvironmentUpload({name:'x',image:'data:image/jpeg;base64,aGVsbG8='}));
 assert.throws(()=>parseEnvironmentUpload({name:'',image:'data:image/jpeg;base64,/9j/2Q=='}));
 assert.throws(()=>parseEnvironmentUpload({name:'x',image:'data:image/jpeg;base64,'+Buffer.alloc(600000).toString('base64')}));
});
test('environment metadata excludes image payload and scopes URLs to overlay',()=>{
 const asset=parseEnvironmentUpload({name:'Example',image:'data:image/jpeg;base64,/9j/2Q=='});
 const list=environmentList({overlay:'overlay-key',environmentAssets:[asset]});
 assert.equal(list.length,4);assert.equal(list[3].name,'Example');
 assert.equal(list[3].url,`/environment/overlay-key/${asset.id}`);
 assert.equal(JSON.stringify(list).includes('base64'),false);
});
