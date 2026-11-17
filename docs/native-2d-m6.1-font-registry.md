# M6.1 Windows 字体 alias 重载与运行时清理

> 2026-11-17。本节点完成 Windows JSB 字体路径注册表的参数、重载和脚本引擎退出清理；后续已补 Windows TTFFont 的[逐资产 alias 所有权](./native-2d-m6.1-font-alias-ownership.md)，完整异步与跨平台仍待验收。

## 修复

- loadFont 必须至少有 family/source 两个参数，避免只传 family 时越界读取 args[1]。无参和单参返回失败，注册表不变。
- 检查非空 alias 和真实文件存在性。FileUtils 对绝对路径直接归一化，不代表文件存在；不存在的绝对路径、无法解析的 source 都返回 null，保留已有记录。
- 同 alias 成功加载后替换旧路径，修复 emplace 只保留首次文件的问题。仍允许额外参数，与原入口兼容。
- 脚本引擎 after-cleanup hook 释放路径值和表的 bucket 存储，防止同进程重启脚本引擎时沿用旧 alias。注册表值拥有路径字符串；Canvas/DirectWriteFont 独立拥有选中的字体 COM 对象，注册表不持有字体句柄。没有引入 shared_ptr。

## 验证

Windows Debug/Release 完整 native harness 和实际字体 JSB 探针通过。新增测试经真实绑定调用，覆盖无参/单参、缺失绝对路径、非法 source、失败重载保留旧值，以及 1000 次同 alias 在两个文件路径间交替重载且表大小不变。随后 Canvas 选择替换源并按真实 Thonburi 测量；Canvas 析构后可删除临时字体文件和空目录，未留下该文件的占用。脚本引擎 cleanup 后检查注册表为空。

无参/单参会产生预期 SE_ERROR 日志；se::Object::call 的布尔返回值不能证明绑定业务成功，测试检查返回值类型和注册表状态，不把日志中的错误当作通过证据。完整 harness 的最终退出码为 0、native 2D PoC 为 PASS，实际字体探针为 OK。10 项静态测试通过；源码哈希边界增加 jsb_platform_win32.cpp，共 81 项。

日志与源码 SHA256 见 [结果](./native-2d-m6.1-font-registry-results.json)。入口沿用 run-m6-font-assets-tests.ps1，分别传 Debug/Release executable。原生 harness 使用独立临时目录，只删除自己创建的文件和空目录，不递归删除。此节点未重跑 GPU、ASAN 或其他平台。

## 剩余

全局路径表的 runtime cleanup 不等于 TTFFont.destroy 后逐个撤销平台注册；Windows 文件型 TTFFont 的共享 alias 和同名来源现已由[后续节点](./native-2d-m6.1-font-alias-ownership.md)补齐。资源加载失败后的逐请求回收、完整异步资源管线和跨平台字体注册/句柄释放仍待验收。已有 Canvas 不会因表替换自动重建字体，热更新通知亦未在本节点完成。M6 字体终态门禁保持未通过。
