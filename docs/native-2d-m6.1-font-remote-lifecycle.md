# M6.1 Windows TTFFont 真实资源管线重复释放

> 2026-11-17。Windows Debug 普通/ASAN 应用各完成 1000 次本地字体 loadRemote/releaseAsset。完整资源与平台门禁仍未关闭。

## 实现与验收入口

RichText GPU 应用在完成图像捕获后，使用真实 assetManager 连续加载同一仓库字体 1000 次，每轮检查 223404 个 native 字节，并再加载一次验证缓存返回同一资产。releaseAsset 后检查缓存条目移除、字体资产进入待销毁状态、native 字节归零、来源路径与字体族清空；最终等待后续帧，检查延迟销毁完成。该测试经过真实 downloader/parser/factory 路径，不再用直接 new TTFFont 循环替代资源加载证据；源是本地文件，未覆盖 HTTP 下载。

Windows Debug 和 Release 的 C++ 测试直接检查公共别名、渲染别名、lease 和 group 在释放及脚本引擎清理后恢复基线。真实应用通过字体对象和 assetManager 检查每次释放的可观察结果，Mask 与 RichText 两个夹具均检查 JSB 上不存在 getFontAliasStats。下方 2026-11-17 的四项计数来自当时的诊断构建。

同一应用还在 native 字节/alias 已取得后注入一次赋值异常，验证工厂销毁半成品、错误回调、缓存与记录恢复，再对同 URL 成功重试。随后加载真实缺失文件，验证错误回调而非返回空字体资产。runner 和比较器都要求新增生命周期结果，不能只用 12 张图像或旧 manifest 通过入口。

## 当前证据

- 源码/夹具快照 `6cfb9fff7a3c87dd4765bf7bcd11c3acce8d1ca9bd3706d21a775c8288f55373`。CLI 分别重建 Windows/Web 应用，随后从当前源码重建两端完整特性引擎 JS，包含上一节点的字体工厂与 Factory 修复；未复用旧引擎 JS。
- 普通 Debug 和 ASAN 各完成 1000 次 loadRemote/releaseAsset、1000 次缓存身份检查，以及失败回滚、同 URL 重试、缺失源拒绝和最终延迟销毁检查。
- 公共 alias、渲染 alias、lease、group 均为 **4→4**，资产缓存为 **22→22**。四条记录是启动基线，测试验证恢复基线，不要求删除应用仍存活的其他字体。每次被释放的测试资产 native 字节均为 0。
- 普通/ASAN 的 manifest 与 12 张 RGBA 逐字节一致，ASAN stderr 0 字节。缺失源的 Font/warn 日志是预期错误场景，最终 manifest 明确记录拒绝和恢复通过；不能以日志出现告警替代错误回调检查。
- Web/native 布局 12/12，严格图像仍 **9/12**；bold、outline、nested 最大差值为 20/30/47。10 项静态检查通过。该资源测试不关闭剩余视觉门禁。

逐例数据、计数、源码与日志 SHA256 见 [结果](./native-2d-m6.1-font-remote-lifecycle-results.json)。复现沿用 [GPU 应用入口](./native-2d-m6.2-richtext-gpu.md#复现)，需重建完整特性引擎 JS；新增生命周期结果是当前 runner 的必需项。日志为 build/font-remote-lifecycle-*。

## 剩余

这不是长期 native/JS heap、系统 DLL 内部泄漏、Release GPU 或跨平台验收。BitmapFont/LabelAtlas、bundle/旧场景/Prefab、HTTP 与异步取消尚未覆盖。legacy adapter 注册成功但 TTFFont 尚未创建时的无主 alias 仍需要请求身份；按名称/路径删除不足以防止迟到失败误删后来的注册，本节点没有采用这种清理。工作区已有 SpriteFrame.native 改动仍未纳入提交，此快照不作为 M6 最终候选验收。
