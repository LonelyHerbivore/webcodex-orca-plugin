import { tool, field } from './protocol.mjs';
import { runOrca, normalizeResult, argsWithRetry, OrcaError } from './cli.mjs';
import { integrity, readPages } from './transcript.mjs';
import { once, intentStatus } from './journal.mjs';
import { lifecycle } from './lifecycle.mjs';
import { findCoordinator, COORDINATOR_TITLE } from './coordinator.mjs';
import { waitForWorkers } from './worker_wait.mjs';
const f = field;
const r = async (op, args, mutating=false, timeoutMs=20000) => normalizeResult(op, await runOrca(args,{mutating,timeoutMs}));
const readOnly = {readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false};
const mut = {readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:true};
const destructive = {...mut,destructiveHint:true};
export const tools = [
  tool('orca_health','Read Orca runtime status and capability list.',{},[],async()=>r('health',['status']),readOnly),
  tool('orca_list_workspaces','List Orca authoritative folder/worktree selectors; do not assume a Git repo.',{},[],async()=>r('list_workspaces',['worktree','list']),readOnly),
  tool('orca_create_run','Create an Orca orchestration Run from one owned coordinator terminal.',{
    objective:f.str('Goal for this Run',4096), fromTerminal:f.str('Exact owned coordinator terminal handle',128), retryRequest:f.optionalStr('Orca-issued recovery UUID only after outcome_unknown',128),
  },['objective','fromTerminal'],async({objective,fromTerminal,retryRequest})=>r('create_run',argsWithRetry(['orchestration','run-create','--objective',objective,'--from',fromTerminal],retryRequest),true),mut),

  tool('orca_request_status','Read-only check of an Orca-issued mutation request UUID; absent is not proof no effect.',{
    requestId:f.str('Exact Orca-issued request UUID',128),
  },['requestId'],async(a)=>r('request_status',['orchestration','request-show','--request',a.requestId]),readOnly),
  tool('orca_coordinator_lookup','Read-only reuse lookup for a single titled Orca coordinator; does not create a terminal.',{
    worktree:f.str('Exact Orca worktree selector',1024),
  },['worktree'],async(a)=>({ok:true,operation:'coordinator_lookup',result:await findCoordinator(a.worktree,argv=>runOrca(argv))}),readOnly),
  tool('orca_create_coordinator','Explicitly create one visible coordinator if no matching coordinator exists. No headless support in Orca 1.4.220.',{
    worktree:f.str('Exact worktree selector',1024),
  },['worktree'],async(a)=>{
    const found=await findCoordinator(a.worktree,argv=>runOrca(argv));
    if(found.status==='reused')return {ok:true,operation:'create_coordinator',result:found};
    if(found.status==='ambiguous') throw new OrcaError('ambiguous_coordinator','Several live Orca coordinators were found; select exact handle before new terminal creation',{candidates:found.candidates});
    if(found.status==='stale') throw new OrcaError('stale_coordinator','Previously managed Coordinator is missing; inspect Orca and rebind explicitly before creating another terminal',{previousHandle:found.previousHandle});
    return once('create_coordinator',{worktree:a.worktree},()=>r('create_coordinator',['terminal','create','--worktree',a.worktree,'--shell','git-bash','--title',COORDINATOR_TITLE],true,60000));
  },mut),
  tool('orca_recovery_snapshot','Read-only Run, Task and Worker snapshot after Runner or Plugin restart. No launch or retry.',{
    runId:f.str('Exact Run ID',128),
  },['runId'],async(a)=>{
    const run=await runOrca(['orchestration','run-show','--id',a.runId]);
    const tasks=await runOrca(['orchestration','task-list','--run',a.runId]);
    const workers=await runOrca(['orchestration','worker-list','--run',a.runId,'--limit','100']);
    return {ok:true,operation:'recovery_snapshot',result:{run:run.result,tasks:tasks.result,workers:workers.result,readOnly:true}};
  },readOnly),
  tool('orca_start_worker','Create one supervised task from the exact coordinator; recover with Orca-issued retry UUID only after an uncertain outcome.',{
    runId:f.str('Exact Run identifier',128), fromTerminal:f.str('Exact owned coordinator terminal handle',128), agent:f.str('Orca agent ID, e.g. claude, codex, antigravity',64),
    worktree:f.str('Exact Orca worktree selector',1024),
    spec:f.str('Self-contained task with acceptance and ownership',12000),
    taskTitle:f.optionalStr('Task title',256),model:f.optionalStr('Model override',256),
    effort:f.optionalStr('Reasoning effort; requires model',32),retryRequest:f.optionalStr('Orca-issued recovery UUID only after outcome_unknown',128),
  },['runId','fromTerminal','agent','worktree','spec'],async(a)=>{
    if(a.effort && !a.model) throw new OrcaError('invalid_arguments','effort requires model');
    const argv=['orchestration','worker-start','--spec',a.spec,'--run',a.runId,'--from',a.fromTerminal,'--worktree',a.worktree,'--agent',a.agent];
    if(a.taskTitle) argv.push('--task-title',a.taskTitle);
    if(a.model) argv.push('--model',a.model);
    if(a.effort) argv.push('--effort',a.effort);
    const identity={runId:a.runId,fromTerminal:a.fromTerminal,agent:a.agent,worktree:a.worktree,spec:a.spec,taskTitle:a.taskTitle??null,model:a.model??null,effort:a.effort??null};
    // Orca-issued --retry-request is explicitly managed outside the guarded first launch.
    if(a.retryRequest) throw new OrcaError('recovery_read_only_first','Read orca_request_status and journal; never blindly replay uncertain Worker starts');
    return once('worker_start',identity,()=>r('start_worker',argv,true,60000));
  },mut),
  tool('orca_worker_launch_intent','Read the durable launch journal for an exact logical Worker specification. Never launches or retries.',{
    runId:f.str('Run ID',128),fromTerminal:f.str('Coordinator terminal',128),agent:f.str('Orca agent',64),
    worktree:f.str('Orca workspace selector',1024),spec:f.str('Exact launch spec',12000),
    taskTitle:f.optionalStr('Task title',256),model:f.optionalStr('Model override',256),effort:f.optionalStr('Reasoning effort',32),
  },['runId','fromTerminal','agent','worktree','spec'],async(a)=>({ok:true,operation:'worker_launch_intent',result:intentStatus('worker_start',{runId:a.runId,fromTerminal:a.fromTerminal,agent:a.agent,worktree:a.worktree,spec:a.spec,taskTitle:a.taskTitle??null,model:a.model??null,effort:a.effort??null})}),readOnly),
  tool('orca_list_workers','List attempts and resource state; unverifiable does not equal stopped.',{
    runId:f.optionalStr('Exact Run ID',128),cursor:f.optionalStr('Opaque pagination cursor',2048),
    limit:f.int('1-100 rows'),includeRemote:f.flag('Include other servers'),
    terminalState:f.variant('Optional terminal state',['active','reclaimable','retained','release_pending','release_unknown','released']),
  },[],async(a)=>{
    if(a.limit!==undefined && (a.limit<1||a.limit>100)) throw new OrcaError('invalid_arguments','limit must be 1-100');
    const args=['orchestration','worker-list'];
    if(a.runId) args.push('--run',a.runId);
    if(a.cursor) args.push('--cursor',a.cursor);
    args.push('--limit',String(a.limit??20));
    if(a.includeRemote) args.push('--include-remote');
    if(a.terminalState) args.push('--terminal-state',a.terminalState);
    const receipt=await r('list_workers',args);
    return {...receipt, lifecycle:(receipt.result?.workers||[]).map(row=>({dispatchId:row.dispatchId,...lifecycle(row)}))};
  },readOnly),
  tool('orca_wait_workers','Bounded read-only wait in the current turn; NOT an unattended Host wake. Never launches or retries Workers.',{
    dispatchIds:{type:'array',items:{type:'string',minLength:1,maxLength:128},minItems:1,maxItems:3,description:'1-3 distinct exact Dispatch IDs'},
    waitSeconds:f.int('Wait in current tool call, 0-12 seconds; default 10'),
  },['dispatchIds'],async(a)=>({
    ok:true,operation:'wait_workers',result:await waitForWorkers({
      dispatchIds:a.dispatchIds,waitSeconds:a.waitSeconds??10,
      read:async dispatchId => (await runOrca(['orchestration','worker-show','--dispatch',dispatchId],{timeoutMs:3000})).result,
    }),
  }),readOnly),
  tool('orca_read_worker','Read a bounded page of one worker output, preserving continuation cursor.',{
    dispatchId:f.str('Exact Dispatch attempt ID',128),cursor:f.optionalStr('Previous cursor',2048),
    limit:f.int('Rows per page, 1-50'),source:f.variant('Output source',['auto','transcript','terminal']),
  },['dispatchId'],async(a)=>{
    if(a.limit!==undefined && (a.limit<1||a.limit>50)) throw new OrcaError('invalid_arguments','limit must be 1-50');
    const args=['orchestration','worker-read','--dispatch',a.dispatchId,'--source',a.source||'auto','--limit',String(a.limit??20)];
    if(a.cursor) args.push('--cursor',a.cursor);
    const receipt = await r('read_worker',args);
    return {...receipt, integrity:integrity(receipt.result,false)};
  },readOnly),
  tool('orca_read_worker_pages','Read up to 10 bounded pages with source-identity checks and explicit transcript completeness.',{
    dispatchId:f.str('Exact Dispatch ID',128),
    source:f.variant('Orca output source',['auto','transcript','terminal']),
    limit:f.int('Rows per page, 1-50'),maxPages:f.int('Page budget, 1-10'),
  },['dispatchId'],async(a)=>{
    if(a.limit!==undefined && (a.limit<1||a.limit>50)) throw new OrcaError('invalid_arguments','limit must be 1-50');
    if(a.maxPages!==undefined && (a.maxPages<1||a.maxPages>10)) throw new OrcaError('invalid_arguments','maxPages must be 1-10');
    return {ok:true,operation:'read_worker_pages',result:await readPages(a.dispatchId,a.source||'auto',a.limit??50,a.maxPages??5,argv=>runOrca(argv))};
  },readOnly),
  tool('orca_show_worker','Inspect one Dispatch and its Orca authority/liveness evidence.',{
    dispatchId:f.str('Exact Dispatch ID',128),
  },['dispatchId'],async(a)=>{
    const receipt=await r('show_worker',['orchestration','worker-show','--dispatch',a.dispatchId]);
    return {...receipt,lifecycle:lifecycle(receipt.result)};
  },readOnly),

  tool('orca_send_prompt','Submit terminal text to an existing Orca agent. Acceptance is not task completion.',{
    terminal:f.str('Orca terminal handle; do not use Dispatch ID here',128),
    text:f.str('Prompt content (literal argv, not shell)',8192),
    retryRequest:f.optionalStr('Orca-issued recovery UUID only after outcome_unknown',128),
    waitSubmitSeconds:f.int('Observe submission for up to 30 seconds'),
  },['terminal','text'],async(a)=>{
    if(a.waitSubmitSeconds!==undefined && (a.waitSubmitSeconds<0 || a.waitSubmitSeconds>30)) throw new OrcaError('invalid_arguments','waitSubmitSeconds must be 0-30');
    const argv=['terminal','send','--terminal',a.terminal,'--text',a.text,'--enter'];
    if(a.waitSubmitSeconds!==undefined) argv.push('--wait-submit',String(a.waitSubmitSeconds));
    return r('send_prompt',argsWithRetry(argv,a.retryRequest),true,45000);
  },mut),
  tool('orca_send_message','Durably enqueue Orca inter-agent message to explicit dispatch:<id> or run:<id>; enqueue does not imply read.',{
    runId:f.str('Owning Run identifier',128),fromTerminal:f.str('Exact sender coordinator terminal',128),
    recipient:f.str('Exact dispatch:<id> or run:<id> address',180),
    subject:f.str('Message subject',256),
    body:f.str('Message body',8192),
    type:f.variant('Orca message kind',['status','dispatch','escalation','handoff','decision_gate','question']),
    retryRequest:f.optionalStr('Orca-issued recovery UUID only after outcome_unknown',128),
  },['runId','fromTerminal','recipient','subject','body'],async(a)=>{
    if(!/^(dispatch|run):[A-Za-z0-9_-]+$/.test(a.recipient)) throw new OrcaError('invalid_arguments','Only exact run:<id> or dispatch:<id> recipients are supported');
    const argv=['orchestration','send','--run',a.runId,'--from',a.fromTerminal,'--to',a.recipient,'--subject',a.subject,'--body',a.body,'--type',a.type||'status'];
    return r('send_message',argsWithRetry(argv,a.retryRequest),true);
  },mut),
  tool('orca_check_messages','Read a Run inbox using non-consuming --peek. Caller must ack processed deliveries separately.',{
    runId:f.str('Exact Run ID',128),fromTerminal:f.str('Exact Run coordinator terminal handle',128),
  },['runId','fromTerminal'],async(a)=>r('check_messages',['orchestration','check','--run',a.runId,'--terminal',a.fromTerminal,'--peek']),readOnly),
  tool('orca_receive_delivery','Read an exact coordinator delivery batch and return deliveryId for ACK.',{
    runId:f.str('Exact Run ID',128),fromTerminal:f.str('Exact Run coordinator terminal handle',128),
  },['runId','fromTerminal'],async(a)=>r('receive_delivery',['orchestration','check','--run',a.runId,'--terminal',a.fromTerminal]),mut),
  tool('orca_ack_messages','Acknowledge fully processed Orca delivery FIFO batch. Acknowledgment may also fetch next batch.',{
    runId:f.str('Exact Run ID',128),fromTerminal:f.str('Exact Run coordinator terminal handle',128),deliveryId:f.str('Exact delivery ID after ALL messages handled',128),
    retryRequest:f.optionalStr('Orca-issued recovery UUID only after outcome_unknown',128),
  },['runId','fromTerminal','deliveryId'],async(a)=>r('ack_messages',argsWithRetry(['orchestration','check','--run',a.runId,'--terminal',a.fromTerminal,'--ack',a.deliveryId],a.retryRequest),true),mut),
  tool('orca_reply_message','Answer one exact Orca agent blocking question.',{
    messageId:f.str('Exact Orca question message ID',128),body:f.str('Answer body',8192),
    retryRequest:f.optionalStr('Orca-issued recovery UUID only after outcome_unknown',128),
  },['messageId','body'],async(a)=>r('reply_message',argsWithRetry(['orchestration','reply','--id',a.messageId,'--body',a.body],a.retryRequest),true),mut),

  tool('orca_stop_worker','Fence one exact supervised Dispatch and safely stop its owned agent terminal.',{
    dispatchId:f.str('Exact supervised Dispatch to stop',128),
    retryRequest:f.optionalStr('Orca-issued recovery UUID only after outcome_unknown',128),
  },['dispatchId'],async(a)=>{
    const shown=(await runOrca(['orchestration','worker-show','--dispatch',a.dispatchId])).result;
    const state=lifecycle(shown);
    if(state.owned!==true||state.userTakeover||state.releaseState==='released') throw new OrcaError('unsafe_stop','Cannot stop an unowned, released or user-taken-over terminal',{state});
    return r('stop_worker',argsWithRetry(['orchestration','worker-stop','--dispatch',a.dispatchId],a.retryRequest),true,60000);
  },destructive),
  tool('orca_release_worker','Release resource ONLY for an Orca-settled supervised Dispatch; Orca validates ownership. Never closes external terminals.',{
    dispatchId:f.str('Exact settled Dispatch attempt ID',128),
    retryRequest:f.optionalStr('Orca-issued recovery UUID only after outcome_unknown',128),
  },['dispatchId'],async(a)=>{
    const shown=(await runOrca(['orchestration','worker-show','--dispatch',a.dispatchId])).result;
    const state=lifecycle(shown);
    if(!state.mayRelease) throw new OrcaError('unsafe_release','Only settled Orca-owned reclaimable Worker terminals may be released',{state});
    return r('release_worker',argsWithRetry(['orchestration','worker-release','--dispatch',a.dispatchId],a.retryRequest),true);
  },destructive),
];
