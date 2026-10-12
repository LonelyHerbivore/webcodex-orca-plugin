import {test} from 'node:test';
import assert from 'node:assert/strict';
import {interact,boot,call} from './helpers.mjs';

test('webcodex v1 initializes and discovers real tool schema',async()=>{
 const result=await interact([boot,{method:'tools/list',params:{}}]);
 assert.equal(result.exit,0);
 assert.equal(result.records[0].result.protocolVersion,'webcodex-plugin-v1');
 const ts=result.records[1].result.tools;
 assert.equal(ts.length,21);assert.equal(ts[0].name,'orca_health');
 assert.equal(new Set(ts.map(x=>x.name)).size,ts.length);
 assert.equal(ts[0].inputSchema.type,'object');
});
test('rejects invalid JSON-RPC method before initialization',async()=>{
 const r=await interact([{method:'tools/list',params:{}}]);
 assert.equal(r.records[0].error.message,'Not initialized');
});

test('all 21 tools stay within WebCodex native v1 schema keyword profile',async()=>{
 const r=await interact([boot,{method:'tools/list',params:{}}]);
 const defs=r.records[1].result.tools;
 const allowed=new Set(['type','description','title','enum','const','properties','required','additionalProperties','minLength','maxLength','items','minItems','maxItems']);
 for(const entry of defs){
   assert.equal(entry.inputSchema.type,'object');
   assert.equal(entry.inputSchema.additionalProperties,false);
   for(const prop of Object.values(entry.inputSchema.properties)){
     for(const keyword of Object.keys(prop)) assert.ok(allowed.has(keyword),`${entry.name}: unexpected ${keyword}`);
     assert.ok(['string','boolean','integer'].includes(prop.type));
   }
   for(const needed of entry.inputSchema.required) assert.ok(needed in entry.inputSchema.properties);
 }
});
