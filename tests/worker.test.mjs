import {test} from 'node:test';
import assert from 'node:assert/strict';
import {interact,boot,call} from './helpers.mjs';

test('start_worker creates supervised task on explicitly selected worktree',async()=>{
 const a={runId:'run_demo',fromTerminal:'term_owned',agent:'claude',worktree:'id:worktree-demo',spec:'审查文本；不要写文件',taskTitle:'审查'};
 const result=await interact([boot,call('orca_start_worker',a)]);
 assert.deepEqual(result.commands[0],['orchestration','worker-start','--spec',a.spec,'--run','run_demo','--from','term_owned','--worktree','id:worktree-demo','--agent','claude','--task-title','审查','--json']);
 assert.equal(result.records[1].result.structuredContent.result.dispatchId,'dispatch_demo');
});
test('start_worker checks model/effort compatibility before CLI spawn',async()=>{
 const r=await interact([boot,call('orca_start_worker',{runId:'r',fromTerminal:'term_owned',agent:'codex',worktree:'current',spec:'task',effort:'high'})]);
 assert.equal(r.records[1].result.structuredContent.code,'invalid_arguments');assert.equal(r.commands.length,0);
});
test('list_workers exposes Orca resource states without modifying workers',async()=>{
 const r=await interact([boot,call('orca_list_workers',{runId:'run_demo',limit:5,includeRemote:true,terminalState:'reclaimable'})]);
 assert.deepEqual(r.commands[0],['orchestration','worker-list','--run','run_demo','--limit','5','--include-remote','--terminal-state','reclaimable','--json']);
 assert.equal(r.records[1].result.structuredContent.result.workers[0].workerState,'running');
});
test('read_worker reads auto transcript with opaque continuation cursor',async()=>{
 const r=await interact([boot,call('orca_read_worker',{dispatchId:'dispatch_demo',source:'auto',limit:15,cursor:'cursor_1'})]);
 assert.deepEqual(r.commands[0],['orchestration','worker-read','--dispatch','dispatch_demo','--source','auto','--limit','15','--cursor','cursor_1','--json']);
 assert.equal(r.records[1].result.structuredContent.result.nextCursor,'cursor_2');
});
test('show_worker targets exact Dispatch id',async()=>{
 const r=await interact([boot,call('orca_show_worker',{dispatchId:'dispatch_demo'})]);
 assert.deepEqual(r.commands[0],['orchestration','worker-show','--dispatch','dispatch_demo','--json']);
 assert.equal(r.records[1].result.structuredContent.result.workerState,'succeeded');
});

test('start_worker refuses missing coordinator terminal before CLI spawn',async()=>{
 const r=await interact([boot,call('orca_start_worker',{runId:'r',agent:'claude',worktree:'current',spec:'task'})]);
 assert.equal(r.records[1].result.structuredContent.code,'invalid_arguments');
 assert.equal(r.commands.length,0);
});
