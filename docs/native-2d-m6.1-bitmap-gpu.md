# M6.1 BitmapFont / LabelAtlas GPU 图集消费者

> 2026-11-17。仅覆盖 Windows Debug 本节点；完整 M6 仍未收口。

## 实现与所有权

Label 直接从原生字体资产读取 glyph/kerning 和 SpriteFrame，生成原生字形 quad，采样当前字体 GPU 图集。打包纹理没有 ImageAsset 时也可绘制，不再把整段文字 CPU 合成为新的纹理。JSB 不逐字形传输数据；SpriteFrame 保持无 native property。

Label 通过 IntrusivePtr 持有字体、源帧及渲染帧；Sprite 拥有复制的 quad、分块顶点和索引 buffer。DrawInfo 借用这些 buffer，重建、清空、detach 和析构前先清除提交。RenderEntity 保留 4 个内联槽，额外槽由 unique_ptr 独占且地址稳定；通用索引访问遍历全部槽。未新增 shared_ptr/weak_ptr。每块最多 16383 字形、65532 顶点。

显式 updateRenderData 与渲染 prepare 均检测源帧 revision、纹理、尺寸和格式，原生 prepare 另外检测 GPU 纹理/采样器身份，覆盖同尺寸重建。CPU opaque/checksum 诊断保留为显式读取时的惰性计算，不参与渲染、不上传纹理；诊断可能读取原图，GPU 渲染始终采样活动图集。

真实工程暴露了 SimpleTexture 通知错误：更新事件传底层 texture，公开 getter 返回 texture view，JS 缓存与 native 消费者身份不同。现改为在 view 完成后通知同一公开对象，mip 视图更换和销毁也同步更新。原生事件回归逐次检查通知值等于 getter，并检查重建及销毁失效。

## 验收与证据

按[统一流程](./native-2d-build-and-acceptance.zh-CN.md)构建 cocos-m1-test 的 Windows 与 Web 版本，重建完整 NATIVE override、同步资源并编译 Windows Debug app。结果记录在[本节点数据](./native-2d-m6.1-bitmap-gpu-results.json)。BitmapGpuProbe 纳入固定探针同步与 M5 入口；Web 采集使用 run-dynamic-atlas-web.cjs --bitmap，compare-bitmap-gpu.cjs 按既有通道容差 1 比较。

矩阵为 BitmapFont/LabelAtlas × 普通/旋转帧 × 原图/打包/恢复，共 12 份 256×256 RGBA。字号与源字号均为 16，固定 64×32 内容框、TOP/LEFT、CLAMP，不自动扩展为完整布局 parity。原生检查实际 DrawInfo 的纹理、8 顶点/12 索引、2 字形及 CPU 诊断构建次数 0。打包使用真实局部 DynamicAtlasManager，GPU-only 图集无 CPU 图片；每端打包/恢复与原图逐字节比较。

额外在真实 native Batcher 路径提交 70000 字形、5 个 chunk，检查最后一块 17872 顶点/26808 索引，清空后静态提交数及保留溢出槽的纹理/材质归零，CPU 诊断次数保持 0。PoC 另外覆盖 17000/70000 字形、空文本、UV 原点、图集打包/恢复、纹理尺寸/同尺寸重建及 sampler 更换。

完整串行验收一次通过：M0（末尾 8 suite/33 tests）、独立 M2/M3/M4/M4 extra/M5、UV 和定向 Jest（6 suite/32 tests）全部通过。字体 12/12 与 Sprite/Mask 12/12 的 Web/native RGBA 均字节相同，最大通道差值 0；70000 字形 GPU 分块、清空及 CPU 诊断次数 0 检查通过。原有六份测试入口 cwd 修正仍作为工作区既有输入保留，不并入本节点；SHA256 记入结果。

## 发现与未关闭边界

首次原始像素比较暴露默认 CENTER/CENTER 的已有 BMFont 布局缺口：两端颜色相同，字形边界位置不同。本矩阵随后明确为 TOP/LEFT，以隔离本节点的图集 GPU 采样；默认居中差异保持未解决，不算视觉门禁通过。完整字体缩放、spacing、换行、各 overflow、对齐与裁剪语义、trim/offset 组合、复杂文本仍需单独实现并扩大矩阵。

本节点不迁移 DynamicAtlasManager/Atlas 排布算法，不代表自动合图、图集满/压缩来源回退、真实 bundle/旧场景/Prefab、异步/延迟销毁、长期内存、性能、Release、ASAN 或其他平台验收完成。RichText 严格图像历史结果仍为 9/12。

后续状态：默认居中、字号/间距/换行和四种 overflow 已由[原生布局节点](./native-2d-m6.1-bitmap-layout.md)继续实现，并扩大到 76 组布局及默认居中图集 GPU 对照；上文未解决记录描述本节点当时的快照，不再作为当前居中对齐阻塞。复杂布局/资产与终态 M6 范围仍按后续计划验收。
## 2026-11-19 字形提交计数回归

删除 `Label.getRenderedBitmapGlyphCount()` 和原生计数字段后，验收按每个有效 `RenderDrawInfo` 的 4 个顶点、6 个索引统计一个字形。Windows Debug、Release 的原生回归分别检查 17,000 个字形分为 2 块、70,000 个字形分为 5 块，以及清空文本后的 0 块。整应用在两个配置下都提交了完整的 70,000 个字形，清空后释放了溢出块引用的材质和纹理。

两个 Windows 配置分别与同轮 Web 对照。BitmapFont 和 LabelAtlas 的 12 张图集状态图、80 张布局图全部逐字节相等，80 项布局的字形数和测量值通过对照。复现入口见 [GPU 场景](../native/tests/2d-poc/fixtures/acceptance/BitmapGpuProbe.ts)、[图集状态比较](../native/tests/2d-poc/compare-bitmap-gpu.cjs)和[布局比较](../native/tests/2d-poc/compare-bitmap-layout.cjs)。两个比较脚本均接受项目路径和 `Debug` 或 `Release`。
## 2026-11-19 Label 纹理回读

移除 `getPixelChecksum()` 后，Label 重绘时不再逐像素累加校验和。Windows Debug 和 Release 的原生回归从提交的纹理读取 RGBA，核对位图字形着色前后的图集内容、TTF 上传的 alpha 与独立 Canvas 栅格结果，以及 128 次重绘后的纹理内容。整应用在 NONE、CHAR 两种缓存模式下分别检查等尺寸换字后的纹理身份与像素变化，以及尺寸变化后的纹理替换。两种配置的 M3 Label 和 M5 RichText 入口通过，位图字体各 92 张图与同轮 Web 逐字节相等。
## 2026-11-19 移除 BMFont 诊断光栅器

移除原生 Label 中专供诊断的 BMFont CPU 光栅器、失效标记和 `getBitmapDiagnosticBuildCount()`。C++ 回归读取提交的图集纹理，验证共享帧替换、字形四边形以及资源释放后的空提交。M3 场景逐个隔离字体节点，在渲染完成后读取目标像素；Windows Debug/Release 的合成位图字体各有 960 个着色像素，旧资源 OpenSans-Bold 各有 3134 个。两种配置都验证了绘制使用字体自己的图集，70,000 个字形分为 5 块，M3 Label 与 M5 RichText 验收通过。每种配置的 12 张图集状态图和 80 张布局图与本轮 Web 逐字节相等。
## 2026-11-19 TTF 与 CHAR 覆盖像素回读

引擎的 Label 已删除 `getOpaquePixels()`、重绘后的逐像素计数，以及专为后续图集提交暂存的整张 RGBA 副本。BITMAP 缓存将当前栅格缓冲直接交给图集；图集在调用返回前复制所需像素。独立测试程序和整应用均从提交的纹理回读，覆盖空格背景、下划线、描边和 RichText 内部段。

Windows Debug 和 Release 的布局、字体资产、Sprite API 三组 JSB 探针以及 M3 Label、M5 RichText 全部通过。每种配置的 92 张位图字体图像与同轮 Web 逐字节相等。两种配置的 RichText 均有 12/12 项布局一致、9/12 项通过严格像素阈值；粗体、描边、嵌套样式的差异与清理前一致。
