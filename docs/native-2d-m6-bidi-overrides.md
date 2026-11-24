# Windows DirectWrite 双向覆盖符验收

以 Thonburi 在 12、24、36、48 px 的常规、合成粗体和斜体下绘制逻辑串，并独立绘制预期视觉串。单层覆盖的视觉顺序为 A321B；嵌套覆盖为 A653421B78，末尾 B78 同时检查弹出覆盖后恢复原方向。比较整张 256×128 RGBA 图，要求逐字节一致并有可见字形。

基于 bca00a04fd 重新构建 Windows Debug 和 Release 的 cc2d_ttf_raster。两种配置分别得到相同结果：单层 11/12、嵌套 11/12。12 px 合成粗体的单层结果有 1 个像素的 alpha 相差 1，嵌套结果有 2 个；其余尺寸和样式完全一致。严格像素门禁保持未通过。该定向结果仅覆盖原生 DirectWrite 绘制。

复验命令为 `node native/tests/2d-poc/check-bidi-overrides.cjs <cc2d_ttf_raster.exe> <新输出目录>`。本轮输出位于 native/tests/2d-poc/build 下的 m6-bidi-matrix-out-bca00a04fd 和 m6-bidi-matrix-out-release2-bca00a04fd。
