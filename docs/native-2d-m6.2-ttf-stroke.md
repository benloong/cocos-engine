# M6.2 Windows 自定义字体原生描边

> 2026-11-17。自定义字体的 Label Outline 已接入真实轮廓描边；严格视觉门禁仍未通过。

## 实现与所有权

DirectWriteFont 新增 stroke，复用 regular shaping、字形轮廓、D2D Widen、裁剪 mask 和 FIR/预混合管线。描边只绘制轮廓环，不与实心字形 union；填充仍由独立 draw 完成。支持 round、miter、bevel，拒绝非正数及非有限线宽。

Canvas 增加默认返回 false 的 supportsTextStroke 能力查询，Windows 私有 DirectWrite 字体返回 true。Label 在支持时使用两倍 outlineWidth 的 round stroke 后填字；GDI 与其他平台继续使用既有偏移填字回退。Windows Canvas 初始化为黑色、线宽 1、miter、left/alphabetic，非法线宽保留旧状态。

临时轮廓由同步 Draw 的 unique_ptr rasterizer 管理；COM 引用分别由 ComOwner 持有，mask 由 vector 值持有，shape 指针只借用局部 geometry。COM apartment lease 沿用前一节点的配对释放，没有新增 shared_ptr、跨帧 JS 镜像或逐字形 JSB 调用。

## 验证与限制

- Windows Debug/Release 完整 native harness 和实际字体 JSB 探针通过。新增空心内部、线宽响应、join 区别、无效线宽、部分离屏裁剪及 Canvas 默认值测试；保留 24 个普通/斜体 Web RGBA 校验值。
- 1000 次真实字体创建/测量/绘制/释放循环中增加 250 次 stroke。GDI 均为 10→10，Debug/Release 句柄分别为 363→363、361→361；STA 调用方 lease 保持不变。
- 4 个 Jest suite、49 项及 10 项 native 边界静态测试通过。下一字号校验节点另有 7 suite、68 项与 Debug/Release 实际 JSB 复验。
- 原始描边矩阵覆盖四个字号、普通/粗体/斜体，以及三种 join、填充叠加、红色和半透明泰文：72 例 Debug/Release 字节一致，但严格 Web 对照 **0/72**。面积相近不能代替像素通过。
- 完整应用快照 `cb28128dc7d54cfedaa2e8ae4d5a2d1efcf8e758d5fe51231af2a04297d5ab5c`：布局 12/12，严格图像仍 9/12。outline 最大差值 122→30，不同像素 202；bold 20、nested 47，均仍失败。
- 普通 Debug 与 ASAN 的 12 张 RGBA 和 manifest 逐字节一致，ASAN stderr 为 0 字节，真实字体加载/释放标记通过。该 GPU 快照早于独立字号校验提交 69624e043e，不能视为当前完整候选版本验证。

原始数据见 [结果](./native-2d-m6.2-ttf-stroke-results.json)。复现沿用 [Canvas 对照](./native-2d-m6.2-ttf-preblend.md) 和 [完整 GPU 应用](./native-2d-m6.2-richtext-gpu.md#复现)。原始工具新增末尾 mode 参数：stroke-round、stroke-miter、stroke-bevel、outline；Web runner 使用相同 mode。日志为 build/ttf-stroke-*。

剩余：轮廓扩张/栅格覆盖差异、粗体描边、灰色 RGB、RTL/sideways、其他字体/平台、性能和完整资源生命周期。未重跑 Graphics 74 例；已有 SpriteFrame.native 改动仍未纳入提交，此节点不作为 M6 最终候选验收。

## 2026-11-19 Windows 与 Web 原始字形对照

使用同一份 Thonburi.ttf、白字、256×128 缓冲，比较 12、24、36、48 px 的 normal、bold、italic。每格共 12 例。通过要求为所有 RGBA 通道逐像素绝对误差 ≤1。下表括号内是该组最大 alpha 误差。

| 文本 | 填充通过数 | 圆角描边通过数 | 描边后填充通过数 |
|---|---:|---:|---:|
| Atlas 123 | 8（74） | 0（86） | 0（86） |
| I E L | 8（69） | 0（55） | 0（55） |
| O S C | 8（73） | 0（93） | 0（93） |

Windows Debug 与 Release 在 108 例中逐字节相同。两者与 Web 的 RGB 最大误差均为 0。普通和斜体填充的 24 例全部通过，粗体填充的 12 例全部超差。仅画描边的 36 例已全部超差，说明白色轮廓的差异在叠加填充及 GPU 采样前就已出现。这个实验仍不能区分轮廓扩张误差和栅格采样误差，也不能外推到其他字色。

复现时先在 native/tests/2d-poc/native 下的 out 和 out-release2 构建 cc2d_ttf_raster，然后在仓库根运行 `node native/tests/2d-poc/compare-ttf-contours.cjs --capture`。不带参数可重新比较已有捕获。逐例 SHA256、误差、浏览器版本和字体哈希写入 native/tests/2d-poc/build/font-contour-report.json。比较器记录每例是否超差，命令成功仅表示数据完整并且两个 Windows 配置一致。

## 单字形起点与轮廓覆盖

在同一份 Thonburi 字体中单独绘制 I 和 O。每个字形各用 12、24、36、48 px 与常规、粗体、斜体、粗斜体四种样式，分别做白色填充和 4 px 圆角描边。每个组合的 64 个起点覆盖横纵方向 0 至 7/8 像素的全部配对。比较时仅去掉图块的整数平移，检查边界没有触墨，并对整块 RGBA 使用原容差 1。[逐组合像素误差、原点误差和捕获哈希](./native-2d-m6-ttf-origins.json)

| 单字形场景 | 严格通过位置数 | 最大通道差 |
|---|---:|---:|
| 常规和斜体填充 | 1024 / 1024 | 0 |
| 粗体和粗斜体填充 | 0 / 1024 | 81 |
| 四种样式圆角描边 | 0 / 2048 | 93 |

Windows Debug 与 Release 的 64 张原始图集逐字节相同。Windows 与 Chrome 在每个组合都把相同的起点分为相同的 10 组，同组内平移后的覆盖图完全一致。全部 48 个超差组合在整数起点也超差。由此可以在单字形、整数起点直接复现，排查不必依赖字间距、嵌套布局或 GPU 采样。

另用现有 Release 诊断程序保留横向滤波，关闭轮廓点量化。4096 个位置的严格通过数仍为 1024。I 的描边最大误差从 54 升至 102，O 从 93 降至 89。这个开关不能消除超差；目前仍需区分轮廓扩张和抗锯齿覆盖计算。

复现时在 Debug 构建 `cc2d_ttf_raster`，在 Release 构建 `cc2d_ttf_raster` 和 `cc2d_ttf_geometry_filtered`，然后执行下列命令。两个构建目录相对于 `native/tests/2d-poc`，也可传入绝对路径。程序在 `build/ttf-origin-report.json` 记录逐组结果。

```powershell
node native/tests/2d-poc/compare-ttf-origins.cjs --capture build/fontsize-clean-Debug build/fontsize-clean-Release
```

## 轮廓输入与矩形扩张对照

Windows Debug、Release 和 Chrome 157 使用同一份 Thonburi.ttf，重复上述 I、O 的 64 起点矩阵。第一组对照改为向 DirectWrite 请求字体设计单位下的轮廓，再缩放到目标像素尺寸，然后执行原有扩张、采样与混合。两种输入得到的 64 张原生图集逐字节相同。其中 48 张经过轮廓绘制路径，另 16 张常规或斜体填充作为对照。对这批用例，更改提取字号没有改变与 Web 的差异。

第二组只检查粗体填充的 I。诊断程序先核对轮廓面积与外接矩形面积一致，再以相同的合成粗体宽度直接构造扩张矩形，送入同一套采样与混合流程。表中数值为各字号 64 个起点对 Web 的最大通道差。所有对照的 Debug 与 Release 图像均逐字节相同。

| I 的填充方式 | 12 px | 24 px | 36 px | 48 px |
|---|---:|---:|---:|---:|
| 直立粗体，原有扩张与合并 | 9 | 14 | 13 | 69 |
| 直立粗体，直接构造矩形 | 9 | 14 | 13 | 69 |
| 粗斜体，原有扩张与合并 | 9 | 13 | 13 | 13 |
| 粗斜体，直接构造矩形 | 9 | 6 | 13 | 13 |

直立粗体的两种原生输出在四个字号下完全相同。48 px 整数起点的超差集中在图块第 18 行（从 0 起算），像素 (11, 18) 的原生 alpha 为 1，Web 为 70。下一步可以在这一条水平边分别核对扩张宽度、纵坐标取整和扫描覆盖率。该结果仅覆盖直立矩形；24 px 粗斜体已经表现出两种几何表示的差异。

在 `native/tests/2d-poc/native/out` 和 `out-release2` 分别构建 `cc2d_ttf_raster`、`cc2d_ttf_design_units`，从仓库根运行 `node native/tests/2d-poc/compare-ttf-outline-inputs.cjs --capture`。[比较器](../native/tests/2d-poc/compare-ttf-outline-inputs.cjs)将浏览器版本、字体哈希、逐图哈希、超差像素数和整数起点的超差行写入 `native/tests/2d-poc/build/ttf-outline-inputs.json`。命令成功表示采集完整且 Windows 双配置一致，各图对 Web 的误差单列报告。

## 直立矩形粗体的分数像素覆盖

48 px 的常规 I 在 (12, 18) 使用显式 miter 描边。宽度 1.25、1.375、1.5、1.625、1.75 px 时，Windows 双配置与 Web 的 alpha 依次为 1、1、1、1、141。合成粗体的水平边位于 y = 18.9375，原有纵向取整丢失了它在第 18 行覆盖的 1/16 像素。

Windows 现在对小型、单轮廓、轴对齐矩形的直立合成粗体填充，在 LCD 滤波前以相交面积计算采样覆盖率。四个字号（12、24、36、48 px）各 64 个起点的 RGBA 与 Web 全部逐字节一致，改动前最大通道差依次为 9、14、13、69。I 和 O 的 64 组对照中，其余 60 组 Windows 图像哈希与原基线一致。可用上节的采集命令复核。[原始对照基线](./native-2d-m6-ttf-origins.json)

同轮真实 RichText 应用的 Windows Debug 与 Release 逐图、逐布局一致。相对存档，粗体超差像素由 467 降至 448，嵌套样式由 573 降至 553，描边仍为 202。三组最大差分别为 20、47、30。其余九组通过，全部 12 组布局一致。本轮 Web 的 12 张图像与存档逐字节相同。夹具快照为 aaafbd43c198603707676d22b3e1534d173a96ca6513cbac93fd5f24ceca8433。[场景对照基线](./native-2d-m6-richtext-configurations.json)

## 同一字形轮廓按绘制阶段重放

真实 RichText 场景用 24 px 的白色 Atlas 叠加绿色描边。Windows 与 Web 的 202 个超差像素都在绿色通道。其中 192 个位置两端的红色通道均不超过 1，红蓝通道全图最大差为 1，alpha 完全相同。绿色差值（Windows 减 Web）范围为 −16 至 +30。该统计来自应用快照 `46e5a8a11398ab1a085bad4cc3a95af1b823a5c40e5ebbce55cbe790f9f12129`。

独立测试绘制 Thonburi 的绿色 Atlas 123，笔宽 4 px、圆连接，覆盖 12、24、36、48 px 和常规、粗体、斜体。每个 Windows 配置分别采集 96 个可见字形，浏览器在横向四倍采样的透明 Canvas 上重放路径，再将 alpha 交回原生代码执行同一套滤波、预混合与逐字形合成。对照为 Chrome 的 strokeText。表中超差按原始 alpha 绝对差大于 1 统计，独立采集的 Windows Debug 和 Release 各阶段 RGBA 哈希均一致。[逐张数据与哈希](./native-2d-m6-stroke-replay.json)

| 交给栅格器的输入 | 12 张图的超差像素合计 | 最大 alpha 差 | 24 px 常规超差像素 | 24 px 常规最大差 |
|---|---:|---:|---:|---:|
| 生产路径，Direct2D 扩张、展平、WIC 填充 | 5835 | 86 | 333 | 86 |
| Direct2D 扩张并展平，Canvas 填充 | 5050 | 86 | 305 | 86 |
| Direct2D 扩张，保留贝塞尔曲线，Canvas 填充 | 4872 | 86 | 297 | 86 |
| DirectWrite 原始轮廓，Canvas 扩张并填充 | 40 | 40 | 0 | 1 |

在这组输入上，把已扩张的轮廓交给同一浏览器填充仍有 4872 个超差像素。将描边扩张也交给浏览器后减少到 40 个。24 px 常规的 333 个超差像素全部进入容差。生产实现应优先核对笔宽偏移后曲线和圆连接的构造。其余 40 个像素中有 32 个在斜体，仍需单独定位。独立对照覆盖 7/12 张图；此实验保留生产实现，真实 RichText 严格像素仍为 9/12。

在 `native/tests/2d-poc/native/out` 和 `out-release2` 分别构建 `cc2d_ttf_raster`、`cc2d_ttf_stroke_replay` 和 `cc2d_ttf_stroke_freetype` 后执行下列命令。输出目录包含每一阶段的轮廓、alpha 掩码、RGBA 和带哈希的比较报告。

```powershell
node native/tests/2d-poc/compare-ttf-stroke-replay.cjs
```

### 同一轮廓的圆角与内部重叠边

将 96 个相同的 DirectWrite 字形输入继续分解。除扩张或绘制方式外，所有组合均使用相同的 4 px 画笔、变换、水平采样、滤波和最终混合。Windows Debug 与 Release 对以下每个组合给出相同图像哈希。表中为 12 张绿色描边图像相对 Chrome 字体绘制的 alpha 超差像素之和，容差为 1。

| 扩张与填充方式 | 超差像素数 | 最大差 | 24 px 常规超差数 |
|---|---:|---:|---:|
| 生产 Direct2D 扩张、展平和 WIC 填充 | 5835 | 86 | 333 |
| Direct2D Outline 清除重叠内部边，再走相同的原生采样 | 5939 | 86 | 337 |
| Direct2D 原生画笔直接绘制原始路径 | 6440 | 71 | 385 |
| Direct2D 扩张，Chrome 填充 | 4872 | 86 | 297 |
| 清除内部边后由 Chrome 填充 | 5093 | 86 | 302 |
| 引擎自带 FreeType 以 26.6 坐标扩张、Chrome 填充 | 5111 | 142 | 315 |
| Chrome 对原始路径描边 | 40 | 40 | 0 |

DirectWrite 输出的 1260 段三次曲线都能还原为 TrueType 二次曲线。由两侧控制点分别反推的二次控制点坐标最大差小于 0.000004 px。将还原的路径交给 Chrome 描边后，12 张图的超差数和最大差逐项与三次中心线相同，仍有 40 个超差像素。

另从原始路径自动选出 8 个轴对齐矩形，比较相同变换下的单字形 alpha 掩码。用对应外圆角矩形及内孔表示画笔覆盖区域，Chrome 的 roundRect 填充与直接描边在 8/8 个样本中逐字节一致。外圆角改用端点和切线相同的四段三次贝塞尔曲线后，8 个样本合计有 308 个采样点超差，最大差 72。这里统计的是水平四倍采样的原始掩码，表中则是最终图像像素。

圆角的曲线表示和扫描方式已能单独复现这 8 个样本的差异。含曲线的其他字形和斜体没有由矩形实验覆盖。当前结果不足以采用替代扩张器，最终 Gate 的三组字体图像仍待修复。[逐项哈希和矩形掩码对照](./native-2d-m6-stroke-replay.json)

### 固定字形路径，分别对照扩张和栅格化

Windows Debug 和 Release 重采当前 DirectWrite 的 `Atlas 123` 轮廓。12 张图覆盖四个字号、正体、粗体和斜体，包含 96 个字形掩码。诊断在 CanvasKit 0.42.0 和 Windows 间交换特定绘制阶段的输入。每一组最终图像都使用原生现有滤波、预混合及合成代码，对 Chrome 157 的 `strokeText` 使用原容差 1。两个 Windows 配置的原始掩码差值、逐图统计和图像哈希均一致。[逐图数据及二进制哈希](./native-2d-m6-ttf-canvaskit.json)

| 扩张与栅格化 | 图像通过数 | 超差像素合计 | 最大 alpha 差 |
|---|---:|---:|---:|
| Direct2D 生产路径 | 0/12 | 5835 | 86 |
| Direct2D 扩张，CanvasKit 填充输出曲线 | 0/12 | 4872 | 86 |
| Direct2D 扩张并沿用生产线段，CanvasKit 填充 | 0/12 | 5050 | 86 |
| CanvasKit 扩张，Direct2D 按生产方式展平再填充 | 0/12 | 5910 | 88 |
| CanvasKit 扩张，Direct2D 直接填充路径 | 0/12 | 6428 | 74 |
| CanvasKit 扩张并栅格化 | 7/12 | 40 | 40 |

CanvasKit 直接描边和填充其导出的路径，在 96 个掩码上均进入容差。Direct2D 回放将导出的圆锥曲线用对应的小圆弧表达。为排除这次转换的影响，另把 Direct2D 生产路径已展平及取整的线段原样交给 CanvasKit。两种栅格器用相同顶点、填充规则、掩码尺寸和坐标，96 个掩码均超差，累计 9167 个采样点差值大于 1。另一个控制中，CanvasKit 与 Chrome 填充相同 Direct2D 扩张曲线时，全部掩码都在容差内。对于这组字形，扩张和掩码覆盖都需要对照。CanvasKit 的完整诊断在 24 px 正体上通过，最终 12 张图仍有 5 张超差。[CanvasKit 路径接口](https://raw.githubusercontent.com/google/skia/main/modules/canvaskit/npm_build/types/index.d.ts)

当前应用快照 `938c28378ba177b2e0b1215d166a05a1ae647fe3ed230f64578ccb89ba4d57fe` 的 Windows Debug、Release 和 Web 已重新采集。两种 Windows 配置各完成 1000 轮字体生命周期。布局 42/42，严格像素 39/42。三组超差图的像素数继续为粗体 448、描边 202、粗斜体嵌套 553，三端全部 42 张图的各自哈希与上轮相同。[当前应用数据](./native-2d-m6-ttf-canvaskit.json)

这些入口只用于测试生成的原生可执行文件。复现时，按上节构建 Windows Debug 和 Release 的字形重放程序，运行 `compare-ttf-stroke-replay.cjs`，并从它打印的结果路径取所在目录。将官方 `canvaskit-wasm@0.42.0` 用 `npm pack --ignore-scripts` 下载并解包到忽略的构建目录。对照脚本验证包的 JS 和 WASM 哈希。

```powershell
node native/tests/2d-poc/compare-ttf-canvaskit.cjs $replayDirectory $canvasKitPackageDirectory
```
