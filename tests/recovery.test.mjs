import {test} from 'node:test';
import assert from 'node:assert/strict';
import {interact,boot,call} from './helpers.mjs';

test('malformed JSON request returns parse error without killing provider',async()=>{
 const r=await interact(['{not json',boot,{method:'tools/list',params:{}}]);
 assert.equal(r.exit,0);
 assert.equal(r.records[0].error.code,-32700);
 assert.equal(r.records[1].result.protocolVersion,'webcodex-plugin-v1');
 assert.ok(r.records[2].result.tools.length>=20);
});
test('recovery snapshot reads Run, Task, Worker without starting any Worker',async()=>{
 const r=await interact([boot,call('orca_recovery_snapshot',{runId:'run_demo'})]);
 assert.equal(r.exit,0);
 assert.deepEqual(r.commands,[
 ['orchestration','run-show','--id','run_demo','--json'],
 ['orchestration','task-list','--run','run_demo','--json'],
 ['orchestration','worker-list','--run','run_demo','--limit','100','--json'],
 ]);
 assert.equal(r.records[1].result.structuredContent.result.workers.workers[0].dispatchId,'dispatch_demo');
 assert.equal(r.records[1].result.structuredContent.result.readOnly,true);
});
