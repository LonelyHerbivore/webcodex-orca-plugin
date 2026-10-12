# WebCodex Orca Native Plugin v0.3.0 — Test report
2026-10-12. Environment: Windows WebCodex Runner 0.4.6; Orca CLI 1.4.220; Node 24.13.0; isolated staging `<local-staging-directory>`.

## Per-feature validation

| Stage | Implementation | Test | Limitations |
| --- | --- | --- | --- |
| P0 | Staged v0.2 and fixed Windows fixture `.mjs` executable launch | 31/31 baseline | Original F: path untouched |
| P1 | Worker transcript provenance, pagination, source identity, cursor guards | 6/6 | Old Orca terminal-only archive cannot supply a full transcript |
| P2 | Durable Worker launch intent, fail-closed OutcomeUnknown, read-only request-show | 4/4 | Cannot automatically settle ambiguous Orca provider startup |
| P3 | Worker lifecycle state projection, including real input_accepted and start_unknown | 8/8 | No unwarranted worker_done inference |
| P4 | Reusable Coordinator handle, stale check and guarded visible create | 4/4 mocks and real handle reuse | Headless terminal mode unverified |
| P5 | Exact owner and user takeover protected stop/release | 5/5 | Unsettled resource cleanup deferred |
| P6 | Read-only Run/Task/Worker recovery and isolated JSON-RPC parse failures | 2/2 | WebCodex gateway binding defect external |
| P7 | Real Runner invokes isolated Plugin with Orca; 3-Agent identity checks | Three Task/Dispatch created | Three-Agent completion **not passed** |

## 21 inherited issues disposition

1. Run coordinator binding — handled in v0.2.
2. Worker `--from` binding — handled in v0.2.
3. Explicit message recipient — handled in v0.2.
4. Delivery acknowledgement — handled in v0.2.
5. Orca-issued retry request constraints — guarded, no automatic replay.
6. Worker stop vs abandon — exact Dispatch stop only.
7. Owned-Dispatch release — improved with ownership/settlement guard.
8. Refusal and unknown effect — distinguish known refusal / ambiguous outcome.
9. Antigravity start_unknown — observed, conservatively unresolved.
10. Plugin EOF on ambiguous mutation — deliberate to avoid false success.
11. Duplicate launch after OutcomeUnknown — persistent journal blocks identical task.
12. Recovery after restart — read-only Run/Task/Dispatch snapshot.
13. User takeover — blocked on observed takeover evidence.
14. Input acceptance vs completion — distinct states, no inferred worker_done.
15. Extra visible Coordinator — reuse exactly one; no proven headless create.
16. Coordinator restart persistence — stored exact terminal handle.
17. Terminal title instability — no longer rely solely on title.
18. Transcript incomplete — exposed with provenance/integrity, not fabricated.
19. Claude Code plus two Antigravity full collaboration — creation confirmed; completion not verified.
20. Runner/Plugin disruption — read-only state recovery and fail-closed writes.
21. Plugin gateway binding mismatch — external WebCodex 0.4.6 blocker.

## Windows live results

- Installed Runner Orca provider still reports **15 tools** from v0.2.0. `plugin_tool describe` returned a Base64URL-style `wc_pbind_` binding; `call` validation accepted only 32 lowercase hex characters. Official gateway call was rejected before Orca.
- Isolated v0.3.0 Native Plugin launched through WebCodex Runner using Node, reported 21 tool definitions and successful Orca health, Run/Task/Worker recovery and request-show. No Orca source changes.
- Coordinator `[terminal-id-redacted]` was created once; title auto-changed to `MINGW64:/d/example-workspace`; persisted handle recovered and reused.
- Run `[run-id-redacted]`. Claude Code Dispatch `[dispatch-id-redacted]` launch succeeded, terminal output included `CLAUDE_HELLO_OK` but authoritative status remained `ready/dispatched`.
- Antigravity A Dispatch `[dispatch-id-redacted]` and Antigravity B Dispatch `[dispatch-id-redacted]` both returned OutcomeUnknown. Read-only Run snapshot confirmed their distinct Task identities and terminal resources with `start_unknown/pending`. **Neither launch was retried.**
- All three Worker reads fell back to terminal, with `sourceExact=false` and `contentComplete=false`; B additionally marked `terminal_buffer` clipping. These are **not complete Agent transcripts**.
- 3-Agent `worker_done`, durable messaging and cleanup **remain unverified**. Active Worker terminals must be reconciled and checked for user takeover before stopping/releasing.
- No developer edit was made to the `D:\example-workspace` manuscripts; test prompts explicitly forbade Agent file access and modification. A filesystem diff was not performed, so this is not a comprehensive external side-effect audit.

Final Windows regression: `node --test` across all 12 `tests/*.test.mjs` files, **56 tests run, 56 passed, 0 failed, 0 skipped**. Unit tests do not prove live agent completion.
