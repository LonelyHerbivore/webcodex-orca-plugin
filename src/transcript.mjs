import { OrcaError } from './cli.mjs';

/** A verified page ending is not proof that a fallback contains the original conversation. */
export function integrity(result, exhausted = false) {
  const clipping = Array.isArray(result?.clipping) ? result.clipping : [];
  const source = result?.source ?? 'unknown';
  const sourceExact = result?.sourceExact === true && source !== 'terminal';
  const contentComplete = result?.contentComplete === true;
  const complete = sourceExact && contentComplete && clipping.length === 0 && exhausted;
  return {
    complete, source, sourceExact, contentComplete,
    pageExhausted: exhausted, clipping,
    fallbackReason: result?.fallbackReason ?? null,
    warning: complete ? null : !sourceExact ? 'not_exact_transcript' :
      !contentComplete ? 'underlying_source_incomplete' :
      clipping.length ? 'clipped' : 'pagination_incomplete',
  };
}

/** Orca's per-page `sourceExact`/`contentComplete` may change at a live terminal tail.
 * `sourceIdentity` + the actual source type fence page consistency; retain the least
 * optimistic provenance observed over all pages. Never infer a transcript from a terminal.
 */
export async function readPages(dispatchId, source, limit, maxPages, read) {
  let cursor;
  let identity;
  let basis;
  const seen = new Set();
  const pages = [];
  const content = [];
  let bytes = 0;
  const resultFor = (exhausted, stopReason, nextCursor) => ({
    dispatchId, content, pages, nextCursor, stopReason, integrity: integrity(basis, exhausted),
  });
  for (let i = 0; i < maxPages; i++) {
    const args = ['orchestration','worker-read','--dispatch',dispatchId,'--source',source,'--limit',String(limit)];
    if (cursor) args.push('--cursor',cursor);
    const response = await read(args);
    const result = response?.result;
    if (!result || typeof result !== 'object') throw new OrcaError('invalid_page','Orca worker-read returned no result');
    if (result.dispatchId && result.dispatchId !== dispatchId) throw new OrcaError('source_mismatch','Worker-read returned another Dispatch');
    if (identity !== undefined && result.sourceIdentity !== identity) throw new OrcaError('source_changed','Worker output source changed during read; restart from first page');
    if (basis && result.source !== basis.source) throw new OrcaError('source_changed','Worker output type changed during read');
    if (identity === undefined) identity = result.sourceIdentity;
    if (!basis) basis = {
      ...result,
      clipping: [...(result.clipping ?? [])],
    };
    else {
      basis.sourceExact = basis.sourceExact === true && result.sourceExact === true;
      basis.contentComplete = basis.contentComplete === true && result.contentComplete === true;
      basis.clipping = [...new Set([...(basis.clipping ?? []),...(result.clipping ?? [])])];
      basis.fallbackReason ||= result.fallbackReason ?? null;
    }
    const next = result.cursor ?? result.terminal?.nextCursor ?? result.transcript?.nextCursor ?? result.nextCursor ?? null;
    const rows = result.transcript?.events ?? result.terminal?.tail ?? result.rows ?? [];
    if (!Array.isArray(rows)) throw new OrcaError('invalid_page','Worker-read content must be an array');
    bytes += Buffer.byteLength(JSON.stringify(rows),'utf8');
    if (bytes > 1024*1024) throw new OrcaError('output_limit','Combined worker pages exceed 1MiB');
    if (next && (next === cursor || seen.has(next))) {
      // On Orca 1.4.220 a terminal may reply with a 0-line page and
      // the same opaque cursor. It means "no new output", not EOF.
      if (basis.source === 'terminal' && rows.length === 0) {
        pages.push({items:0,cursor:next});
        return resultFor(false,'stalled_cursor',next);
      }
      throw new OrcaError('cursor_loop','Worker-read returned a non-advancing cursor');
    }
    pages.push({items:rows.length,cursor:next});
    content.push(...rows);
    if (!next) return resultFor(true,'end_of_pages',null);
    seen.add(next);
    cursor=next;
  }
  return resultFor(false,'page_budget',cursor);
}
