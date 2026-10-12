import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, openSync, writeFileSync, closeSync, fsyncSync, readFileSync, renameSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AmbiguousEffectError, OrcaError } from './cli.mjs';

const defaultDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', '.runtime-state');
const baseDir = () => process.env.ORCA_PLUGIN_STATE_DIR || defaultDir;
export const keyFor = (kind, identity) => createHash('sha256').update(JSON.stringify([kind,identity])).digest('hex');
const fileFor = key => join(baseDir(), key+'.json');
export function intentStatus(kind, identity) {
  const key=keyFor(kind,identity), file=fileFor(key);
  if (!existsSync(file)) return {key,status:'not_recorded'};
  try { const item=JSON.parse(readFileSync(file,'utf8'));if(item.key!==key)throw Error('key mismatch');return item; }
  catch { throw new OrcaError('journal_unreadable','Persistent operation journal unreadable: refuse mutation',{key}); }
}
function record(key, state, create=false) {
  mkdirSync(baseDir(),{recursive:true,mode:0o700});
  const file=fileFor(key);
  const body=JSON.stringify({...state,key,updatedAt:new Date().toISOString()});
  if(create){const fd=openSync(file,'wx',0o600);try{writeFileSync(fd,body);fsyncSync(fd);}finally{closeSync(fd);}return;}
  const temp=join(baseDir(),key+'.'+process.pid+'.tmp');
  const fd=openSync(temp,'w',0o600);
  try{writeFileSync(fd,body);fsyncSync(fd);}finally{closeSync(fd);}
  renameSync(temp,file);
}
export async function once(kind,identity,fn){
  const previous=intentStatus(kind,identity);
  if(previous.status==='confirmed') return {...previous.receipt,replayedFromJournal:true};
  if(previous.status==='pending'||previous.status==='outcome_unknown') {
    throw new OrcaError('operation_unresolved','Previous Worker launch is unresolved; inspect Orca Run/Task/Dispatch before any new launch',{key:previous.key,status:previous.status,runId:identity.runId});
  }
  if(previous.status==='rejected') throw new OrcaError('previously_rejected','Previous request was explicitly rejected; use different logical task parameters if a new launch is intended',{key:previous.key});
  const key=previous.key;
  try{record(key,{status:'pending',kind,identity},true);}
  catch(e){
    if(e?.code==='EEXIST')throw new OrcaError('operation_unresolved','Another provider instance already reserved this Worker launch',{key});
    throw new OrcaError('journal_failed','Cannot persist launch intent; Worker was NOT started',{key});
  }
  try {
    const receipt=await fn();
    record(key,{status:'confirmed',kind,identity,receipt});
    return receipt;
  } catch(e) {
    if(e instanceof AmbiguousEffectError){
      try{record(key,{status:'outcome_unknown',kind,identity,error:e.message});}catch{}
      throw e;
    }
    if(e instanceof OrcaError){try{record(key,{status:'rejected',kind,identity,error:e.message});}catch{}
      throw e;
    }
    // Unexpected failure is never proof that the external effect did not occur.
    try{record(key,{status:'outcome_unknown',kind,identity,error:String(e)});}catch{}
    throw new AmbiguousEffectError('Worker launch result unknown; inspect journal and Orca state');
  }
}
