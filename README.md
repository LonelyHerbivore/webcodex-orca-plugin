# WebCodex × Orca Native Plugin

[WebCodex](https://github.com/yyjeqhc/webcodex) 的第三方原生工具插件，通过 Orca CLI 为 AI 编程助手提供多 Agent 编排能力。**使用 WebCodex Native Tool Plugin v1 协议，不是 MCP Server，也不需要修改 WebCodex 或 Orca 的官方源码。**

**当前版本：v0.3.1（集成验证版，尚非生产稳定版）**

## 能做什么

- **多 Agent 调度**：创建协作 Run / Coordinator、启动 Claude Code 或 Antigravity 等 Orca 支持的 Worker，并读取 Worker 状态。
- **Agent 通信**：向终端发送提示词，向指定对象发送消息，读取投递内容、确认消息及回复问题。
- **防止重复执行**：为 Worker 启动维护持久化意图日志；在超时或响应丢失等 `OutcomeUnknown` 情况下阻止盲目重试。
- **生命周期保护**：区分已接受输入、正在执行、完成以及未知状态；停止、释放 Worker 前检查所属 Dispatch 和用户接管情况。
- **恢复与诊断**：使用 Orca 官方 Run/Task/Dispatch/Terminal 查询恢复状态，复用有效 Coordinator，避免无证据地新建终端。
- **对话分页读取**：对读取来源、分页游标和内容完整性进行验证；无法获取完整原始对话时明确标记为不完整。

共提供 **21 个工具**，分为只读查询和有副作用的编排操作。

## 环境要求

| 组件 | 要求 |
| --- | --- |
| Node.js | 18 或以上 |
| WebCodex | 支持 Native Tool Plugin v1 的 Runner；已在 0.4.6 上集成验证 |
| Orca | 已在 Orca CLI 1.4.220（Windows）上验证部分真实工作流 |
| 操作系统 | 主要在 Windows 上测试；其他平台尚未完整验收 |
| 第三方 npm 依赖 | 无 |

## 安装与配置

1. 克隆本仓库，进入目录后运行 `npm test`（无需 `npm install`）。
2. 在 Runner 环境中设置：
   - `ORCA_BIN`：可信 Orca CLI 可执行文件的**绝对路径**。
   - `ORCA_PLUGIN_STATE_DIR`：插件专属、可写、可持久化的状态目录。不要把它放在可能被更新覆盖的插件目录内；升级时应保留未结算的启动意图日志。
3. 在 WebCodex Desktop 的 **Extensions → Native Plugins** 配置，或向 Runner 的 `runner.toml` 添加类似配置（下面都是**示例路径**，须替换）：

```toml
[[plugins.providers]]
id = "orca"
name = "Orca Multi-Agent"
command = 'X:\Tools\nodejs\node.exe'
args = ['D:\Plugins\webcodex-orca-plugin\src\plugin.mjs']
cwd = 'D:\Plugins\webcodex-orca-plugin'
timeout_secs = 30
```

注意：WebCodex Desktop 的“参数”字段需要填写 **JSON 字符串数组**，例如：

```json
["D:/Plugins/webcodex-orca-plugin/src/plugin.mjs"]
```

4. 按 WebCodex 当前版本的流程执行 Plugin **check** 和 **reload / Runner 重启**，再确认插件处于 ready 状态。

插件通过 stdin/stdout 使用逐行 JSON-RPC 2.0 与 Runner 通信。不要直接向其输入任意 Shell 命令，不要把 Orca 私有数据库、令牌或本机配置提交到仓库。

## 主要工具

| 分类 | 工具 |
| --- | --- |
| 环境与查询 | `orca_health`、`orca_list_workspaces`、`orca_list_workers`、`orca_read_worker`、`orca_read_worker_pages`、`orca_show_worker` |
| 状态恢复 | `orca_worker_launch_intent`、`orca_request_status`、`orca_coordinator_lookup`、`orca_recovery_snapshot`、`orca_check_messages` |
| 编排与通信 | `orca_create_run`、`orca_create_coordinator`、`orca_start_worker`、`orca_send_prompt`、`orca_send_message`、`orca_receive_delivery`、`orca_ack_messages`、`orca_reply_message` |
| 回收与释放 | `orca_stop_worker`、`orca_release_worker` |

对有副作用的操作，不应在超时或连接中断后直接重试；先通过只读恢复工具核实真实状态。

## 测试与已知限制

```bash
npm test
```

2026-10-13 本机验证：**61/61 项自动化测试通过（Node.js 24.13.0）**。测试使用模拟 Orca CLI，不能替代真实多 Agent 端到端验收。真实 Orca 只读回归、Plugin check/reload 记录见 [v0.3.1 测试报告](docs/TEST_REPORT_v0.3.1.md)。

以下能力仍有限制：

- Orca 可能只返回终端片段，而非完整的结构化 Agent Transcript；插件不会将片段假称为完整对话。
- 某些 Worker 启动处于 `start_unknown`，不能据此判断成功或失败，也不能自动重启。
- **Claude Code + 两个 Antigravity 的完整协作、完成和回收尚未全部验收。**
- 先前观察到 WebCodex 0.4.6 某些直接 Host Adapter 对 `plugin_tool` binding 的格式验证与 Runtime 通用入口不同。请以当前版本实际的 Plugin check、describe 与受支持的调用入口为准，禁止手动拼装 binding。

详情参见 [升级和回滚说明](docs/UPGRADE_v0.3.1.md)。

## 项目结构

```text
src/                原生插件、Orca CLI 封装、Worker 状态机、Coordinator、日志、对话读取
tests/              协议、故障恢复、生命周期、安全边界和模拟 Orca 测试
docs/               历史测试报告及升级说明
package.json        版本与测试脚本
```

## 贡献与许可

欢迎提交 Issue 和 Pull Request，尤其欢迎不同平台的真实 Orca CLI 兼容性测试，以及未验证状态的最小复现。请对提交的日志进行脱敏，勿公开用户工作区、真实 Dispatch/Terminal ID 或访问密钥。

本项目按 **MIT License** 开源。WebCodex 和 Orca 分属各自的上游项目，本仓库不是官方插件。
