# M6.2 Label 纹理、基线与采样映射

> 2026-11-17。12/12 布局和画布尺寸一致；严格像素仍 0/12，不扩大比较阈值。

## 定位与修复

真实 Web telemetry 确认 24px Thonburi 的普通段：布局 95.9765625×37.8，实际 canvas 95×37，alphabetic 绘制起点 (0,20.88)。view 的原始 fontScale 为 0.596875，但 Web 将有效缩放限制到至少 1，实际字号仍为 24。此前 native 把纹理扩大为 ceil(content)+2，绘制点再加 1，并使用 top 基线；这些额外像素被压回相同 UI 四边形，造成位置/比例和边缘差异。

本轮 native TTF 路径调整为：

- 画布按 Web 的整数尺寸截取，去掉额外边框；布局尺寸继续保留小数，顶点范围不改变。
- 使用 alphabetic 基线及 Web 的 TOP/CENTER/BOTTOM 计算，下划线相对基线偏移 fontSize/8；对齐位置使用未取整的画布尺寸。
- 以同色 alpha=1/255 的背景预填，描边用描边色，其他用文字色，避免线性采样透明黑像素产生暗边。TTF 的 getOpaquePixels 诊断排除 alpha≤1 的背景；空格不能因此被当作可见字形。
- TTF 纹理 sampler 使用 CLAMP_TO_EDGE，与 Web 一致。
- Windows Canvas fillRect 保留小数覆盖率、裁剪负坐标/反向矩形并作 source-over 合成，不再把下划线等小数位置直接转成整数。没有新增所有权；函数同步借用 delegate 拥有的 RGBA 缓冲区。

## 验证

新原生回归先复现纹理尺寸与绘制校验失败。修复后，通过与独立 Canvas 按实测 Web 参数绘制的 alpha checksum 比较，验证 Label 基线、边缘预填及尺寸；另覆盖 sampler、空格诊断、小数矩形四像素覆盖、重复 source-over、负坐标和负尺寸裁剪。1000 次 Canvas 创建、测量、填充与释放的 GDI 对象数，Debug/Release 均为 13→13。

Windows Debug/Release 完整 native harness 和实际 RichText JSB、3 个 Jest suite/11 项通过；10 项静态检查及夹具 TypeScript（skipLibCheck）通过。仍未运行其他平台的这组矩形 AA 回归。

同一快照 `4e4e543e329b0f612ee9a02a315b54e6b31cba9dec9d310c6cd471020a68bf94`：普通 Debug/ASAN 元数据与 RGBA 相同，ASAN stderr 0 字节；12 例全部片段的 native/Web 实际画布尺寸相同，12/12 布局继续一致。详见 [结果及两端 raster telemetry](./native-2d-m6.2-label-raster-results.json)。

严格图像仍 0/12。普通文字最大通道差值由前一节点 252 降至 102，颜色例由 246 降至 65；描边由 255 降至 136。12 例绘制矩形的非黑像素区域计数与 Web 相同，但这仅是区域检查，不能证明字形一致。剩余 rasterization、粗体/斜体模拟、描边与复杂混合效果继续验收。

## 复现与边界

沿用 [RichText GPU 入口](./native-2d-m6.2-richtext-gpu.md#复现)，重编译当前 native 应用。Web raster telemetry 仅读取测试节点的 canvas、字号和绘制位置，不参与产品运行时布局；native 没有恢复 Web assembler 算法或增加逐帧 JSB 调用。

原始日志在忽略的 `native/tests/2d-poc/build`：label-raster-before.log、label-raster-final-tests.log、label-raster-release-comparison.log、label-raster-release-asan-run.log、label-raster-release-static.log。完整字体/效果、平台、资源循环、性能及最终同候选版本门禁保持未关闭；工作区既有 SpriteFrame.native 改动未纳入本节点。
