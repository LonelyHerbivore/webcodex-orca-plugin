import { spawn } from 'node:child_process';

export class OrcaError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'OrcaError';
    this.code = code;
    this.details = details;
  }
}

export class AmbiguousEffectError extends Error {
  constructor(message) { super(message); this.name = 'AmbiguousEffectError'; }
}

const MAX_OUTPUT = 1024 * 1024;
const execPath = () => process.env.ORCA_BIN || (process.platform === 'linux' ? 'orca-ide' : 'orca');

/** A single command with literal argv; shell injection is structurally impossible. */
export async function runOrca(args, { mutating = false, timeoutMs = 20000 } = {}) {
  if (!Array.isArray(args) || !args.every(x => typeof x === 'string' && x.length <= 16384)) {
    throw new OrcaError('invalid_argv', 'Invalid CLI argument list');
  }
  const bin = execPath();
  // A JavaScript CLI fixture is not directly executable on Windows (spawn EFTYPE).
  // Use Node explicitly while preserving literal argv and shell:false.
  const nodeScript = /\.(?:cjs|mjs|js)$/i.test(bin);
  const command = nodeScript ? process.execPath : bin;
  const argv = nodeScript ? [bin, ...args, '--json'] : [...args, '--json'];
  const ctl = new AbortController();
  const child = spawn(command, argv, {
    shell: false,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    signal: ctl.signal,
    env: process.env,
  });
  let stdout = '';
  let stderr = '';
  let overflow = false;
  const push = (which, data) => {
    const value = data.toString('utf8');
    if ((which === 'stdout' ? stdout : stderr).length + value.length > MAX_OUTPUT) {
      overflow = true;
      ctl.abort();
      return;
    }
    if (which === 'stdout') stdout += value;
    else stderr += value;
  };
  child.stdout.on('data', x => push('stdout', x));
  child.stderr.on('data', x => push('stderr', x));
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; ctl.abort(); }, timeoutMs);
  let exit;
  try {
    exit = await new Promise(resolve => {
      let spawnError;
      child.on('error', err => { spawnError = err; });
      child.on('close', (code, signal) => resolve({ code, signal, spawnError }));
    });
  } finally { clearTimeout(timer); }

  if (exit.spawnError || timedOut || overflow || exit.signal) {
    const code = exit.spawnError?.code === 'ENOENT' ? 'orca_not_found' : timedOut ? 'timeout' : overflow ? 'output_limit' : 'process_failure';
    const message = `Orca CLI ${code}. ${exit.spawnError?.message || ''}`.trim();
    // If the CLI started a mutating operation, an absent response is NOT a failed operation.
    if (mutating && code !== 'orca_not_found') throw new AmbiguousEffectError(message);
    throw new OrcaError(code, message);
  }

  let value;
  try { value = JSON.parse(stdout.trim()); } catch {
    if (mutating) throw new AmbiguousEffectError('Orca CLI returned invalid or missing JSON after a mutating call');
    throw new OrcaError('invalid_json', 'Orca CLI returned invalid JSON');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value) || typeof value.ok !== 'boolean' || !('result' in value || value.ok === false)) {
    if (mutating) throw new AmbiguousEffectError('Orca CLI response lacks a valid completion envelope');
    throw new OrcaError('invalid_envelope', 'Invalid Orca CLI JSON envelope');
  }
  if (!value.ok || exit.code !== 0) {
    if (value.ok && exit.code !== 0 && mutating) throw new AmbiguousEffectError('Orca reported success but the process exited unsuccessfully');
    throw new OrcaError('orca_rejected', 'Orca CLI rejected the request', {response: value, exitCode: exit.code});
  }
  return value;
}

export const normalizeResult = (operation, response) => ({
  ok: true, operation, result: response.result, requestId: response.id ?? null,
});

export function argsWithRetry(base, retryRequest) {
  if (retryRequest === undefined) return base;
  if (typeof retryRequest !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(retryRequest)) {
    throw new OrcaError('invalid_retry_request', 'Only an Orca-issued recovery UUID may be used with --retry-request');
  }
  return [...base, '--retry-request', retryRequest];
}
