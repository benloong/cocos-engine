# Windows DirectWrite 双向覆盖符验收

以 Thonburi 在 12、24、36、48 px 的常规、合成粗体和斜体下绘制逻辑串，并独立绘制预期视觉串。单层覆盖的视觉顺序为 A321B；嵌套覆盖为 A653421B78，末尾 B78 同时检查弹出覆盖后恢复原方向。比较整张 256×128 RGBA 图，要求逐字节一致并有可见字形。

基于 bca00a04fd 重新构建 Windows Debug 和 Release 的 cc2d_ttf_raster。两种配置分别得到相同结果：单层 11/12、嵌套 11/12。12 px 合成粗体的单层结果有 1 个像素的 alpha 相差 1，嵌套结果有 2 个；其余尺寸和样式完全一致。严格像素门禁保持未通过。该定向结果仅覆盖原生 DirectWrite 绘制。

复验命令为 `node native/tests/2d-poc/check-bidi-overrides.cjs <cc2d_ttf_raster.exe> <新输出目录>`。本轮输出位于 native/tests/2d-poc/build 下的 m6-bidi-matrix-out-bca00a04fd 和 m6-bidi-matrix-out-release2-bca00a04fd。

在 59139f97d5 上调整 Windows 合成粗体的 RTL 字形绘制顺序后，按相同命令重建并复验：Debug 和 Release 的单层覆盖分别 12/12 逐字节一致。每次合成字形后都会将 alpha 量化到字节；单层用例中改为在 RTL run 内按视觉顺序绘制即可消除该差异。嵌套覆盖仍各为 11/12，12 px 合成粗体余下 1 个像素的 alpha 相差 1；此项仍开放。产物位于 build/m6-bidi-run-order-out-59139f97d5 和 build/m6-bidi-run-order-out-release2-59139f97d5。

## 嵌套覆盖与换行复验

在 d43404c162 上修正 Windows DirectWrite 合成粗体。嵌套覆盖会把同一行分成多个字形段；相邻段的覆盖像素逐次量化为字节，段间绘制顺序会改变边缘透明度。对有双向重排的合成粗体填充，按行收集裁剪后的字形遮罩，再按段的视觉左边界稳定排序后合成。换行时提交上一行。

Windows Debug、Release 分别重新构建并运行：单层覆盖 12/12、嵌套覆盖 12/12、新增两行混合覆盖 12/12。四种字号与三种样式的 RGBA 均与显式视觉串逐字节一致；原 12 px 合成粗体差异消失。两配置的 cc2d_native_poc 均输出 native 2D PoC: PASS。独立捕获位于 build/m6-multiline-order-out-d43404c162 和 build/m6-multiline-order-out-release2-d43404c162。此项签收范围为上述 Windows DirectWrite 绘制夹具。
