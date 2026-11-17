# M6.2 原始 TTF 画布差异定位

> 2026-11-17。诊断夹具完成，严格像素 0/12；没有修改生产字形参数或扩大图像阈值。

## 排除布局与纹理提交

新增 `cc2d_ttf_raster` 直接使用生产 DirectWriteFont，另由隔离的 headless Chrome Canvas 绘制同一仓库 Thonburi.ttf。两端均为 256×128 RGBA，文字 Atlas 123，x=4.5、alphabetic baseline=字号×0.87+4，白色文字与 alpha=1/255 白色预填背景。矩阵为 12/24/36/48px × 普通/粗体/斜体，共 12 例，不经过 Cocos Label 布局、Batcher、shader 或纹理采样。

Chrome 157.0.0.0 的 Canvas 测量值中，24px 普通文字宽度为 95.9765625，12px 为其一半。该矩阵原始像素已经不一致，证明现有应用对照的差异不能仅由 Cocos 的布局和 GPU 采样解释。Windows Debug/Release 的 12 份 native 原始 RGBA 字节完全相同。

普通字体扣除预填背景后的 alpha 总量比值为：

| 字号 | native / Web |
|---|---:|
| 12 | 0.655 |
| 24 | 0.786 |
| 36 | 0.844 |
| 48 | 0.879 |

这是覆盖总量诊断，不能当作布局正确、形状相同或视觉通过的证据。严格全通道差值≤1 的检查仍为 0/12。完整数值、文件哈希与浏览器字体测量见 [结果](./native-2d-m6.2-ttf-raw-results.json)。

## Grid fitting 实验与下一步

仅在忽略目录复制 DirectWriteFont.cpp，将唯一的 DWRITE_GRID_FIT_MODE_DISABLED 替换为 ENABLED，独立编译相同探针。12 例仍为 0/12，四个普通字体用例的差值/覆盖量完全不变；粗体、斜体也没有一致改善。这个实验没有改动生产文件，不能据此选择 enabled 作为修复。

查阅当日 Skia 主分支实现，DirectWrite 路径按 hinting 选择 grid fit，且灰度 mask 在条件满足时应用覆盖率预混合，见 [Skia DirectWrite 实现](https://github.com/google/skia/blob/main/src/ports/SkScalerContext_win_dw.cpp) 与 [mask gamma 实现](https://github.com/google/skia/blob/main/src/core/SkMaskGamma.cpp)。这些源码不是该 Chrome 二进制版本的精确构建证明；覆盖率预混合、逐字形亚像素定位及合成粗体/斜体是后续调查方向，尚未认定其中任何一项为全部差异的原因。不能通过逐用例拟合 gamma 或放宽阈值来宣称通过。

## 复现

先在配置好 MSVC 的环境构建原生探针：

```powershell
cmake --build native/tests/2d-poc/native/out --target cc2d_ttf_raster -j8
& native/tests/2d-poc/native/out/cc2d_ttf_raster.exe tests/fixtures/Thonburi.ttf native/tests/2d-poc/build/ttf-raster-native
node native/tests/2d-poc/run-ttf-raster-web.cjs
node native/tests/2d-poc/compare-ttf-raster.cjs
```

比较脚本当前预期退出 1，输出 `build/ttf-raster-native-comparison.json`。Release 将构建目录换成 out-release2，输出目录换成 ttf-raster-native-release，可逐字节检查同名文件。

Grid fitting 实验将生产源的单个 DISABLED 枚举替换后保存为 build/DirectWriteFont-gridfit.cpp，在 build 下使用 MSVC `/std:c++17 /EHsc /DNOMINMAX /I ../../../cocos ../test_ttf_raster.cpp DirectWriteFont-gridfit.cpp /Fe:ttf-raster-gridfit.exe /link dwrite.lib` 编译，执行时字体路径为 `../../../../tests/fixtures/Thonburi.ttf`、输出目录为 ttf-raster-gridfit；比较脚本可传入该目录作为首个参数。结果记录了实验副本哈希。

本工具仅供诊断：比较时记录的源码哈希不证明二进制新鲜度，没有 ASAN、其他平台、完整资源加载释放或 GPU 应用终态证据。最终验收仍使用完整应用的同快照门禁。
