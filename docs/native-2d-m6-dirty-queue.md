# M6 Native 脏队列移除安全

更新期间移除当前或已更新的 renderer，旧实现会将尾部未更新对象交换到已走过的位置，造成漏更新。本次在更新期间将移除项置空，保持剩余索引稳定；遍历跳过空项。非更新期间继续使用尾部交换删除。

增加递归刷新保护，防止回调再次调用 updateAllDirtyRenderers 时重复消费或清空外层队列。保留当前版本的重复标记合并和新增对象本轮处理规则，保持 Native 组件独占所有权，未修改 Web。

回归覆盖自移除、移除已处理对象、递归刷新，以及已有的移除未处理对象、重新启用、追加和去重场景。Windows Debug／Release 原生完整测试及 JSB manager 探针通过；两配置各 146 张核心捕获与既有 Native 基准逐字节一致，22 项命中、11 项根节点、1000 轮场景与 4998 项场景断言通过。基线审计和 43 项薄壳检查通过。

原始产物见 [节点验证目录](../native/tests/2d-poc/build/m6-dirty-queue-node/pixel-validation.json)，以及同目录的 native-results.json、graphics-results.json、audit-check.log 和 thin-shell.log。

本提交只解决队列结构变化与递归刷新。已处理对象再次变脏的调度语义仍需单独验收。字体文件独占失败及 M6 其他终态签收项继续保留；本节点通过不代表 M6 完成。
