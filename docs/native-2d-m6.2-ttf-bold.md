# M6.2 Windows 合成粗体轮廓下沉

> 2026-11-17。已接入 regular 轮廓扩张，移除 DirectWrite bold face 替换；严格图像仍为 9/12，粗体、描边及嵌套样式的像素差异继续待处理。

## 实现

[前一诊断](./native-2d-m6.2-ttf-outline-probe.md) 中，轮廓扩张和横向滤波改善了覆盖总量，但少量边缘仍有较大差异。核对 [Skia 解析边缘量化](https://github.com/google/skia/blob/main/src/core/SkAnalyticEdge.cpp) 和 [精度定义](https://github.com/google/skia/blob/main/src/core/SkAnalyticEdge.h) 后，加入路径边缘的坐标量化，四个字号普通白色粗体的最大通道差值从约 102 降为 33–74。

生产 DirectWriteFont 保留 regular shaping，GetGlyphRunOutline 取得 regular 轮廓，按字号插值扩张并与原形状做 union，不再换成 simulated bold face。测量宽度、kerning、字形 advances 和组合符号 offset 继续由原 shaping 提供。D2D 软件路径使用横向四倍采样、边缘 X/Y 固定精度和四分之一像素量化，再以固定 FIR 系数生成灰度 mask，复用已有预混合与合成。

临时 mask 只按字形与视口的交集及滤波外侧样本分配；完全离屏不创建 bitmap/render target。Windows 非 server 构建链接 D2D、WIC 和 OLE 系统库。普通字、斜体和 GDI 系统字体路径保持原实现，没有新增每帧 JSB 调用。

此处没有移植完整 Skia scan conversion，曲线细分、扩张及边缘覆盖仍有差异。没有扩大阈值或以面积接近代替视觉通过；Label 的八方向偏移描边尚未替换。

## 所有权与生命周期

OutlineRasterizer 由一次同步 TextRenderer Draw 内的 unique_ptr 独占，拥有 D2D/WIC factory 和本次 COM 初始化 lease。glyph run/font face、sink adapter 的目标 sink 都是同步借用；geometry、sink、bitmap、target、brush 各自以 ComOwner 持有一份引用，像素与 mask 由 vector 值持有。未引入 shared_ptr。

COM lease 先于其他成员声明，使其后创建的 COM 对象先释放。CoInitializeEx 成功才解除本次 lease；RPC_E_CHANGED_MODE 时借用既有 apartment，不替调用方 CoUninitialize。新增独立 STA 线程回归，验证绘制保留调用方 STA，调用方解除后可初始化 MTA，没有额外 lease。

## 验证与未关闭项

- Windows Debug/Release 完整 native harness、实际字体 JSB 壳通过；24 个普通字/斜体 Web RGBA 校验值保持通过。新增粗体/粗斜体的部分离屏绘制与完整画布裁剪逐字节对照，验证滤波边界；完全离屏不改写像素。
- 1000 次字体创建/测量/释放循环增加真实绘制，覆盖轮廓 mask、COM lease 与临时几何。预热后 GDI 对象 Debug/Release 均为 10→10，句柄分别为 358→358、351→351。初始化后的固定资源基线高于旧实现，不能解释为无绝对成本或完整泄漏验收。
- 原始 96 例 Debug/Release RGBA 字节一致，严格通过保持 56/96，普通字/斜体未退化。白色拉丁粗体四个字号最大差值为 35/33/74/59；组合符号、泰文、颜色/半透明例仍有差异。结果同时记录 alpha 和 RGBA 差值，未从严格门禁排除低 alpha RGB。
- 4 个 Jest suite、49 项与 10 项 native 边界静态检查通过。两个既有诊断目标改为生产源码副本中仅调整边缘量化/滤波常量，删除重复实验实现；更新后的诊断构建和运行通过。
- 完整应用同快照 `21bdd5b691c76db3e68d1b61ef663bdd12a3856976beb3a3b3ea4245f487adc9`：布局 12/12，严格图像仍 9/12。bold 最大差值 124→20、不同像素数 1217→467；nested 最大差值 140→47、不同像素数 1223→573；outline 仍为 122。此前九个通过用例没有退化。
- 普通 Debug 与 ASAN 应用 manifest/RGBA 逐字节相同，ASAN stderr 0 字节，真实字体加载/释放标记通过；这不覆盖系统 DLL 内部的内存检测。

数值见 [结果](./native-2d-m6.2-ttf-bold-results.json)，日志位于忽略目录 build/ttf-outline-*。复现沿用 [原始画布](./native-2d-m6.2-ttf-preblend.md#复现与限制)、[诊断目标](./native-2d-m6.2-ttf-outline-probe.md#所有权与复现) 及 [完整应用入口](./native-2d-m6.2-richtext-gpu.md#复现)。应用脚本经 CLI 重建，对应平台完整特性引擎 JS 复用此前验证产物；本轮没有 JS 生产源码变化。

真正描边、粗体/嵌套边缘、灰色 RGB 取整、RTL/sideways、其他字体/平台、性能和完整资源生命周期门禁仍未关闭。未重跑 Graphics 74 例。工作区既有 SpriteFrame.native 改动未纳入提交，此快照不作为 M6 最终候选版本。
