# M6 候选提前退出：确认一次 Release 访问冲突

**Release 崩溃的直接原因已由转储确认。** RichText 回收分段时，`se::Object::getProperty` 把空的接收对象句柄传给了 `v8::Object::Has`。离线复核先校验归档程序、转储和展开日志的 SHA-256，再核对异常线程调用栈中的返回地址。程序导入表确认了调用目标，调用者保存的两个局部变量分别为空接收对象和非空上下文。

旧版本先检查 persistent 句柄，随后准备属性名，最后才取得 local 接收对象。提交 `d6212f7012` 将取得 local 接收对象提前到准备属性名之前，并持有至查询结束。转储记录了调用时的句柄状态；期间触发清理的具体时点仍未知。初始 Debug 提前退出仍需独立归因。原始诊断经过和后续回归记录如下。

2026-11-24。Windows 应用事件和现有 minidump 已确认，此前记录为“提前退出、启动器未取得退出码”的串行 Release 运行实际发生了崩溃。原因仍待定位，M6 稳定性不能签收。

事件时间为本地 `12:01:00.9438864`（UTC `04:01:00.9438864`），事件号 1000/1001，记录 ID 40533/40534。故障程序路径对应已归档的 `m6-richtext-03b5254ea7/serial-release/richtext-Release`，PID 为 `20996`，报告 ID 为 `4d350907-a234-43f0-9789-5a2e4c2a1d63`。程序和部署 cc.js 的哈希与此前失败记录一致。

本机 `CrashDumps/native-2d-m6-gpu.exe.20996.dmp` 与该次事件对应，已复制留档。转储异常线程为 `37832`，异常码 `0xc0000005`，故障点为 `v8.dll+0x8cfe08`，访问类型为读取，目标地址为 `0`。最后一个应用捕获记录是 `12:00:59` 的 `richtext-lifecycle-disabled`；最后捕获点只能帮助缩小时间范围，不能直接当作触发原因。

离线读取器根据转储内存和本地 PE 异常表恢复部分原生模块栈地址。与程序时间戳 `6b04fead` 一致的链接映射将原生调用链定位为 `RichText::setString → updateLayout → rebuildLayout → recycle → Segment 析构 → 分段释放回调 → se::Object::getProperty`，回调对应 `jsb_scene_manual.cpp` 注册的 SegmentDisposeCallback。这把排查范围缩小到分段回收访问脚本包装对象，但尚未验证具体失效原因。

V8 内部仍缺少匹配符号，日志中的远距离导出符号匹配不用于判断函数名；JIT 边界后的栈展开也不作为可靠证据。当前不能把故障归因到 GL，也不能将启动器句柄缓存当作修复。链接映射哈希、逐帧 RVA、符号和偏移已归档。

[结构化证据及文件哈希](./native-2d-m6-candidate-crash-03b5254ea7.json)。原始事件 XML、WER 报告、转储及离线诊断工具保存在 `native/tests/2d-poc/build/m6-startup-03b5254ea7/`。此前初始 Debug 提前退出仍未找到对应系统崩溃记录；后续双配置通过与本次失败分别保留。

本节点只归档诊断，不修改引擎实现。文档应用连续启动矩阵属于另一项有限覆盖，不能消除此 RichText 压力场景的崩溃阻断。

### 2026-11-24 工作区候选修正与离线回归

V8 后端的 `Object::getProperty` 原先在创建属性名后才从 persistent handle 取得接收对象。创建字符串可能触发 GC。修正将接收对象的 local handle 提前到创建属性名之前，并在整个属性查询期间持有。现有转储无法确认该次 GC 就是历史崩溃的触发条件。

在 Windows Debug（`native/out`）和 Release（`native/out-release2`）分别增量重编并链接 `cc2d_native_poc` 后，运行由 `build-richtext-runtime-probe.cjs` 生成的探针。两个配置均退出 0 并报告 `jsb shell integration: OK`。覆盖分段回收、借用包装对象失效和触摸回调中销毁。本轮未运行依赖本地 HTTP 字体服务的完整 GPU 应用压力矩阵，崩溃阻断保留。

同日扩展离线 JSB 探针，在同一 RichText 实例上交替保留和放开分段 Node 的脚本引用。每个配置执行 100 轮，每轮创建或复用 24 个 Label 后清空，检查只有池内 20 个包装对象继续有效。有强引用的 50 轮逐轮确认调用 4 次分段 Node 的脚本销毁回调。Windows Debug、Release 均退出 0，并报告 `jsb shell integration: OK` 和 `native 2D PoC: PASS`。该探针使用测试回调，未覆盖完整应用的 Node 延迟销毁队列。

候选 d6212f7012 的离线 GPU 应用按 Release、Debug 顺序交替执行三轮。六个进程各自在写出结果后调用 game.end()，全部以 0 退出。每轮 58 张 RGBA 捕获及生命周期计数均与上一轮离线基准一致。该场景的重复运行和正常退出已验证，历史访问冲突的触发条件仍未确认。[逐次结果与哈希](./native-2d-m6-offline-richtext-exit.json)
