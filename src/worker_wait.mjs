import { OrcaError } from './cli.mjs';
import { lifecycle } from './lifecycle.mjs';

// This is a bounded, read-only wait inside the *current* model tool call.
// It does not start a new model turn and is not an unattended Host wake.
const VALID_DISPATCH = /^[A-Za-z0-9_-]{1,128}$/;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function waitForWorkers({
  dispatchIds, waitSeconds = 10, read,
  now = () => performance.now(), sleep = wait,
}) {
  if (!Array.isArray(dispatchIds) || dispatchIds.length < 1 || dispatchIds.length > 3
      || dispatchIds.some(id => typeof id !== 'string' || !VALID_DISPATCH.test(id))
      || new Set(dispatchIds).size !== dispatchIds.length) {
    throw new OrcaError('invalid_arguments', 'Provide 1-3 distinct exact Dispatch IDs');
  }
  if (!Number.isInteger(waitSeconds) || waitSeconds < 0 || waitSeconds > 12) {
    throw new OrcaError('invalid_arguments', 'waitSeconds must be 0-12');
  }
  if (typeof read !== 'function') throw new OrcaError('invalid_arguments', 'Worker reader is required');

  const started = now();
  const deadline = started + waitSeconds * 1000;
  let polls = 0;
  while (true) {
    const workers = [];
    // Only read the selected Dispatch attempts. Never create, stop, retry or
    // release anything in this call. Each CLI read has its own short timeout.
    for (const dispatchId of dispatchIds) {
      const raw = await read(dispatchId);
      const state = lifecycle(raw);
      workers.push({
        dispatchId, phase: state.phase, settled: state.settled,
        workerState: state.workerState, dispatchStatus: state.dispatchStatus,
        userTakeover: state.userTakeover,
      });
    }
    polls += 1;
    const allSettled = workers.every(worker => worker.settled);
    const needsAttention = workers.some(worker =>
      worker.userTakeover || worker.phase === 'start_unknown');
    const allSucceeded = !needsAttention && workers.every(worker => worker.phase === 'worker_done');
    const elapsedMilliseconds = Math.max(0, Math.floor(now() - started));
    if (allSettled || needsAttention || now() >= deadline) {
      return {
        waitOutcome: needsAttention ? 'needs_attention' : allSettled ? 'all_settled' : 'wait_elapsed',
        allSettled, allSucceeded, polls, elapsedMilliseconds,
        workers, readOnly: true, newModelTurnStarted: false,
      };
    }
    await sleep(Math.min(1500, Math.max(0, deadline - now())));
  }
}
