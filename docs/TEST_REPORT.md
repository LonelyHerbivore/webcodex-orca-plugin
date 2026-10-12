# Incremental test record — v0.1.0

Cloud environment: Linux / Node v22.16.0, mock Orca CLI. All tests invoke the provider over newline-delimited JSON-RPC and exercise the Orca adapter by spawning a fake CLI process. These are **not live Orca tests**.

1. Protocol (`protocol.test.mjs`): initialization and discovery and refusal before initialization. Tested immediately after protocol implementation.
2. Health (`health.test.mjs`): real subprocess spawn and JSON result. Tested immediately after health implementation.
3. Workspace + Run (`workspace-run.test.mjs`): workspace list, Run creation, stable request ID, missing-ID refusal. Tested before Worker implementation.
4. Worker (`worker.test.mjs`): start Worker, effort/model guard, list, page read and show. Initial execution failed because registration was not appended to the tool catalog; source insertion was fixed and the same tests passed before proceeding.
5. Message (`message.test.mjs`): terminal prompt (UTF-8 and shell-looking characters), explicit-address mail, unsafe group refusal, inbox peek, ack, reply. Tested before cleanup implementation.
6. Lifecycle (`lifecycle.test.mjs`): exact Dispatch release, required retry ID, rejected CLI action. Tested immediately after cleanup implementation.
7. Safety (`safety.test.mjs`): invalid JSON after mutation, malformed read, silent failed mutation, timeout semantics, validation, and queued-call protection after ambiguous effect. Tested before release packaging.

**Unverified**: WebCodex Rust Runner's authoritative Plugin admission check; Orca v1.4.220 CLI actual `reply`, `check --ack`, and external Run mailbox; Windows binary launch in user machine; multi-Agent completion and release in real workspace. These are explicit follow-up integration gates; do not report cloud mocks as production validation.
