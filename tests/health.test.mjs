import {test} from 'node:test';
import assert from 'node:assert/strict';
import {interact,boot,call} from './helpers.mjs';
test('health uses one read-only Orca JSON request and returns structuredContent',async()=>{
 const r=await interact([boot,call('orca_health')]);
 assert.deepEqual(r.commands,[['status','--json']]);
 assert.equal(r.records[1].result.isError,false);
 assert.equal(r.records[1].result.structuredContent.result.runtime.state,'ready');
});
