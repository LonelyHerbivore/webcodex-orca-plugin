# v0.2.0 test report — 2026-10-12

- Cloud Node.js zero-dependency simulation tests: **31/31 passed** (`node --test tests/*.test.mjs`).
- Individual feature test suites passed after each change: run-create/retry; worker start; message/ACK; stop/release.
- Real Windows Orca 1.4.220 observations from earlier live run `[run-id-redacted]`:
  - Protocol and Check/Reload: passed (15 tools on Windows Runner).
  - Coordinator-bound Run creation: passed.
  - Claude worker `[dispatch-id-redacted]`: succeeded, released.
  - Antigravity B `[dispatch-id-redacted]`: succeeded, released.
  - Antigravity A `[dispatch-id-redacted]`: stopped, then released.
  - Delivered `worker_done`, message enqueue, `receive_delivery`, and ACK: passed.
  - Output read fell back to terminal with `contentComplete=false` — not a complete transcript.
  - A subsequent Antigravity C startup had an uncertain outcome during WebCodex connection outage; no evidence of its creation in the first reconciled 3-task snapshot. Another attempt also returned an infrastructure error. Recheck authoritative Run state before any follow-up write.

The v0.2.0 source archive is a **cloud copy incorporating tested fixes**, not proof this exact archive has been deployed on the Windows Runner. Do not overwrite Runner configuration until Windows availability and version are verified.
