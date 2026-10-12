import {test} from 'node:test';
import assert from 'node:assert/strict';
import {findCoordinator,COORDINATOR_TITLE} from '../src/coordinator.mjs';
import {interact,boot,call} from './helpers.mjs';
import {mkdtempSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {after} from 'node:test';
const scratchBase=process.env.ORCA_PLUGIN_TEST_TMPDIR || (process.platform==='win32' && existsSync('D:\\') ? 'D:\\' : tmpdir());
const temp=mkdtempSync(join(scratchBase,'orca-coord-'));
process.env.ORCA_PLUGIN_STATE_DIR=temp;
after(()=>{delete process.env.ORCA_PLUGIN_STATE_DIR;rmSync(temp,{recursive:true,force:true})});
test('missing coordinator is diagnosed without side effects',async()=>{
 let reads=0;
 const v=await findCoordinator('path:D:/example-workspace',async argv=>{reads++;return {result:argv[0]==='terminal'?{terminals:[]}:{runs:[],nextCursor:null}}});
 assert.equal(v.status,'missing');assert.equal(v.headlessSupported,false);assert.equal(reads,2);
});
test('one named coordinator is reused across lookup calls',async()=>{
 const query=async argv=>({result:argv[0]==='terminal'?{terminals:[{title:COORDINATOR_TITLE,handle:'term_exact'}]}:{runs:[],nextCursor:null}});
 assert.equal((await findCoordinator('path:D:/example-workspace',query)).terminal,'term_exact');
 assert.equal((await findCoordinator('path:D:/example-workspace',query)).status,'reused');
});
test('ambiguous or malformed coordinator identity fails closed',async()=>{
 assert.equal((await findCoordinator('p',async argv=>({result:argv[0]==='terminal'?{terminals:[{title:COORDINATOR_TITLE,handle:'term_a'},{title:COORDINATOR_TITLE,handle:'term_b'}]}:{runs:[],nextCursor:null}}))).status,'ambiguous');
 await assert.rejects(()=>findCoordinator('p',async argv=>({result:argv[0]==='terminal'?{terminals:[{title:COORDINATOR_TITLE,handle:'not-a-handle'}]}:{runs:[],nextCursor:null}})),/exact terminal handle/);
});
test('Worker retry token cannot bypass uncertainty status inspection',async()=>{
 const r=await interact([boot,call('orca_start_worker',{runId:'run1',fromTerminal:'term_x',agent:'agy',worktree:'path:D:/example-workspace',spec:'test',retryRequest:'da2b6134-faff-4021-b934-f596a9a2b3e2'})]);
 assert.equal(r.records[1].result.structuredContent.code,'recovery_read_only_first');
 assert.equal(r.commands.length,0);
});


test('restore coordinator directly from Orca Run registry after plugin-state loss',async()=>{
 let calls=0;
 const r=await findCoordinator('path:D:/example-workspace',async argv=>{
   calls++;
   if(argv[0]==='terminal')return {result:{terminals:[{handle:'term_existing',title:'MINGW64:/d/example-workspace',connected:true}]}};
   return {result:{runs:[{id:'run_existing',coordinator_handle:'term_existing'}],nextCursor:null}};
 });
 assert.equal(calls,2);
 assert.equal(r.status,'reused');assert.equal(r.source,'orca_run_registry');
 assert.equal(r.terminal,'term_existing');assert.deepEqual(r.runIds,['run_existing']);
});
test('two live Orca coordinators are ambiguous; no accidental choice',async()=>{
 const r=await findCoordinator('path:D:/example-workspace',async argv=>({result:argv[0]==='terminal'?{
   terminals:[{handle:'term_1',title:'shell'},{handle:'term_2',title:'shell'}]
 }:{runs:[{id:'run_1',coordinator_handle:'term_1'},{id:'run_2',coordinator_handle:'term_2'}],nextCursor:null}}));
 assert.equal(r.status,'ambiguous');assert.equal(r.candidates.length,2);
});
test('stale Orca Run coordinator does not match missing terminal',async()=>{
 const r=await findCoordinator('path:D:/example-workspace',async argv=>({result:argv[0]==='terminal'?{
   terminals:[{handle:'term_worker',title:'worker'}]
 }:{runs:[{id:'run_old',coordinator_handle:'term_absent'}],nextCursor:null}}));
 assert.equal(r.status,'missing');
});
