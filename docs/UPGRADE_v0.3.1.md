# v0.3.1 升级与回滚

已在用户本机 F 盘安装目录执行升级并通过 Plugin check + reload。

验证：`node --test tests/*.test.mjs` （预期 61 项），真实 Orca 只读测试：
`node tests/real-orca-acceptance.mjs YOUR_DISPATCH_ID YOUR_WORKTREE_SELECTOR

Coordinator 优先通过 Orca 官方 `orchestration run-list` 与 `terminal list` 恢复；不直接访问/修改 Orca AppData 私有数据库。若有多个候选，禁止自动选择或新建。Worker 的未知结果幂等日志与 Orca Run 记录不同，需要独立稳定存储；不要在任务未结算时删除它。

Binding：只有当前直接入口的 schema 错误；manifest 与服务端一致的 Base64URL binding 已通过通用运行时入口实机调用。不得改造、猜测或伪造 binding；永久解决需要 Host 直接调用层更新。

回滚到 v0.3.0：恢复原始源文件并执行 check/reload，保留 Worker Journal 和 Orca Run/Task/Dispatch 状态；不要关闭用户接管的终端。
