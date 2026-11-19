# M6.1 Windows TTFFont alias 的逐资产所有权

> 2026-11-17。Windows 文件型 TTFFont 已获得明确的 alias 所有权与独立渲染身份。完整资源/平台及视觉终态仍未通过。

## 实现

TTFFont 在 family 与文件来源均已就绪时取得一个原生注册记录句柄。family、source 或直接字节写入变化会更新该记录；clearNativeData、destroy/destruct 和 C++ 析构均释放。失败文件加载保留旧字节、revision 与记录。非文件字节写入清除文件来源和对应记录，渲染后端仍从文件创建字体，本节点没有实现内存字体加载器。

注册表按公共 alias 与来源分组，使用唯一递增 ID 区分记录。相同来源的存活资产共享公共记录，但各自持有独立的内部渲染 alias。Label 使用内部身份选择文件，序列化/public family 保持不变；内部方法不导出 JSB。同名换源时旧资产仍选择旧来源，旧资产销毁不能删除较新的记录；新一代先销毁则恢复仍被持有的旧来源，所有持有者释放后清理公共记录。legacy loadFont 换源与资产记录分离，避免旧资产误删新注册。

记录均为主线程使用的值容器：group 拥有 alias/source 字符串和持有者计数，lease 拥有 group ID 和内部渲染名称；TTFFont 独占其数值句柄，Label 继续通过 IntrusivePtr 持有字体。Canvas 独立拥有字体 COM 引用。没有 shared_ptr、JS 权威镜像、逐字形或每帧 JSB 通信。脚本引擎 cleanup 清空所有表及容量，但不重置 ID；清理后的迟到释放不会命中新运行时的记录。

## 验证

- Windows Debug/Release 完整 native harness、实际 JSB 字体探针通过。各完成 1000 轮 native 双资产共享创建、销毁其中一个、清空最后持有者、重载和直接析构，检查公共/内部 alias、lease 与 group 数量恢复基线；包含不经 JS 注册的 native Label 字体选择及失败加载保留旧记录。
- 各完成 1000 轮实际 JSB 双 TTFFont 创建/加载、释放共享者、清空重载、销毁。通过真实 Label 渲染的宽度与非空像素验证剩余字体仍使用 Thonburi。此循环使用直接资产创建，不等同于 1000 次 asset-manager 加载卸载。
- 使用独立临时字体文件覆盖同名不同来源的两种释放顺序；包含 legacy loadFont 换源、旧内部身份保持原路径，以及字体对象释放后临时源文件可删除。脚本引擎 cleanup 后所有记录归零，并验证迟到释放不会删除后续新记录。
- 4 个 Jest suite、49 项及 10 项静态检查通过。指纹边界补充平台注册头，共 82 项。
- 当前源码快照 `d3ba54d7210611d94e69505089fc1069bc5a47c03d326b8a058e66a260af1385` 的真实应用使用 assetManager.loadRemote 加载/释放同一 Thonburi 字体，捕获 12 例。普通 Debug 与 ASAN 的 manifest/12 张 RGBA 逐字节一致，ASAN stderr 0 字节；加载字节为 223404，释放标记通过。
- Web/native 布局 12/12，严格图像仍 **9/12**。12 张 native 图像与前一真实描边节点相同，bold/outline/nested 最大差值仍为 20/30/47，未扩大阈值。本次 GPU 未覆盖多来源共享字体的视觉对照，该边界由定向 native/JSB 验证。

完整逐例结果和日志/源码 SHA256 见 [结果](./native-2d-m6.1-font-alias-ownership-results.json)。字体测试入口沿用 run-m6-font-assets-tests.ps1；GPU 复现沿用 [同源对照入口](./native-2d-m6.2-richtext-gpu.md#复现)。日志为 build/font-alias-ownership-*。应用经 CLI 重建，并复用对应平台此前验证的完整特性引擎 JS；本轮没有 JS 生产源码变更。

## Windows DirectWrite 源文件释放

原生验收程序的 `--directwrite-file-probe` 在 JSB 初始化前运行。先用仍持有的读句柄验证独占打开会返回共享冲突，再让 Thonburi 和 OpenSans 交替覆盖同一临时路径。每轮创建两个字体对象，释放第一个后由第二个对象测量、填充和描边。释放第二个后独占打开文件，截断为无效字体，验证加载失败后文件仍可独占打开。最后删除临时文件。

Debug 和 Release 各运行三个独立进程，每个进程 1000 轮。24 px 下两种字体的 `Atlas 123` 测量宽度分别为 约 95.97656 和 101.92969。每 250 轮取样，Debug 三轮的进程句柄均维持 184，Release 三轮均维持 174，两个配置的 GDI 对象均维持 0。M0 在具备 Windows 原生验收程序时执行此检查。此前集成进程曾出现总句柄从 420 增至 428，其来源仍待定位。

## 剩余边界

其他平台尚未接入此记录机制；仍须验证完整 bundle/异步资源失败回收、旧场景/Prefab、TTC/多字体/彩色字体、长期内存、跨线程与性能。只有 legacy loadFont 注册、尚未交给 TTFFont 的记录仍由 runtime cleanup 兜底，失败下载/工厂创建的逐请求撤销待补。既有 Canvas 不因公共表变化自动刷新；native Label 则通过资产 revision 重建。脚本引擎清理后仍存活资产的继续渲染不在本节点契约内，仅保证迟到释放安全。工作区已有 SpriteFrame.native 改动未纳入提交，此快照不作为 M6 最终候选验收。
