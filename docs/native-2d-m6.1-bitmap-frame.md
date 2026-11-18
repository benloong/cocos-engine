# M6.1 BMFont 帧矩形、trim/offset 与旋转

> 2026-11-18。继续验证字体 GPU 消费者的帧状态与四顶点转换；完整 M6 尚未收口。

## 原生实现

将 Label 内联的帧矩形转换提取为 BitmapFontLayout 中的 buildBitmapGlyphQuad。输入为布局字形、scale 和当前帧/纹理尺寸快照；输出为自己拥有的源矩形与四顶点值。原生 Label 直接提交该输出，没有增加 JS 算法、逐字形 JSB 或共享指针。中间计算保持 double，提交到既有 Sprite float buffer 时转换。

转换沿用 Web TextProcessing._determineRect 与 BmfontUtils.generateVertexData：非零 rect 原点、originalSize 与 offset 对 trim 的修正、普通/旋转 UV，以及旋转帧负 source-y 时对源高度和实际几何高度的同步调整。保留 Web 先检查正源矩形、后调整旋转高度的现有顺序；不把异常元数据的负高度解释成新的字体格式规范。

## 数值与运行时证据

2307 组既有布局输入加入五类帧配置及普通/旋转组合；比较实际 Web TextProcessing 和实际 BmfontUtils 输出的源矩形、每个顶点的位置与 UV，并保留尺寸、scale、actualFontSize 和行宽对照。g++ 与 Windows MSVC 两端执行同一原生核心，数值容差仍为 0.0001。此比较不使用手写 Web UV 替身。

原生 PoC 额外只修改共享 SpriteFrame 的 offset/originalSize/rotated，既不改 Label 属性也不重载字体，检查旧 Label 的 UV 与旋转字形物理高度即时更新。覆盖恢复到普通帧后再打包，CPU 诊断构建次数保持 0。

真实 GPU 夹具使用带透明 padding 的 48×32/32×48 纹理，字体帧原点为 (4,6)，并在 76 个布局中交叉四类帧配置：基本帧、trim、offset 和旋转负 source-y 边界。每份捕获还记录/比较帧原点、originalSize、offset、配置源字号及独立公共字号。保留 12 份非零原点的原图/打包/恢复捕获，以及 Sprite/Mask 12 份回归；不增加完成预算或图像容差。

全部构建/门禁遵循[统一流程](./native-2d-build-and-acceptance.zh-CN.md)，结果见[验收数据](./native-2d-m6.1-bitmap-frame-results.json)。

首次完整串行测试的字体对照通过，但 Sprite/Mask 的 Web 捕获含额外灰白 UI 像素。M4 捕获现在临时使用专用 Camera 可见层，仅让该夹具的 Mask、Sprite 和 Graphics 进入捕获，结束后恢复原可见层。修正后该组 12 份 RGBA 与 native 一致，原有红像素数量断言保持有效。

## UI 批次资源寿命

扩展夹具的第一次 Windows 运行提前退出。工程已有崩溃日志将异常定位到提交 UI InputAssembler 时的 CommandBufferAgent::bindInputAssembler，随后有两次调试运行完成了矩阵，未重现该异常。红测另外确定了所有权问题：DrawInfo 清理后，原先的 DrawBatch2D 没有保留 IA、顶点和索引缓冲区的引用。

DrawBatch2D 现在通过 IntrusivePtr 持有 IA 及其使用的顶点、索引和间接缓冲区。清理批次先释放 IA，再释放缓冲区，且复用顶点缓冲区引用容器容量。确定性回归覆盖来源 DrawInfo 清理、同一 IA 重复设置、批次清理时的引用计数。该回归证实了已修复的所有权缺口，单次历史崩溃未能独立复现并归因。

最终候选完整串行门禁通过，包括 M0（8 个 Jest suite、33 项）、独立 M2–M5、SpriteFrame UV 和定向 Jest（6 个 suite、32 项）。76 份布局、12 份字体合图和 12 份 Sprite/Mask 图像全部字节一致。M5 保持原 45 秒预算。

## 剩余范围

这些矩阵覆盖基础帧转换和动态状态，不代表任意 mesh/vertices、完整旧资产/Prefab/bundle、所有 packed 状态下的元数据组合、非法资源回退、自动合图、复杂 Unicode、性能及跨平台完成。真实 GPU 使用四类有界配置；更极端数值仅作 Web 算法对照，不能替代有效字体资产的视觉验收。本节点不重跑 Release 或 ASAN；M6 最终 Gate 保持未关闭。
