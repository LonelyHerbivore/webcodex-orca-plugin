/** A conservative projection of Orca's independently evolving Task, Dispatch and terminal state. */
export function lifecycle(result) {
  const worker = result?.worker?.state ?? result?.workerState ?? result?.projection?.stage?.worker ?? null;
  const dispatch = result?.dispatch?.status ?? result?.dispatchStatus ?? result?.projection?.stage?.dispatch ?? null;
  const resource = result?.terminalResource ?? result?.resource ?? result?.projection?.resource ?? {};
  const releaseState = resource.releaseState ?? resource.state ?? result?.terminalState ?? 'unknown';
  const retainedReason = resource.retainedReason ?? null;
  const owned = resource.ownerDispatchId && (result?.dispatch?.id ?? result?.dispatchId)
    ? resource.ownerDispatchId === (result?.dispatch?.id ?? result?.dispatchId) : null;
  const userTakeover = retainedReason === 'user_takeover' || resource.ownershipState === 'user_takeover';
  const submission = result?.submission?.state ?? result?.result?.submission?.state ?? result?.worker?.stage ?? result?.projection?.stage?.detail ?? null;
  let phase = 'unknown';
  if (worker === 'succeeded' && dispatch === 'completed') phase='worker_done';
  else if (worker === 'failed' || dispatch === 'failed') phase='failed';
  else if (worker === 'stopped') phase='stopped';
  else if (worker === 'abandoned') phase='abandoned';
  else if (worker === 'start_unknown') phase='start_unknown';
  else if (submission === 'turn_started') phase='turn_started';
  else if (submission === 'input_accepted') phase='input_accepted';
  else if (worker === 'running' || worker === 'active') phase='working';
  else if (worker === 'ready' || result?.stage === 'ready') phase='ready';
  const settled = ['worker_done','failed','stopped','abandoned'].includes(phase);
  const mayRelease = settled && !userTakeover && owned === true &&
    !['released','release_pending','release_unknown','retained'].includes(releaseState);
  return {phase,workerState:worker,dispatchStatus:dispatch,releaseState,retainedReason,owned,userTakeover,settled,mayRelease};
}
