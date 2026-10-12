import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
const tool=process.argv[2],args=JSON.parse(process.argv[3]||'{}');
if(typeof tool!=='string'||!tool.startsWith('orca_'))throw Error('Only Orca Plugin tools allowed');
const plugin=resolve(dirname(fileURLToPath(import.meta.url)),'../src/plugin.mjs');
const child=spawn(process.execPath,[plugin],{env:process.env,stdio:['pipe','pipe','pipe']});
let out='',err='';
child.stdout.on('data',data=>out+=data);
child.stderr.on('data',data=>err+=data);
child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'webcodex-plugin-v1'}})+'\n');
child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:tool,arguments:args}})+'\n');
child.stdin.end();
child.on('close',code=>{
 let result;try{result=out.split('\n').filter(Boolean).map(JSON.parse).find(x=>x.id===2)}catch{}
 console.log(JSON.stringify({providerExit:code,toolResult:result?.result?.structuredContent??null,isError:result?.result?.isError??null,unknown:!result,stderr:err.slice(0,600)}));
 if(!result||code!==0)process.exitCode=2;
});
