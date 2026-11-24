# M6 候选提前退出：确认一次 Release 访问冲突

2026-11-24。Windows 应用事件和现有 minidump 已确认，此前记录为“提前退出、启动器未取得退出码”的串行 Release 运行实际发生了崩溃。原因仍待定位，M6 稳定性不能签收。

事件时间为本地 `12:01:00.9438864`（UTC `04:01:00.9438864`），事件号 1000/1001，记录 ID 40533/40534。故障程序路径对应已归档的 `m6-richtext-03b5254ea7/serial-release/richtext-Release`，PID 为 `20996`，报告 ID 为 `4d350907-a234-43f0-9789-5a2e4c2a1d63`。程序和部署 cc.js 的哈希与此前失败记录一致。

本机 `CrashDumps/native-2d-m6-gpu.exe.20996.dmp` 与该次事件对应，已复制留档。转储异常线程为 `37832`，异常码 `0xc0000005`，故障点为 `v8.dll+0x8cfe08`，访问类型为读取，目标地址为 `0`。最后一个应用捕获记录是 `12:00:59` 的 `richtext-lifecycle-disabled`；最后捕获点只能帮助缩小时间范围，不能直接当作触发原因。

离线读取器根据转储内存和本地 PE 异常表恢复部分原生模块栈地址。与程序时间戳 `6b04fead` 一致的链接映射将原生调用链定位为 `RichText::setString → updateLayout → rebuildLayout → recycle → Segment 析构 → 分段释放回调 → se::Object::getProperty`，回调对应 `jsb_scene_manual.cpp` 注册的 SegmentDisposeCallback。这把排查范围缩小到分段回收访问脚本包装对象，但尚未验证具体失效原因。

V8 内部仍缺少匹配符号，日志中的远距离导出符号匹配不用于判断函数名；JIT 边界后的栈展开也不作为可靠证据。当前不能把故障归因到 GL，也不能将启动器句柄缓存当作修复。链接映射哈希、逐帧 RVA、符号和偏移已归档。

[结构化证据及文件哈希](./native-2d-m6-candidate-crash-03b5254ea7.json)。原始事件 XML、WER 报告、转储及离线诊断工具保存在 `native/tests/2d-poc/build/m6-startup-03b5254ea7/`。此前初始 Debug 提前退出仍未找到对应系统崩溃记录；后续双配置通过与本次失败分别保留。

本节点只归档诊断，不修改引擎实现。文档应用连续启动矩阵属于另一项有限覆盖，不能消除此 RichText 压力场景的崩溃阻断。
