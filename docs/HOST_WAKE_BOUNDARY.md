# Host 后台主动唤醒：架构边界与验收门槛

更新：2026-10-14。本文只描述已审查源代码、已验证的替代方案和仍缺失的 Host 原生能力，不声明已经支持无人值守自动续轮。

## 目标与现有行为

用户希望 ChatGPT 通过 WebCodex 调度 Orca Coordinator + Claude Code / Antigravity Workers，结束当前回答后，在某 Worker 完成时由 Host **自动开启一个新模型回合**，准确恢复 Run / Dispatch，并在需要时继续分配任务。

目前可用的两条路径：

1. **当前回合只读等待**：本仓库 `orca_wait_workers` 在模型回合尚活跃时，经 Native Tool Plugin v1 → Orca CLI 的 `orchestration worker-show` 对 1–3 个精确 Dispatch ID 轮询。成功完成此工具调用之后的下一步仍属于**原回合**。此方式不依赖 MCP iframe，但也不具备无人值守唤醒能力。
2. **Job Terminal MCP App 通知**：WebCodex Fork 的 `present_job_terminal_continuation` 使用 iframe `setTimeout` 调用 Server 状态接口，并在一条持久 Wait 的 prepare fence 之后，通过 `ui/message` 尝试交付给 Host。该消息的成功 ACK **只证明交付被 Host 接受**，不证明 Host 创建了新的 ChatGPT 模型回合。后台页可能暂停 iframe 计时器。

审查代码位置：

- WebCodex `src/job_terminal_attention.rs`：`JobTerminalContinuationAdapter` 是 Server 内部抽象；当前提交仅通过 `#[cfg(test)] install_adapter_for_tests` 安装测试实现。没有证明生产端存在可从无人值守后台调用的原生 Host 转轮接口。
- WebCodex `src/agent_wake.rs`：`ContinuationAdapter` 以 `production_auto_resume_available` 明确区分真实生产模型唤醒与 mock / 手工调度。
- WebCodex `src/mcp_job_terminal_continuation_app.html`：`ui/message` 的投递及其 ACK 与模型回合启动证据分离。
- WebCodex `docs/implementation/mcp-app-auto-resume-restoration.md`：包含 Agent / Job 各三种可见性和延迟组合，共六项真实 Host 验收条件。

2026-10-14 的实机探测：Job 完成至 Host prepare 相差 2,608 秒，最终 `delivered`，但没有无用户操作、自动新模型回合的证据。不能将 `WEBCODEX_MCP_APP_RESUME_MODE` 强行改为 `unattended` 作为修复。

## 真正的原生 Host Wake 最小合同

该能力**必须由有权限的 Host 提供并确认**，不能由 Orca 插件伪造：

1. **授权**：绑定当前用户、ChatGPT 会话/窗口、项目与精确 Wait（或 Agent Wake），且只接受一次明确授权。不能从 Run ID 猜测 conversation、也不能把浏览器页面令牌当成任意会话续轮权限。
2. **唤醒请求**：Host 自身持久化监听 Job terminal 事件；不依赖网页 iframe 定时器存活。持久键为 `(principal, conversation, wake_id, generation)`，同一逻辑通知在状态不明时不盲发第二次。
3. **投递与执行双重回执**：分别记录 `dispatch_accepted` 与 `fresh_turn_started`（关联精确对话和模型回合 ID）。新模型回合必须实际查询 `observe_jobs` 或消费 Agent Wake，才能记录 `continuation_observed`；缺任一层则仍是未验证。
4. **冲突关闭**：用户撤销授权、原会话不可用、过期/跨主身份、stale generation、接管的终端、Host 响应未知时，一律停止自动操作，只保留可观测恢复路径。
5. **运行不变式**：恢复原有 Orca Run / Coordinator / Worker；不得凭通知重复调用 `orca_start_worker`，也不得擅自新建 Coordinator 或清理用户接管的终端。

建议按独立的能力发现与授权合同接入 Host；在 Host 未提供此 API 之前，保持 readiness=unknown，而不是增加无人值守声明。

## 发布门槛（真实 ChatGPT Host）

在隔离的测试会话和测试工作区中，按 WebCodex 的官方六项矩阵验证 Agent/Job × 前台短延迟/前台长延迟/后台长延迟。每项需记录：

- Job terminal 或 Agent Wake 的 UTC 时间
- Host 接受投递的时间及不确定结果
- 原回合终止后的**新模型回合**起始时间
- 新回合调用精确 `observe_jobs` / `consume_agent_wake` 的证据
- 没有新用户消息、没有重复 Worker 启动、没有重复模型回合
- 页面隐藏、重开、Runner 重启、网络抖动下的恢复和关闭行为

`npm test`、Node 回归和 Rust CI 只能检查各自的逻辑合同，不能替代这六项真实 Host 的自动唤醒验收。

## 本仓库目前的回退策略

插件测试将 `wait_elapsed`、`start_unknown`、`needs_attention` 和失败 Worker 单独报告。长任务应在原回合结束后由下一次**实际用户发起的回合**查询 Orca 快照恢复；未来如果 Host 提供被授权的 native wake，再由 Host 注入带精确身份的事件。未知状态绝不自动重启 Worker。
