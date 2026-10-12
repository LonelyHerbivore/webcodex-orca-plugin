# v0.3.0 Upgrade and rollback — Windows Runner

**Do not overwrite the installed v0.2.0 while the WebCodex Plugin binding incompatibility remains.**

1. Extract the ZIP into a **new** versioned directory (not `D:\example-workspace`). Use native Node.js >=18 and `npm test` inside that directory. The expected Native v1 catalog has 21 tools.
2. Configure the Runner's `ORCA_BIN` to a trusted absolute Orca CLI executable. Configure `ORCA_PLUGIN_STATE_DIR` to a stable private directory outside the install tree. Journal records must survive upgrade; if old and new journals differ, reconcile every unknown Worker before switching.
3. Set Plugin executable to the native absolute `node.exe`; set the arguments field to a JSON array containing one string — the absolute path of the new version's `src/plugin.mjs`. Example array: `["C:/path/to/webcodex-orca-plugin-v0.3.0/src/plugin.mjs"]`. Preserve unrelated Runner configuration.
4. When the WebCodex binding bug is fixed, execute Plugin `check`, `reload` at most once if required, `describe`, then `call` using the actual new binding returned. **Never fabricate a hex binding to work around validation.**
5. Begin with `orca_health`, `orca_coordinator_lookup`, `orca_recovery_snapshot` and `orca_worker_launch_intent` before any startup. Existing `pending` / `OutcomeUnknown` means state reconciliation, not a new Worker.
6. Do not treat `input_accepted`, `turn_started`, or a terminal phrase like HELLO_OK as `worker_done`. Never close a user-taken-over terminal; require settled and owned state before release.
7. For rollback, point Runner command/args back to the original 15-tool v0.2.0 directory, keep the v0.3.0 journal and Run/Task/Dispatch IDs, check/reload and observe before mutations. Avoid generic tab-closing and worktree-wide process kills.

**Open gates:** WebCodex provider binding format, headless Coordinator support in Orca 1.4.220, full structured transcripts for terminal workers, and settled Claude + two Antigravity end-to-end worker lifecycle.
