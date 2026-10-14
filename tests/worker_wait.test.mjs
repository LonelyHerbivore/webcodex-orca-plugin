import test from 'node:test';
import assert from 'node:assert/strict';
import { waitForWorkers } from '../src/worker_wait.mjs';
import { interact, boot, call } from './helpers.mjs';

const good = {worker:{state:'succeeded'},dispatch:{status:'completed'}};
const working = {worker:{state:'running'},dispatch:{status:'active'}};
test('immediate settled result is read-only and not a new Host turn',async()=>{
  const seen=[];
  const result=await waitForWorkers({dispatchIds:['dispatch_a','dispatch_b'],waitSeconds:0,
    read:async id=>{seen.push(id);return good;}});
  assert.deepEqual(seen,['dispatch_a','dispatch_b']);
  assert.equal(result.waitOutcome,'all_settled');
  assert.equal(result.allSucceeded,true);
  assert.equal(result.newModelTurnStarted,false);
});
test('polls while running and returns one settled snapshot',async()=>{
  let clock=0;let reads=0;const sleeps=[];
  const result=await waitForWorkers({dispatchIds:['dispatch_a'],waitSeconds:4,
    read:async()=>{reads++;return reads===3?good:working;},
    now:()=>clock,sleep:async ms=>{sleeps.push(ms);clock+=ms;}});
  assert.equal(result.polls,3);
  assert.deepEqual(sleeps,[1500,1500]);
  assert.equal(result.waitOutcome,'all_settled');
});
test('deadline is an observation, not a successful completion',async()=>{
  let clock=0;
  const result=await waitForWorkers({dispatchIds:['dispatch_a'],waitSeconds:2,
    read:async()=>working,now:()=>clock,sleep:async ms=>{clock+=ms;}});
  assert.equal(result.waitOutcome,'wait_elapsed');
  assert.equal(result.allSettled,false);
  assert.equal(result.allSucceeded,false);
});
test('unknown Worker state requires attention, never restart',async()=>{
  const result=await waitForWorkers({dispatchIds:['dispatch_a'],waitSeconds:3,
    read:async()=>({worker:{state:'start_unknown'}})});
  assert.equal(result.waitOutcome,'needs_attention');
  assert.equal(result.polls,1);
});
test('invalid IDs and budgets are rejected before any read',async()=>{
  let reads=0;const read=async()=>{reads++;return good;};
  for(const args of [{dispatchIds:[]},{dispatchIds:['x','x']},{dispatchIds:['x','a/b']},
    {dispatchIds:['x'],waitSeconds:-1},{dispatchIds:['x'],waitSeconds:13}])
    await assert.rejects(waitForWorkers({...args,read}),/invalid_arguments|Dispatch IDs|waitSeconds/);
  assert.equal(reads,0);
});
test('Plugin v1 exposes bounded Worker wait and only issues worker-show',async()=>{
 const response=await interact([boot,call('orca_wait_workers',{dispatchIds:['dispatch_demo'],waitSeconds:0})]);
 assert.equal(response.records[1].result.structuredContent.result.waitOutcome,'all_settled');
 assert.equal(response.records[1].result.structuredContent.result.newModelTurnStarted,false);
 assert.deepEqual(response.commands,[['orchestration','worker-show','--dispatch','dispatch_demo','--json']]);
});
