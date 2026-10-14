#!/usr/bin/env node
import { appendFileSync } from 'node:fs';
const args = process.argv.slice(2);
if (process.env.ORCA_TEST_LOG) appendFileSync(process.env.ORCA_TEST_LOG,JSON.stringify(args)+'\n');
const mode = process.env.ORCA_TEST_MODE;
if (mode === 'invalid-json') { console.log('not json'); process.exit(0); }
if (mode === 'refuse') { console.log(JSON.stringify({id:'sim',ok:false,error:{message:'refused'}})); process.exit(1); }
if (mode === 'silent-fail') process.exit(2);
if (mode === 'delay') await new Promise(resolve=>setTimeout(resolve,2000));
const root = args[0]==='orchestration' ? args[1] : args[0];
const requestedDispatch = args.includes('--dispatch') ? args[args.indexOf('--dispatch')+1] : 'dispatch_demo';
const result = root==='status' ? {runtime:{state:'ready'},app:{running:true},capabilities:['orchestration.contract.v1']} :
root==='worktree' ? {worktrees:[{id:'workspace-demo',path:'D:\\example-workspace'}]} :
root==='run-create' ? {runId:'run_demo'} :
root==='run-show' ? {id:'run_demo',status:'active'} :
root==='run-list' ? {runs:[],nextCursor:null} :
root==='task-list' ? {tasks:[{id:'task_demo',runId:'run_demo'}]} :
root==='worker-start' ? {taskId:'task_demo',dispatchId:'dispatch_demo',stage:'ready'} :
root==='worker-list' ? {workers:[{dispatchId:'dispatch_demo',workerState:'running'}]} :
root==='worker-read' ? {rows:[{text:'工作完成'}],nextCursor:'cursor_2'} :
root==='worker-show' ? {dispatchId:requestedDispatch,workerState:'succeeded',dispatch:{id:requestedDispatch,status:'completed'},worker:{state:'succeeded'},terminalResource:{ownerDispatchId:requestedDispatch,ownershipState:'owned',releaseState:'reclaimable',retainedReason:mode==='takeover'?'user_takeover':null}} :
root==='send' ? {messageId:'message_demo'} :
root==='check' ? {deliveryId:'delivery_demo',messages:[{id:'m1',body:'收到'}]} :
root==='reply' ? {messageId:'reply_demo'} :
root==='worker-release' ? {terminalState:'released'} :
root==='worker-stop' ? {workerState:'stopped'} :
root==='terminal' ? {accepted:true,submission:{state:'turn_started'}} : {};
console.log(JSON.stringify({id:'sim',ok:true,result}));
