import {test} from 'node:test';
import assert from 'node:assert/strict';
import {interact,boot,call} from './helpers.mjs';
test('release_worker targets one settled Dispatch without generic close',async()=>{
 const r=await interact([boot,call('orca_release_worker',{dispatchId:'dispatch_demo'})]);
 assert.deepEqual(r.commands[0],['orchestration','worker-show','--dispatch','dispatch_demo','--json']);
 assert.deepEqual(r.commands[1],['orchestration','worker-release','--dispatch','dispatch_demo','--json']);
 assert.equal(r.records[1].result.structuredContent.result.terminalState,'released');
});
test('release_worker requires exact dispatch',async()=>{
 const r=await interact([boot,call('orca_release_worker',{})]);
 assert.equal(r.records[1].result.isError,true);
 assert.deepEqual(r.commands,[]);
});
test('worker_stop fences one owned Dispatch, never an entire worktree',async()=>{
 const r=await interact([boot,call('orca_stop_worker',{dispatchId:'dispatch_demo'})]);
 assert.deepEqual(r.commands[0],['orchestration','worker-show','--dispatch','dispatch_demo','--json']);
 assert.deepEqual(r.commands[1],['orchestration','worker-stop','--dispatch','dispatch_demo','--json']);
 assert.equal(r.records[1].result.structuredContent.result.workerState,'stopped');
});
test('Orca explicit refusal remains a known application error',async()=>{
 const r=await interact([boot,call('orca_release_worker',{dispatchId:'dispatch_demo'})],{mode:'refuse'});
 assert.equal(r.records[1].result.isError,true);
 assert.equal(r.records[1].result.structuredContent.code,'orca_rejected');
 assert.equal(r.exit,0);
});
test('a user-taken-over worker cannot be stopped or released by the plugin',async()=>{
 for(const tool of ['orca_stop_worker','orca_release_worker']){
   const r=await interact([boot,call(tool,{dispatchId:'dispatch_demo'})],{mode:'takeover'});
   assert.equal(r.records[1].result.structuredContent.code,tool==='orca_stop_worker'?'unsafe_stop':'unsafe_release');
   assert.deepEqual(r.commands,[['orchestration','worker-show','--dispatch','dispatch_demo','--json']]);
 }
});
