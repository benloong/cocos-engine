# M6.2 Windows 自定义字体合成斜体

> 2026-11-17。完整 RichText 严格图像提升至 9/12，布局保持 12/12；粗体、描边及嵌套样式仍失败。

## 修复

前一节点已修复 mask 与覆盖率，但使用 DirectWrite italic text format，字形形状仍与 Web 不一致。核对 [Chromium Windows 字体实现](https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/platform/fonts/win/font_platform_data_win.cc) 后，确认其 synthetic italic 对 regular 字形使用 skewX=-1/4；这与从字体匹配 italic face 的路径不同。

DirectWriteFont 现在使用 regular format 保留 shaping 的 advances、kerning 和组合符号 offset；italic 标志只传给原生 renderer，在逐字形原点使用横向 -0.25 的矩阵剪切。采样量化继续沿用上一节点，测量宽度不受剪切影响。矩阵和 glyph run 为同步借用，layout/factory/font face 的 COM 所有权不变，没有引入 shared_ptr 或新的共享缓存。

独立原始画布中的 12/24/36/48px 普通白色斜体随即与实际 Chrome Canvas 全通道逐字节相同。系数来自实现语义核对，未逐用例拟合，也未扩大比较阈值。

## 验证

- 完整 Windows Debug/Release native harness 和实际字体 JSB 壳通过；新增 12 个斜体 Web 原始 RGBA 校验值，与已有 12 个普通字校验值一起覆盖拉丁字、组合附加符号和泰文、四个字号。另验证合成斜体与 regular 的 shaping 测量宽度一致。
- 重新采集原始 Canvas 96 例，native Debug/Release 输出逐字节相同。严格通过从 28/96 提升为 56/96：普通字与斜体各 28 例通过；白色拉丁字/组合符号/泰文斜体最大通道差值均为 0，红/绿/黑/半透明白≤1。灰色的普通/斜体 8 例以及粗体 32 例仍未通过。
- 4 个 Jest suite、49 项与 10 项 native 边界静态检查通过。1000 次 DirectWrite 创建/测量/释放，GDI 对象 Debug/Release 均为 10→10，句柄分别 335→335、328→328。没有据此声称完整泄漏验收通过。
- 完整应用同快照 `79257552c199b5c9f8e33cd0e0762f464c73dbc44f659f2ab45d6dc363004655`：12/12 布局相同，严格图像从 8/12 提升至 9/12，text-italic 最大通道差值从 154 降为 0，未破坏前一节点的 8 个通过用例。bold 最大差值仍为 124，outline 122，nested 从 205 降为 140。
- 普通 Debug 与 ASAN 应用的 manifest/RGBA 逐字节相同，ASAN stderr 0 字节；真实字体加载/释放标记通过。

数值及捕获文件哈希见 [结果](./native-2d-m6.2-ttf-italic-results.json)。日志在忽略目录 `native/tests/2d-poc/build/ttf-italic-*`。复现沿用 [原始画布参数](./native-2d-m6.2-ttf-preblend.md#复现与限制) 和 [完整应用 GPU 入口](./native-2d-m6.2-richtext-gpu.md#复现)。本轮只修改 C++ 生产代码，应用脚本经 CLI 重建，Windows/Web 特性引擎 JS 分别复用先前已验证的对应平台产物。

## 剩余边界

合成粗体、真正描边、嵌套样式、灰色 RGB 取整、RTL/sideways 定位，以及其他字体、平台、阴影、性能与完整资源生命周期仍待验收。本轮没有重跑 Graphics 74 例；工作区既有未提交 SpriteFrame.native 改动仍未纳入提交，不能把此快照认定为 M6 最终候选版本。
