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
