# M6.1 BitmapFont / LabelAtlas 原生布局

> 2026-11-17。继续修复 GPU 下沉节点发现的默认居中位置差异，完整 M6 尚未收口。

## 实现

新增 BitmapFontLayout 原生值类型布局核心，Label 的字形网格与无换行测量共同调用。核心借用字体 glyph/map/kerning，返回自己拥有的尺寸、行宽及字形位置/源矩形；没有新增共享指针或 JS 权威布局数据。

规则来自实际 Web TextProcessing：按字形右边界计算行宽，字体/源字号缩放，spacingX，词/CJK/空格分段换行、显式换行/CR、九种水平/垂直对齐组合，以及 NONE、CLAMP、SHRINK、RESIZE_HEIGHT。SHRINK 使用 Web 的整数字号搜索和缩放行距；CLAMP 沿用 Web 的字形中心水平裁剪及垂直源矩形裁剪，普通/旋转 UV 仍由当前原生 SpriteFrame 计算。测量不再使用旧 TTF baseline 比例或未经缩放的 advance；显式 updateRenderData 也检测 UITransform 尺寸变化。

没有顺手改写 Web 的布局语义。现有 horizontalKerning 的末字符零值、CLAMP 字形中心判定和 SHRINK 的 ToInt32/位移行为均按实际 Web 对照；极端整数转换以显式无溢出运算复现，避免 C++ 越界转换。此处不将这些兼容行为推广为新的文字排版规范。

## 验收矩阵

原生布局夹具与实际 Web TextProcessing 对照 2307 组：文字/显式换行/CR/缺字/CJK/空串、各对齐/overflow、字号、间距、换行、框尺寸，以及零字号和 32-bit 转换边界。g++ 与 Windows MSVC 两个后端均通过；M0 固定运行此入口。比较内容尺寸、actualFontSize、scale、每行宽和每个字形的位置/源矩形，数值容差 0.0001。

BitmapGpuProbe 真实 GPU 矩阵为 BitmapFont/LabelAtlas × 普通/旋转源帧 × 19 个布局，共 76 份 256×256 RGBA，覆盖九种对齐、大小字号、spacing、词换行、四种 overflow、行距和裁剪。每份还比较内容尺寸、actualFontSize 和实际字形数。原有 12 份图集原图/打包/恢复捕获改为默认 CENTER/CENTER，验证上一节点的默认对齐缺口已修复；70000 字形用 NONE 模式提交全部字形，避免把正确的 CLAMP 裁剪误认为截断。实际提交仍为 5 块，清空后引用归零，CPU 诊断构建次数为 0。

完整门禁首轮发现旧 M3 合成字体探针依赖 CPU 纹理宽度 <66 来推断 kerning，同时没有固定 Label 字号，且配置省略源字号并使用 Web 不识别的嵌套 kerning。现将 LabelSpike.ts 纳入固定同步，显式设置源/目标字号 16、有效扁平 kerning，精确检查 80×20 内容框、4 字形和 16 顶点/24 索引；kerning 改由实际 Web 数值与 GPU 像素验证，没有增加图像容差。移除了该探针对 SpriteFrame.native 的旧诊断读取。

Windows/Web 工程构建、完整 NATIVE override、资源同步及 Debug app 编译均按[统一流程](./native-2d-build-and-acceptance.zh-CN.md)执行。最终同候选门禁和像素结果见[验收数据](./native-2d-m6.1-bitmap-layout-results.json)。

最终候选的完整串行门禁通过：M0（末尾 8 suite/33 tests）、独立 M2/M3/M4/M4 extra/M5、UV 及定向 Jest（6 suite/32 tests）。含 kerning 的 76/76 布局图像、12/12 字体合图图像、12/12 Sprite/Mask 图像的最大通道差值均为 0。M5 在原 45 秒预算内完成；既有六份测试入口 cwd 改动未并入本节点，输入哈希保留于结果。

## 未关闭范围

本矩阵不替代复杂 Unicode/补充平面字符、bidi/shaping、任意 trim/offset/mesh 组合、字体资产所有入口/源字号元数据变更、真实旧场景/Prefab/bundle 与异步/延迟销毁验收。动态合图自动触发/回退策略、长期内存、性能、Release、ASAN 和其他平台继续待办。旧 CPU opaque/checksum 仅作惰性诊断，不作为新布局或实际 GPU 字形的像素依据。完整 M6 Gate 保持未关闭。
