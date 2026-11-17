# M6.2 RichText 斜体、描边与嵌套样式尺寸

> 2026-11-17：12/12 布局记录一致；严格像素仍 0/12，通过布局不代表字体视觉门禁关闭。

## 修复

Web TTF 的自动尺寸会在 glyph advance 外预留 `fontSize * tan(12°)` 的斜体宽度，并把描边宽度各加到四边。native 之前只测量字形本身，导致 italic、outline 和含 italic 的 nested 三例不一致。

Label 现统一计算 native 样式扩展：测量和 Overflow.NONE 的实际 content size 都包含该范围，绘制起点预留描边边距。移除样式会清除扩展。该路径用于普通 TTF/Bitmap 缓存的文本，原有 BitmapFont 资产和 CHAR 字形缓存路径保持原契约；其他 overflow 的完整效果/裁剪仍须单独验收。

RichText 的原生布局本来使用 double。新增仅 C++ 内部可见的精确测量入口，保留样式扩展的小数到片段定位结束，避免居中/嵌套计算在逐段转 float 后产生取消误差；Label 既有公开 Size 接口仍返回 float。没有新增 JS 状态或每帧 JSB 调用，也没有修改布局比较器的 float32 归一化规则或像素阈值。

同时修复 Overflow.NONE + wrap 时把当前 UI 宽度当作固定下限的问题：自动尺寸使用文本本身，不再在反复修改样式时累计描边宽度；缩短字符串也会收缩。固定 overflow 继续使用其原有尺寸边界。

## 证据

- 新原生测试先复现三个失败：斜体扩展缺少 5.101357474（24px）、描边水平/垂直均缺少 4（2px 每边）。修复后补测实际 Label 渲染尺寸与测量一致、样式移除、连续三次描边开关不累计宽度，以及启用 wrap 后自动宽度收缩。
- Windows Debug/Release 完整 native harness 与实际 RichText JSB 探针通过，3 个 Jest suite、11 项通过；10 项静态检查通过。方法为 private，未新增 SWIG/JS API，实际绑定重新生成并编译通过。
- 同一快照 `f17805f789a421152050b259cea9170d4e39745b86cb8350553a168839c69d21`，普通 Debug/ASAN 与 Web 的 **12/12 布局记录一致**。包括普通、粗体、斜体、下划线、描边、嵌套、颜色、三种换行对齐、多行和 Unicode，见 [逐例结果](./native-2d-m6.2-richtext-style-results.json)。
- 普通 Debug 与 ASAN 的元数据和 RGBA 逐项相同，ASAN stderr 0 字节。严格图像 **仍为 0/12**；当前字体栅格、基线、纹理尺寸/映射及效果差异继续待处理，没有用布局一致替代视觉验收。

复现沿用 [RichText GPU 步骤](./native-2d-m6.2-richtext-gpu.md#复现)，必须重编译当前 native 应用。原始本机日志为忽略目录中的 `label-style-before.log`、`label-style-richtext-tests.log`、`label-style-static-tests.log`、`label-style-comparison.log`、`label-style-asan-run.log`。旧工作区 SpriteFrame.native 改动仍未纳入节点，最终同一候选版本 Gate 保持未关闭。
