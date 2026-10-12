import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readPages, integrity } from '../src/transcript.mjs';

test('exact two-page transcript is only complete at end of pagination', async () => {
  const seen=[];
  const r=await readPages('ctx_a','auto',2,5,async argv => {
    seen.push(argv);
    const first=seen.length===1;
    return {result:{dispatchId:'ctx_a',source:'transcript',sourceIdentity:'identity1',
      sourceExact:true,contentComplete:true,clipping:[],transcript:{events:first?['a','b']:['c']},
      cursor:first?'cursor-2':null}};
  });
  assert.deepEqual(r.content,['a','b','c']);
  assert.equal(r.integrity.complete,true);
  assert.equal(seen[1].includes('cursor-2'),true);
});
test('terminal fallback cannot assert completeness even when fully paged', async () => {
  const r=await readPages('ctx_a','auto',5,1,async()=>({result:{dispatchId:'ctx_a',source:'terminal',
     sourceIdentity:'terminal1',sourceExact:false,contentComplete:false,
     clipping:['terminal_fallback'],terminal:{tail:['fragment']},cursor:null}}));
  assert.equal(r.integrity.complete,false);
  assert.equal(r.integrity.warning,'not_exact_transcript');
  assert.equal(r.content[0],'fragment');
});
test('bounded pages never silently claim all content',async () => {
  const r=await readPages('ctx_a','auto',1,1,async()=>({result:{dispatchId:'ctx_a',source:'transcript',
     sourceIdentity:'id',sourceExact:true,contentComplete:true,transcript:{events:['a']},cursor:'next'}}));
  assert.equal(r.nextCursor,'next');
  assert.equal(r.integrity.complete,false);
  assert.equal(r.integrity.warning,'pagination_incomplete');
});
test('changed source identity rejects stitched transcript',async () => {
  let n=0;
  await assert.rejects(()=>readPages('ctx_a','auto',1,3,async()=>({result:{dispatchId:'ctx_a',source:'transcript',sourceIdentity:(++n===1?'a':'b'),sourceExact:true,contentComplete:true,cursor:n===1?'next':null}})), /source changed/i);
});
test('cursor loops fail closed',async () => {
  await assert.rejects(()=>readPages('ctx_a','auto',1,4,async()=>({result:{dispatchId:'ctx_a',source:'transcript',sourceIdentity:'a',sourceExact:true,contentComplete:true,cursor:'constant'}})), /non-advancing cursor/);
});
test('unproven provenance does not report complete',()=>assert.equal(integrity({source:'transcript',contentComplete:true},true).complete,false));

test('Orca 1.4.220 terminal cursor refresh is a safe stalled partial page', async () => {
  let n=0;
  const r=await readPages('ctx_live','auto',10,5,async()=>({result:{
    dispatchId:'ctx_live', source:'terminal',sourceIdentity:'same_identity',
    sourceExact:++n!==1,contentComplete:n!==1,
    clipping:n===1?['terminal_fallback']:undefined,
    terminal:{tail:n===1?['CLAUDE_HELLO_OK']:[],nextCursor:'owr1_fixed'},
    cursor:'owr1_fixed'
  }}));
  assert.equal(n,2);
  assert.deepEqual(r.content,['CLAUDE_HELLO_OK']);
  assert.equal(r.nextCursor,'owr1_fixed');
  assert.equal(r.integrity.complete,false);
  assert.equal(r.integrity.sourceExact,false);
  assert.ok(r.integrity.clipping.includes('terminal_fallback'));
  assert.equal(r.stopReason,'stalled_cursor');
});

test('nonterminal empty repeating cursor remains protected', async () => {
  let n=0;
  await assert.rejects(()=>readPages('ctx_a','transcript',1,5,async()=>({result:{dispatchId:'ctx_a',source:'transcript',sourceIdentity:'id',sourceExact:true,contentComplete:true,transcript:{events:++n===1?['x']:[]},cursor:'same'}})), /non-advancing cursor/);
});
