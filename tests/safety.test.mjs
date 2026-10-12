import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {interact,boot,call} from './helpers.mjs';
import {runOrca, AmbiguousEffectError, OrcaError} from '../src/cli.mjs';
const fixture=resolve(fileURLToPath(new URL('./fixtures/fake-orca.mjs',import.meta.url)));

test('malformed JSON after mutating operation is OutcomeUnknown; plugin DOES NOT fabricate response',async()=>{
 const r=await interact([boot,call('orca_create_run',{objective:'x',fromTerminal:'term_owned'})],{mode:'invalid-json'});
 assert.equal(r.exit,1);assert.equal(r.records.length,1);
 assert.match(r.err,/ambiguous effect/i);
});
test('malformed JSON after read-only operation is a known read error',async()=>{
 const r=await interact([boot,call('orca_health')],{mode:'invalid-json'});
 assert.equal(r.exit,0);
 assert.equal(r.records[1].result.structuredContent.code,'invalid_json');
});
test('silent nonzero exit after mutation is ambiguous, not authorization to retry',async()=>{
 const r=await interact([boot,call('orca_create_run',{objective:'x',fromTerminal:'term_owned'})],{mode:'silent-fail'});
 assert.equal(r.exit,1);assert.equal(r.records.length,1);
});
test('timeouts preserve ambiguity for mutations but become ordinary failures for reads',async()=>{
 const old=process.env.ORCA_BIN, mode=process.env.ORCA_TEST_MODE;
 try {
  process.env.ORCA_BIN=fixture; process.env.ORCA_TEST_MODE='delay';
  await assert.rejects(runOrca(['orchestration','run-create','--objective','x','--from','term_owned'],{mutating:true,timeoutMs:60}),AmbiguousEffectError);
  await assert.rejects(runOrca(['status'],{timeoutMs:60}),e=>e instanceof OrcaError && e.code==='timeout');
 } finally {
  if(old===undefined) delete process.env.ORCA_BIN;else process.env.ORCA_BIN=old;
  if(mode===undefined) delete process.env.ORCA_TEST_MODE;else process.env.ORCA_TEST_MODE=mode;
 }
});
test('invalid schema fields and ranges are blocked before calling CLI',async()=>{
 const r=await interact([boot,call('orca_list_workers',{limit:500}),call('orca_read_worker',{dispatchId:'x',limit:1000}),call('orca_health',{surprise:true})]);
 assert.equal(r.commands.length,0);
 assert.ok(r.records.slice(1).every(x=>x.result.isError));
});
test('after an ambiguous effect, queued next mutating tool is not executed',async()=>{
 const r=await interact([boot,call('orca_create_run',{objective:'first',fromTerminal:'term_owned'}),call('orca_create_run',{objective:'second',fromTerminal:'term_owned'})],{mode:'invalid-json'});
 assert.equal(r.exit,1);
 assert.equal(r.commands.length,1);
 assert.match(r.commands[0].join(' '),/first/);
});
