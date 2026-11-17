# M6.1 字体工厂失败回滚与重试

> 2026-11-17。补齐字体工厂半成品回滚和通用 Factory 的同步异常完成路径；完整异步资源门禁仍未关闭。

字体工厂原先直接构造并写入 _nativeAsset。赋值异常会留下已创建资产，且 handler 同步抛错时 Factory 的 _creating 队列不会退出，后续同 ID 请求持续等待。另一个真实失败是 native 字体文件不可用：onLoaded 仅告警，工厂却仍返回没有字节的 TTFFont。

现在字体构造/赋值阶段失败会 destroy 半成品，回调 Error/null。对提供 getFontDataSize 的 native 字体检查字节已加载，拒绝空数据；Web 字体保留原有 alias 契约。成功回调位于构造 try/catch 外，消费者抛错不会误销毁成功资产。

通用 Factory 捕获完成前的 handler 同步异常，通过同一完成函数通知已合并的请求并移除等待队列，允许同 ID 重试。每个请求只完成一次，旧请求的迟到/重复回调不能移除新请求的队列。消费者回调抛错仍向调用方传播，不转换成第二次资源失败。该通用修改是字体资源失败恢复所需的 asset-manager 支持，不改变 Web/native 字体的数据所有者，也没有引入 shared_ptr。

## 验证

- 完整 asset-manager 相关 suite、字体 loader 和 native 字体序列化/JIT 回归，共 16 个 suite、120 项通过。新增覆盖合并请求异常完成、同 ID 重试、迟到/重复回调、消费者异常及同 ID 回调重入，以及半成品销毁和 native 空字节拒绝。
- Windows Debug/Release 实际 JSB 探针执行生产 font-loader 模块中的工厂函数：真实 TTFFont 取得字节/alias 后注入赋值异常，检查 released、字节归零、family 清空；再用真实缺失文件验证错误与销毁，恢复真实文件后成功创建。DOM/downloader/factory 注册接口由探针隔离，只使用实际原生字体绑定；这不是完整下载管线运行证据。
- 两个 native harness 保留原有所有权、1000 次共享循环及脚本清理回归并通过。C++ 生产源码未变，复用前一节点的 Debug/Release 二进制，重新生成并执行当前 TS 源码探针。
- 10 项静态检查通过；指纹边界新增 font-loader.ts 和必要的 asset-manager/factory.ts，共 84 项。native-ts-build CI 已加入两个相关测试入口，远端执行待验证。本轮未重跑完整 native TS 构建、GPU 或 ASAN，不沿用历史快照声称当前候选通过。

数值、源码/探针及日志 SHA256 见 [结果](./native-2d-m6.1-font-factory-failure-results.json)。复现：运行 Jest 的 tests/asset-manager、tests/ui/font-loader.test.ts 和两个 native-font-assets suite；实际 JSB 沿用字体探针入口。日志为 build/font-factory-failure-*。

## 剩余

legacy FontFace 下载完成、尚未创建 TTFFont 的注册记录仍是 runtime 所有；创建前失败/取消时的逐请求 alias 撤销待补。此节点不证明网络下载、bundle/原生依赖异步失败、旧场景/Prefab、其他平台或长期泄漏验收完成。native 直接字节字体的渲染仍受前一节点文件后端限制；Factory 不替异步 producer 捕获其后续事件循环中未回调的异常，也不接管违规重复完成时新造对象的所有权。
