# WebCodex Orca Native Plugin v0.3.1 测试报告

日期：2026-10-12；环境 WebCodex 0.4.6、Orca 1.4.220、Windows Runner。

## 已通过
- 61/61 个自动化测试（云端 Node.js 22；本机 Windows Node.js 24）。
- 正式 Plugin check：21 tools，ready；reload：成功。
- 通过 WebCodex 已公布的 Runtime 通用调用入口，使用 describe 原样 Base64URL binding：health、coordinator_lookup、read_worker_pages、recovery_snapshot 全部调用成功。
- 真实 Orca 只读回归：Coordinator `[terminal-id-redacted]` 通过 Orca 官方 run-list/terminal-list 恢复，无新终端。
- Transcript：2 页 10 行；stalled_cursor；完整性标记 `not_exact_transcript`，没有错误的完整对话声称。

## 限制
- 当前 ChatGPT 会话中的 WebCodex 直接 Plugin Tool 入口仍错误要求 32-hex binding；WebCodex 当前 `tool_manifest` 和实际服务端期望 Base64URL。通用 Runtime fallback 可完成真实调用，但该直接入口问题仍须由 Host 侧更新适配，不属于 Orca Plugin 代码问题。
- Orca 当前保留两个 `start_unknown` Antigravity Worker；Claude 状态未证明 worker_done。未重启、关闭或回收三个 Worker，完整三 Agent 协作未验收。
- Orca 无法提供现存 Worker 的完整结构化 transcript；terminal fallback 仍属片段。

## 文件范围
`src/transcript.mjs`, `src/coordinator.mjs`, `src/tools.mjs`,
`tests/transcript.test.mjs`, `tests/coordinator.test.mjs`,
`tests/fixtures/fake-orca.mjs`, `tests/real-orca-acceptance.mjs`,
`package.json`, `README.md` 与 docs。

F 盘安装目录为 `<plugin-install-directory>`。
未修改 Orca 官方源码或 D:\example-workspace小说正文。
