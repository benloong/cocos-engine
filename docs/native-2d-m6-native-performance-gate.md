# M6 Native-only 性能门禁入口

本节点将前次验收临时改写比较器的 Native-only 范围变成显式参数。未修改 Web 或 Native 渲染实现。

## 用法

Windows 测量产物准备完成后，运行 `run-m6-perf-gate.ps1 -CandidateRevision <10位提交号> -NativeOnly -OutputFile <报告路径>`。运行器保留六轮 before／after 交替启动，Native-only 模式跳过 Web 测量。

已有测量可使用 `node native/tests/2d-poc/compare-m6-perf.cjs --gate <10位提交号> --native-only --data-root <测量目录> --output-file <报告路径>` 只读重放。独立输出路径允许保留原始报告。Native-only 参数仅用于完整 gate；原有非 Native-only 默认流程保留。

## 门禁修正

旧比较器即使计算出性能目标为 false，也会以退出码 0 结束。现在完整 gate 在 CPU、JSB、JS 堆峰值或强制 GC 目标未达标时，保存指标和原始指纹报告，输出 M6_PERF_GATE_FAILED，并返回退出码 1。PowerShell 入口将该状态传回调用者。

CPU 至少下降 50%、JSB 至少下降 70%、JS 堆峰值至少下降 30%、强制 GC 改善的阈值保持不变。六轮配对、每阶段 120 帧、CPU 分段加总、实际候选版本、构建与部署包一致性、共享场景、渲染器及 V8 一致性检查均保留。

## 验证

13 项端到端正负对照通过：不提供 Web 数据时 Native gate 通过；缺少第六轮、CPU 分段损坏、错误部署包、不同 V8、候选版本不符或场景资源变化均被拒绝。CPU 未达标和 GC 回退均返回失败且保留报告。实际 PowerShell 调用还验证了六轮交替、跳过 Web、带空格输出路径及退出码 0／1 的传递。测试的临时 Git 仓库禁用用户钩子和模板。

使用新 CLI 只读重放历史 529cb53636 的六轮真实 Native 数据，指标、部署哈希、运行环境、采样指纹和顺序均与此前 Native 报告完全一致。历史混合变更帧 CPU、JSB、堆峰值、GC 降幅分别为 61.25%、77.51%、41.84%、28.36%。这仅验证工具重放一致性，不代表最新候选重新通过了性能目标。

[结构化验证](../native/tests/2d-poc/build/m6-perf-native-gate-node/summary.json)与同目录的 contract-tests-final.log、historical-native-replay.json 保留本机证据。下一节点仍须对最新候选进行真实六轮测量，M6 总体继续待签收。
