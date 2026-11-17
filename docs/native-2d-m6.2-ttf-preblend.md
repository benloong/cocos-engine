# M6.2 Windows TTF mask 与覆盖率预混合

> 2026-11-17。完整 RichText 同快照严格图像 8/12，布局 12/12。粗体、斜体、描边及嵌套样式仍未通过。

## 原因与实现

[原始画布诊断](./native-2d-m6.2-ttf-raw.md) 排除了 Cocos 布局和 GPU 采样作为全部差异的原因。继续隔离后，发现原生直接使用 DirectWrite2 grayscale mask 和连续 run 坐标，而当前 Windows Chrome Canvas 对照需要 LCD 三通道 mask 的整数平均、sRGB 覆盖率预混合，以及逐字形的横向四分之一像素/纵向整数像素定位。独立实验组合这些规则后，四个字号的普通白字全通道逐字节一致；没有按用例拟合 gamma 或扩大阈值。

生产 DirectWriteFont 已调整：

- 保留 DWrite shaping 的 advances/offsets 和原始测量宽度；对水平 LTR run 的实际 glyph origin 做采样量化，包含组合附加符号的 offset。RTL/sideways 保留原有完整 run 定位，未据此声明 parity。
- 使用基础 IDWriteFactory 的 NATURAL_SYMMETRIC 三通道分析，整数平均为灰度，再按颜色亮度选择 sRGB/contrast=1 的预混合表。移除这条路径的 Factory2 grayscale 分支；不因此声称运行过 Windows 7。
- 八个亮度表为进程内不可变值数组，不引入字体缓存引用或 shared_ptr。字形数组和单 glyph run 都只在同步 Draw/analysis 调用期间借用；COM 对象继续独占一份引用并对称释放。
- source-over 的结果先量化为预乘 RGBA 字节，再导出 straight RGBA，改善低 alpha 的颜色边缘。灰色与白色预填叠加仍存在 RGB 取整差异，详见下方边界。

算法语义核对自 [Skia DirectWrite mask 转换](https://github.com/google/skia/blob/main/src/ports/SkScalerContext_win_dw.cpp)、[mask 预混合](https://github.com/google/skia/blob/main/src/core/SkMaskGamma.cpp)、[字形定位与亮度规则](https://github.com/google/skia/blob/main/src/core/SkScalerContext.cpp) 及 [Chromium Windows sRGB/contrast 构建配置](https://github.com/chromium/chromium/blob/main/skia/BUILD.gn)。这些主分支源码不等于捕获浏览器的精确构建来源；具体结论以同字体实际 Canvas 对照为证据。

## 验证

- Windows Debug/Release 完整 native harness 和实际字体 JSB 壳通过。新增 12 个独立 Web Canvas 原始 RGBA 校验值：普通白色拉丁字、组合附加符号、泰文，各 12/24/36/48px。不是从 native 实现生成期望值。
- 原始夹具扩展为 96 例，全部 native Debug/Release 字节一致。32 个普通字体用例中，28 个全通道差值≤1：白/红/绿/黑/半透明白的拉丁字，以及白色组合附加符号/泰文；普通白字和两类复杂文本的 12 例差值均为 0。灰色 4 例 alpha 完全一致，straight RGB 仍有最高 14 的取整差异；粗体/斜体 64 例继续失败，总严格通过 28/96。
- 4 个 Jest suite、49 项通过；10 项 native 边界静态检查通过。1000 次 DirectWrite 创建/测量/释放的 GDI 对象 Debug/Release 均为 10→10，句柄分别 335→335、328→328；这不是完整泄漏检测。
- 完整 RichText 应用重新编译，使用快照 `1850702711e41f85aba2a96ac4cdcbe8f6745b9654b7f5a318f49a39528b867d`。12/12 布局继续一致，严格图像从前节点 0/12 提升为 8/12：basic、underline、colors、wrap-left/center/right、multiline、unicode。basic/colors/三种换行/multiline/unicode 最大通道差值 0，underline 为 1。
- 剩余四个应用例：bold 最大差值 124，italic 154，outline 122，nested 205。普通 Debug 与 ASAN 的 manifest/RGBA 字节相同，ASAN stderr 0 字节。字体加载与释放标记通过。

完整数值和文件哈希见 [结果](./native-2d-m6.2-ttf-preblend-results.json)。原始日志为忽略目录 `native/tests/2d-poc/build/ttf-preblend-*`，包括 debug/release-build、debug/release-tests、static、jest、gpu/asan-build、gpu/asan/web-run、gpu-comparison。

## 复现与限制

基础复现沿用原始画布报告。原生探针增加可选 color、sample 参数，例如 `cc2d_ttf_raster.exe <font> <output> gray latin`；Web 为 `node native/tests/2d-poc/run-ttf-raster-web.cjs gray latin`，比较为 `node native/tests/2d-poc/compare-ttf-raster.cjs <native-output> <web-output>`。color 支持 white/red/green/gray/black/half-white，sample 支持 latin/combining/thai。默认白色拉丁字输出目录保持不变；其他 Web 输出为 build/ttf-raster-web-<color>-<sample>。

独立 HTML 响应显式使用 UTF-8，避免组合符号和泰文被本机默认编码误解。完整应用沿用 [GPU 报告入口](./native-2d-m6.2-richtext-gpu.md#复现)；本轮只有 C++ 生产代码变化，应用脚本经 CLI 重建，完整特性引擎 JS 复用此前已验证的对应 Windows/Web 平台产物。一次误用原生引擎的 Web 运行已停止并作废，纠正平台产物后重新捕获才计入上述结果。

此节点不关闭合成粗体/斜体、真正描边、灰色 RGB 取整、RTL/sideways、阴影、其他字体/平台、性能或最终资源生命周期门禁；也没有重跑 Graphics 74 例。既有未提交 SpriteFrame.native 改动仍在工作区，不能把本轮快照认定为最终候选版本。
