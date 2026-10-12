import { createInterface } from 'node:readline';
import { AmbiguousEffectError, OrcaError } from './cli.mjs';

const VERSION = 'webcodex-plugin-v1';
export const tool = (name, description, properties, required, execute, annotations = {}) => ({
  name, description, inputSchema: { type: 'object', properties, required, additionalProperties: false },
  annotations, execute,
});
export const field = {
  str: (description, maxLength = 4096) => ({type:'string',minLength:1,maxLength,description}),
  optionalStr: (description, maxLength = 4096) => ({type:'string',minLength:1,maxLength,description}),
  flag: description => ({type:'boolean',description}),
  int: description => ({type:'integer',description}),
  variant: (description, values) => ({type:'string',enum:values,description}),
};

export function validate(schema, args) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) return 'arguments must be a JSON object';
  for (const r of schema.required) if (!Object.hasOwn(args, r)) return `missing field: ${r}`;
  for (const [key, v] of Object.entries(args)) {
    const s = schema.properties[key];
    if (!s) return `unknown field: ${key}`;
    if (s.type === 'integer' && !Number.isInteger(v)) return `${key} must be integer`;
    if (s.type === 'string' && (typeof v !== 'string' || v.length < (s.minLength ?? 0) || v.length > (s.maxLength ?? Infinity))) return `${key} must be nonempty string within maxLength`;
    if (s.type === 'boolean' && typeof v !== 'boolean') return `${key} must be boolean`;
    if (s.enum && !s.enum.includes(v)) return `unsupported ${key}`;
  }
  return null;
}
function success(value) { return { content:[{type:'text',text:JSON.stringify(value)}], structuredContent:value, isError:false }; }
function knownError(code,message,details={}) { return {content:[{type:'text',text:`${code}: ${message}`}],structuredContent:{ok:false,code,message,...details},isError:true}; }

export function serve(tools) {
  const byName = new Map(tools.map(x => [x.name,x]));
  if (byName.size !== tools.length) throw new Error('Duplicate tool name');
  const defs = tools.map(({execute,...definition}) => definition);
  let initialized = false;
  let fatal = false;
  const rl = createInterface({input:process.stdin,crlfDelay:Infinity});
  let queue = Promise.resolve();
  async function request(msg) {
    if (fatal) return;
    const id = msg?.id ?? null;
    const reply = value => process.stdout.write(JSON.stringify({jsonrpc:'2.0',id,...value}) + '\n');
    if (msg?.jsonrpc !== '2.0' || msg?.id === undefined || typeof msg.method !== 'string') return reply({error:{code:-32600,message:'Invalid request'}});
    if (msg.method === 'initialize') {
      if (msg.params?.protocolVersion !== VERSION) return reply({error:{code:-32602,message:'Unsupported protocol version'}});
      initialized = true;
      return reply({result:{protocolVersion:VERSION}});
    }
    if (!initialized) return reply({error:{code:-32000,message:'Not initialized'}});
    if (msg.method === 'tools/list') return reply({result:{tools:defs}});
    if (msg.method !== 'tools/call') return reply({error:{code:-32601,message:'Method not found'}});
    const target = byName.get(msg.params?.name);
    if (!target) return reply({error:{code:-32602,message:'Unknown tool'}});
    const args = msg.params?.arguments ?? {};
    const invalid = validate(target.inputSchema,args);
    if (invalid) return reply({result:knownError('invalid_arguments',invalid)});
    try { reply({result:success(await target.execute(args))}); }
    catch (err) {
      if (err instanceof AmbiguousEffectError) {
        // No fabricated completion reply. Make Runner classify the call as OutcomeUnknown.
        fatal = true;
        process.stderr.write(`Orca ambiguous effect: ${err.message}\n`);
        process.exitCode = 1;
        rl.close();
        process.stdin.destroy();
        return;
      }
      if (err instanceof OrcaError) return reply({result:knownError(err.code,err.message,err.details)});
      fatal = true;
      process.stderr.write(`Plugin unexpected error: ${err?.message || String(err)}\n`);
      process.exitCode = 1;
      rl.close();
      process.stdin.destroy();
    }
  }
  rl.on('line', line => {
    if (fatal) return;
    if (Buffer.byteLength(line, 'utf8') > 65536) {
      fatal = true; process.exitCode = 1; rl.close(); process.stdin.destroy(); return;
    }
    queue = queue.then(() => {
      let parsed;
      try { parsed=JSON.parse(line); }
      catch { process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Parse error'}})+'\n'); return; }
      return request(parsed);
    }).catch(e => {
      fatal = true; process.stderr.write(`Protocol error: ${e.message}\n`);
      process.exitCode = 1; rl.close(); process.stdin.destroy();
    });
  });
}
