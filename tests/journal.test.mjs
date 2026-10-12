import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync,existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once,intentStatus } from '../src/journal.mjs';
import { AmbiguousEffectError, OrcaError } from '../src/cli.mjs';
const identity={runId:'run_A',fromTerminal:'term_A',agent:'agy',worktree:'path:D:/example-workspace',spec:'read only',taskTitle:null,model:null,effort:null};
const scratchBase=process.env.ORCA_PLUGIN_TEST_TMPDIR || (process.platform==='win32' && existsSync('D:\\') ? 'D:\\' : tmpdir());
const sandbox = async fn => {const dir=mkdtempSync(join(scratchBase,'orca-journal-'));process.env.ORCA_PLUGIN_STATE_DIR=dir;try{await fn();}finally{delete process.env.ORCA_PLUGIN_STATE_DIR;rmSync(dir,{force:true,recursive:true});}};
test('a confirmed launch is replayed from persistent journal without a second CLI effect',()=>sandbox(async()=>{
 let called=0;const fn=async()=>{called++;return {result:{dispatchId:'ctx_1'}}};
 const first=await once('worker_start',identity,fn);
 const second=await once('worker_start',identity,fn);
 assert.equal(first.result.dispatchId,'ctx_1');
 assert.equal(second.replayedFromJournal,true); assert.equal(called,1);
 assert.equal(intentStatus('worker_start',identity).status,'confirmed');
}));
test('OutcomeUnknown survives provider recreation and blocks duplicate Worker launch',()=>sandbox(async()=>{
 let called=0;
 await assert.rejects(()=>once('worker_start',identity,async()=>{called++;throw new AmbiguousEffectError('read lost')}),AmbiguousEffectError);
 assert.equal(intentStatus('worker_start',identity).status,'outcome_unknown');
 await assert.rejects(()=>once('worker_start',identity,async()=>{called++;return {ok:true}}),e=>e.code==='operation_unresolved');
 assert.equal(called,1);
}));
test('pending intent fences concurrent invocations',()=>sandbox(async()=>{
 let release;let calls=0;
 const promise=once('worker_start',identity,async()=>{calls++;await new Promise(r=>release=r);return {result:{dispatchId:'ctx_2'}};});
 await assert.rejects(()=>once('worker_start',identity,async()=>{calls++;}),e=>e.code==='operation_unresolved');
 release();await promise;assert.equal(calls,1);
}));
test('known refusal is not treated as an unknown launch',()=>sandbox(async()=>{
 await assert.rejects(()=>once('worker_start',identity,async()=>{throw new OrcaError('orca_rejected','no')}),OrcaError);
 assert.equal(intentStatus('worker_start',identity).status,'rejected');
}));
