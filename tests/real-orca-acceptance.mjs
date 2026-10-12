/** Opt-in real Orca 1.4.220 read-only regression: no worker starts, prompts or cleanup. */
import assert from 'node:assert/strict';
import { runOrca } from '../src/cli.mjs';
import { readPages } from '../src/transcript.mjs';
import { findCoordinator } from '../src/coordinator.mjs';

const dispatchId=process.argv[2] || process.env.ORCA_TEST_DISPATCH;
const worktree=process.argv[3] || process.env.ORCA_TEST_WORKTREE;
if(!dispatchId || !worktree) {
  console.error('Set ORCA_TEST_DISPATCH to an existing Dispatch and ORCA_TEST_WORKTREE to an existing workspace selector.');
  process.exit(2);
}
const status=await runOrca(['status']);
assert.equal(status.ok,true);
const coordinator=await findCoordinator(worktree,args=>runOrca(args));
assert.ok(['reused','missing','ambiguous','stale'].includes(coordinator.status));
const read=await readPages(dispatchId,'auto',10,3,args=>runOrca(args));
assert.equal(read.dispatchId,dispatchId);
assert.ok(read.pages.length>0 && read.pages.length<=3);
assert.ok(['stalled_cursor','end_of_pages','page_budget'].includes(read.stopReason));
if(read.integrity.source==='terminal'){
  assert.equal(read.integrity.sourceExact,false);
  assert.equal(read.integrity.complete,false);
}
console.log(JSON.stringify({ok:true,orcaVersion:status.result?.runtime?.appVersion??null,coordinator:{status:coordinator.status,terminal:coordinator.terminal??null,source:coordinator.source??null},transcript:{pages:read.pages.length,rows:read.content.length,nextCursorPresent:!!read.nextCursor,stopReason:read.stopReason,integrity:read.integrity}}));
