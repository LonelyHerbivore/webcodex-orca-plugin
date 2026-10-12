import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('..',import.meta.url)));
export async function interact(actions,{mode}={}){
  const scratchBase=process.env.ORCA_PLUGIN_TEST_TMPDIR || (process.platform==='win32' && existsSync('D:\\') ? 'D:\\' : tmpdir());
  const dir = mkdtempSync(join(scratchBase,'orca-plugin-'));
  const log = join(dir,'cli.jsonl');
  const child = spawn(process.execPath,[join(root,'src/plugin.mjs')],{
    env:{...process.env,ORCA_BIN:join(root,'tests/fixtures/fake-orca.mjs'),ORCA_TEST_LOG:log,ORCA_PLUGIN_STATE_DIR:dir,...(mode?{ORCA_TEST_MODE:mode}:{})},
    stdio:['pipe','pipe','pipe'],
  });
  let out='';let err='';
  child.stdout.on('data',d=>out+=d.toString());
  child.stderr.on('data',d=>err+=d.toString());
  actions.forEach((value,i)=>child.stdin.write((typeof value==='string'?value:JSON.stringify({jsonrpc:'2.0',id:i+1,...value}))+'\n'));
  child.stdin.end();
  const exit = await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>{child.kill();reject(new Error('test child timed out'))},3500);
    child.on('close',(code)=>{clearTimeout(timeout);resolve(code)});
  });
  const records=out.split('\n').filter(Boolean).map(x=>JSON.parse(x));
  const commands = (()=>{try{return readFileSync(log,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse)}catch{return []}})();
  rmSync(dir,{recursive:true,force:true});
  return {exit,records,commands,err};
}
export const boot={method:'initialize',params:{protocolVersion:'webcodex-plugin-v1'}};
export const call=(name,args={})=>({method:'tools/call',params:{name,arguments:args}});
