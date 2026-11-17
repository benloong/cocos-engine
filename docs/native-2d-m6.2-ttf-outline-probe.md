# M6.2 合成粗体轮廓光栅化诊断

> 2026-11-17，历史诊断节点 79301a2c4c。当时两种候选均未通过严格图像标准，未接入生产。后续增加边缘量化并接入轮廓粗体，见 [实现与仍未关闭的差异](./native-2d-m6.2-ttf-bold.md)。此处保留当时数值；当前诊断目标复用生产实现，旧重复 helper 已删除。

## 实现差异与实验

该节点生产粗体以 regular advances 做 shaping，再替换成 DirectWrite bold simulation face。核对 [Skia Windows 字体过滤](https://github.com/google/skia/blob/main/src/ports/SkTypeface_win_dw.cpp)、[fake-bold 扩张规则](https://github.com/google/skia/blob/main/src/core/SkTextFormatParams.h) 及 [路径 mask 处理](https://github.com/google/skia/blob/main/src/core/SkScalerContext.cpp) 后，确认 Web 对照对应的合成粗体需要 regular 字形轮廓的 stroke-and-fill，以及路径 mask 的横向采样和滤波；单换 bold face 不能复现。

新增两个 Windows CMake 诊断目标，EXCLUDE_FROM_ALL，不改变生产库的依赖：

- cc2d_ttf_geometry：DWrite GetGlyphRunOutline → Direct2D Widen → 与 regular 轮廓做 union → WIC 软件 mask。扩张量按字号插值，miter limit=4，不修改 shaping advances。
- cc2d_ttf_geometry_filtered：同一轮廓扩张，横向四倍采样后使用固定 FIR 系数还原灰度；系数来源于上述 Skia 路径 mask 实现，没有按捕获拟合。

两个目标均由脚本生成生产 DirectWriteFont.cpp 的诊断副本，只替换 bold mask 来源，原样复用生产的预混合、像素合成、普通字和斜体路径。源码锚点不再匹配时生成器直接失败。生产文件不会被修改；正常构建也不会自动构建这些实验目标。

## 结果与结论

新采集 Chrome Canvas 同源 Thonburi.ttf 的 12 个原始画布用例。生产及两个候选各自的 Debug/Release RGBA 逐字节一致，共 36 组；候选的普通字、斜体与生产字节相同。三个模型都只有 8/12 严格通过，粗体四例仍失败。

| 字号 | 生产最大差值 | 轮廓最大差值 | 轮廓＋滤波最大差值 | 滤波覆盖总量 / Web |
|---|---:|---:|---:|---:|
| 12 | 140 | 99 | 102 | 1.0095 |
| 24 | 192 | 138 | 102 | 1.0048 |
| 36 | 218 | 119 | 104 | 1.0033 |
| 48 | 236 | 124 | 102 | 1.0055 |

滤波明显改善覆盖总量，但少量边缘仍有较大 alpha 差异，不能以接近的面积或外观替代逐像素通过。Direct2D 软件光栅化目前不能直接作为生产替换方案；后续继续核对曲线/扩张和路径 scan conversion 的边缘覆盖，不扩大阈值。

完整像素结果、比较器退出码、生产/生成/辅助源码及二进制哈希见 [结果](./native-2d-m6.2-ttf-outline-probe-results.json)。运行器成功表示实验完成，独立比较器的失败退出码 1 被保留，不表示视觉通过。源码哈希和二进制哈希是诊断记录，不替代最终候选版本的构建新鲜度门禁。

## 所有权与复现

font face、glyph indices/offsets 只在同步回调中借用。每次 mask 调用以局部 ComOwner 持有 D2D factory、geometry/sink、WIC factory/bitmap、target/brush；像素 vector 值持有。CoInitializeEx 成功时才对称 CoUninitialize，所有局部 COM 对象先释放；RPC_E_CHANGED_MODE 时借用既有 apartment，不替调用方解除。没有 shared_ptr，也没有新增进程字体注册。

```powershell
# 在 MSVC 环境中，分别构建 Debug 与 Release 的独立探针
cmake --build native/tests/2d-poc/native/out --target cc2d_ttf_raster cc2d_ttf_geometry cc2d_ttf_geometry_filtered -j8
cmake --build native/tests/2d-poc/native/out-release2 --target cc2d_ttf_raster cc2d_ttf_geometry cc2d_ttf_geometry_filtered -j8
node native/tests/2d-poc/run-ttf-raster-web.cjs
node native/tests/2d-poc/run-ttf-geometry-probe.cjs
```

产物在 build/ttf-outline-*，汇总为 build/ttf-outline-probe-results.json。原始构建日志为 build/ttf-geometry-target-{debug,release}-build.log；两份构建均成功，脚本语法与 git diff --check 通过。本轮没有运行 ASAN、泄漏/句柄计数、其他字体/平台或性能验证。Canvas strokeText 与 Label 的八方向偏移描边仍未在此节点修改。
