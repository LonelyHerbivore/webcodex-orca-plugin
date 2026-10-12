import {test} from 'node:test';
import assert from 'node:assert/strict';
import {interact,boot,call} from './helpers.mjs';
test('terminal prompt preserves Unicode without shell concatenation',async()=>{
 const text='你好\n第一行 && echo injected';
 const r=await interact([boot,call('orca_send_prompt',{terminal:'term_A',text,waitSubmitSeconds:5})]);
 assert.deepEqual(r.commands[0],['terminal','send','--terminal','term_A','--text',text,'--enter','--wait-submit','5','--json']);
 assert.equal(r.records[1].result.structuredContent.result.submission.state,'turn_started');
});
test('send message from exact coordinator',async()=>{
 const r=await interact([boot,call('orca_send_message',{runId:'run_demo',fromTerminal:'term_owner',recipient:'dispatch:dispatch_1',subject:'分工',body:'检查章节冲突'})]);
 assert.deepEqual(r.commands[0],['orchestration','send','--run','run_demo','--from','term_owner','--to','dispatch:dispatch_1','--subject','分工','--body','检查章节冲突','--type','status','--json']);
});
test('send message rejects implicit recipient and missing coordinator',async()=>{
 const r=await interact([boot,call('orca_send_message',{runId:'run_demo',fromTerminal:'term_owner',recipient:'@all',subject:'S',body:'B'}),call('orca_send_message',{runId:'run_demo',recipient:'run:run_demo',subject:'S',body:'B'})]);
 assert.equal(r.commands.length,0);
 assert.ok(r.records.slice(1).every(x=>x.result.isError));
});
test('peek is non-consuming and uses exact terminal binding',async()=>{
 const r=await interact([boot,call('orca_check_messages',{runId:'run_demo',fromTerminal:'term_owner'})]);
 assert.deepEqual(r.commands[0],['orchestration','check','--run','run_demo','--terminal','term_owner','--peek','--json']);
});
test('receive delivery returns ACK-able deliveryId, then ACK it once',async()=>{
 const a={runId:'run_demo',fromTerminal:'term_owner'};
 const r=await interact([boot,call('orca_receive_delivery',a),call('orca_ack_messages',{...a,deliveryId:'delivery_demo'})]);
 assert.deepEqual(r.commands,[
 ['orchestration','check','--run','run_demo','--terminal','term_owner','--json'],
 ['orchestration','check','--run','run_demo','--terminal','term_owner','--ack','delivery_demo','--json']]);
 assert.equal(r.records[1].result.structuredContent.result.deliveryId,'delivery_demo');
});
test('question reply uses exact message ID, no invented retry token',async()=>{
 const r=await interact([boot,call('orca_reply_message',{messageId:'msg_1',body:'仅修改当前文件'})]);
 assert.deepEqual(r.commands[0],['orchestration','reply','--id','msg_1','--body','仅修改当前文件','--json']);
});
