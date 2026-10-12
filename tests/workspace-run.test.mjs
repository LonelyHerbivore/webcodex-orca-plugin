import {test} from 'node:test';
import assert from 'node:assert/strict';
import {interact,boot,call} from './helpers.mjs';
test('workspace list selects Orca state without requiring Git',async()=>{
 const r=await interact([boot,call('orca_list_workspaces')]);
 assert.deepEqual(r.commands[0],['worktree','list','--json']);
 assert.equal(r.records[1].result.structuredContent.result.worktrees[0].id,'workspace-demo');
});
test('create Run passes explicit coordinator and omits --retry-request by default',async()=>{
 const r=await interact([boot,call('orca_create_run',{objective:'写第11章：A && B',fromTerminal:'term_owned'})]);
 assert.deepEqual(r.commands[0],['orchestration','run-create','--objective','写第11章：A && B','--from','term_owned','--json']);
 assert.equal(r.records[1].result.structuredContent.result.runId,'run_demo');
});
test('create Run requires explicit coordinator',async()=>{
 const r=await interact([boot,call('orca_create_run',{objective:'x'})]);
 assert.equal(r.records[1].result.structuredContent.code,'invalid_arguments');
 assert.equal(r.commands.length,0);
});
test('recovery UUID is included only when explicitly supplied',async()=>{
 const uuid='da2b6134-faff-4021-b934-f596a9a2b3e2';
 const r=await interact([boot,call('orca_create_run',{objective:'x',fromTerminal:'term_owned',retryRequest:uuid})]);
 assert.deepEqual(r.commands[0],['orchestration','run-create','--objective','x','--from','term_owned','--retry-request',uuid,'--json']);
});
test('invalid retry token is blocked before spawn',async()=>{
 const r=await interact([boot,call('orca_create_run',{objective:'x',fromTerminal:'term_owned',retryRequest:'invented-id'})]);
 assert.equal(r.records[1].result.structuredContent.code,'invalid_retry_request');
 assert.equal(r.commands.length,0);
});
