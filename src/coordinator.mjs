import { OrcaError } from './cli.mjs';
import { intentStatus } from './journal.mjs';

export const COORDINATOR_TITLE='WebCodex Orca Coordinator';

/** Find a coordinator through the public Orca runtime registry, not Electron's
 * private AppData database. Run records durably hold coordinator_handle; a live
 * terminal list proves whether that exact handle still belongs to this worktree.
 */
export async function findCoordinator(worktree,read) {
  const terminalsResult=await read(['terminal','list','--worktree',worktree,'--limit','100']);
  const terminals=terminalsResult?.result?.terminals;
  if (!Array.isArray(terminals)) throw new OrcaError('invalid_terminal_list','Orca terminal list format was unexpected');
  if (terminalsResult.result.truncated) throw new OrcaError('terminal_list_truncated','Cannot prove coordinator uniqueness from truncated list');
  const byHandle=new Map(terminals.map(t=>[t.handle,t]));
  const saved=intentStatus('create_coordinator',{worktree});
  const storedHandle=saved.status==='confirmed' ? saved.receipt?.result?.terminal?.handle : null;
  const named=terminals.filter(t=>t.title===COORDINATOR_TITLE || t.name===COORDINATOR_TITLE);
  const candidates=new Map();
  if (storedHandle && byHandle.has(storedHandle)) candidates.set(storedHandle,{terminal:storedHandle,source:'plugin_journal',runIds:[]});
  for(const terminal of named) candidates.set(terminal.handle,{terminal:terminal.handle,source:'terminal_title',runIds:[]});

  // Orca itself is authoritative for Run -> coordinator linkage; no private DB or duplicate JSON is required.
  let cursor;
  const seenCursors=new Set();
  let allRunsRead=false;
  for(let page=0;page<5;page++) {
    const args=['orchestration','run-list','--limit','100'];
    if(cursor) args.push('--cursor',cursor);
    const reply=await read(args);
    const data=reply?.result;
    if (!Array.isArray(data?.runs)) throw new OrcaError('invalid_run_list','Orca Run registry is unavailable');
    for(const run of data.runs) {
      const handle=run?.coordinator_handle;
      if(typeof handle!=='string'||!byHandle.has(handle)) continue;
      const existing=candidates.get(handle) || {terminal:handle,source:'orca_run_registry',runIds:[]};
      if(typeof run.id==='string' && !existing.runIds.includes(run.id)) existing.runIds.push(run.id);
      candidates.set(handle,existing);
    }
    const next=data.nextCursor??null;
    if(!next){allRunsRead=true;break;}
    if(next===cursor||seenCursors.has(next))throw new OrcaError('run_cursor_loop','Orca Run registry has a repeated cursor');
    seenCursors.add(next);cursor=next;
  }
  if(!allRunsRead) throw new OrcaError('run_list_incomplete','Cannot prove coordinator uniqueness from partial Orca Run registry');
  const found=[...candidates.values()];
  if(storedHandle&&!byHandle.has(storedHandle)) return {
    status:'stale',worktree,previousHandle:storedHandle,
    candidates:found,requiredAction:'inspect_orca_before_manual_rebind',
  };
  if(found.length>1) return {status:'ambiguous',worktree,candidates:found,requiredAction:'select_exact_coordinator_handle'};
  if(found.length===0) return {status:'missing',worktree,headlessSupported:false,requiredAction:'create_one_visible_terminal_with_explicit_approval'};
  const x=found[0];
  if(typeof x.terminal!=='string'||!x.terminal.startsWith('term_'))throw new OrcaError('invalid_coordinator','Coordinator lacks an exact terminal handle');
  return {status:'reused',worktree,...x};
}
