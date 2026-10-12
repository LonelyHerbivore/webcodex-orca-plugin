import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lifecycle} from '../src/lifecycle.mjs';

test('input accepted and turn started do not prove worker completion',()=>{
  assert.equal(lifecycle({submission:{state:'input_accepted'}}).phase,'input_accepted');
  const x=lifecycle({submission:{state:'turn_started'}});
  assert.equal(x.phase,'turn_started');assert.equal(x.settled,false);
});
test('completed Dispatch alone does not imply worker_done',()=>{
 const x=lifecycle({dispatch:{id:'ctx1',status:'completed'},worker:{state:'running'}});
 assert.equal(x.phase,'working');assert.equal(x.settled,false);
});
test('succeeded worker plus completed Dispatch proves worker_done',()=>{
 const x=lifecycle({dispatch:{id:'ctx1',status:'completed'},worker:{state:'succeeded'},terminalResource:{ownerDispatchId:'ctx1',releaseState:'reclaimable'}});
 assert.equal(x.phase,'worker_done');assert.equal(x.mayRelease,true);
});
test('user takeover forbids release even when settled',()=>{
 const x=lifecycle({dispatch:{id:'ctx1',status:'completed'},worker:{state:'succeeded'},terminalResource:{ownerDispatchId:'ctx1',releaseState:'reclaimable',retainedReason:'user_takeover'}});
 assert.equal(x.userTakeover,true);assert.equal(x.mayRelease,false);
});
test('unproven owner does not grant release',()=>{
 const x=lifecycle({dispatch:{id:'ctx1',status:'completed'},worker:{state:'succeeded'},terminalResource:{releaseState:'reclaimable'}});
 assert.equal(x.mayRelease,false);
});
test('real Orca input_accepted stage does not imply completion',()=>{
 const x=lifecycle({worker:{state:'ready',stage:'input_accepted'},dispatch:{id:'ctx1',status:'dispatched'}});
 assert.equal(x.phase,'input_accepted');assert.equal(x.settled,false);
});
test('start_unknown remains unresolved rather than failed or settled',()=>{
 const x=lifecycle({workerState:'start_unknown',dispatchStatus:'pending'});
 assert.equal(x.phase,'start_unknown');assert.equal(x.settled,false);
});
test('release already completed is not repeated',()=>{
 const x=lifecycle({dispatch:{id:'ctx1',status:'completed'},worker:{state:'succeeded'},terminalResource:{ownerDispatchId:'ctx1',releaseState:'released'}});
 assert.equal(x.mayRelease,false);
});
