# M6.1 Windows 自定义字体与 DirectWrite 生命周期

> 2026-11-17。修复实际 TTF 加载后仍使用回退字体的问题。布局记录由 1/12 提升到 9/12；严格 GPU 视觉仍为 0/12，M6 未收口。

## 问题与实现

隔离的 Windows 资源探针确认，仓库 Thonburi.ttf 在 AddFontResource、FR_PRIVATE 和 AddFontMemResourceEx 三条 GDI 路径中的注册数均为 0。默认字符集选中宋体，普通文本宽度 108；直接创建 DirectWrite 文件引用/字体 face 则成功，宽度为 95.9765625，与 Web 相同。此结论针对当前文件/Windows 环境，不推断所有 TTF 的兼容性。

Windows Canvas 对已在字体 alias 表中注册的自定义文件，现使用 DirectWriteFont：读取文件内的真实 family、建立私有 collection/text format，通过 TextLayout 完成复杂文字 shaping，再用 GlyphRunAnalysis 生成灰度覆盖并合成 RGBA。未注册的系统字体保留原 GDI 路径。这条 DirectWrite 路径不安装系统字体，也不增减全局字体资源；不再用文件名猜测自定义字体的 face。失败创建仍走原回退路径。

普通形状、粗体、斜体、Thai/组合字符共用这条路径。Canvas 合成粗体只替换 raster face，保留原始 shaping advances，避免 DirectWrite 的 bold format simulation 扩大字宽。字形 alpha 请求先裁剪到目标画布，避免为完全离屏的长 run 分配完整 texture；空裁剪不修改目标。

## 所有权

- 每个 DirectWriteFont 由 Canvas delegate 的 unique_ptr 独占。它拥有 isolated factory、loader、collection 和 format；ComOwner 每个对象拥有一份 COM 引用，最终调用 Release，没有 shared_ptr。
- loader 的 key 是 owner 内保存的完整 UTF-16 路径；enumerator 复制 key 并持有自己的 font-file 引用。销毁顺序为 format/collection → UnregisterFontCollectionLoader → loader/factory，key 存活到 factory/cache 销毁之后。此顺序遵循 [Microsoft 的 loader 与 key 生命周期要求](https://learn.microsoft.com/en-us/windows/win32/directwrite/custom-font-collections)。
- Draw 的 factory、像素缓冲区是同步借用，TextRenderer 和 run analysis 在调用返回前释放。合成粗体的文件引用在创建 face 后逐一 Release，face/analysis 由局部 owner 释放。
- glyph alpha 使用目标矩形子区域；[CreateAlphaTexture 允许请求不同于完整字形 bounds 的矩形](https://learn.microsoft.com/en-us/windows/win32/api/dwrite/nf-dwrite-idwriteglyphrunanalysis-createalphatexture)。缓冲区大小先检查再相乘；绘制到负坐标和完全离屏已有原生回归。

## 验证

Windows Debug/Release C++ 和实际 JSB 字体入口通过；7 个 Jest suite、64 项通过。新原生断言覆盖真实文件加载、字宽、Thai/组合字符、合成粗体、非预乘颜色、空白/矩形 sanity、离屏和部分裁剪、无效文件，以及 1000 次 private collection 创建/shaping/释放。最终观测：Debug GDI 对象 10→10、进程句柄 335→335；Release 10→10、328→328。这是本进程的定向资源计数，不等同于全模块无泄漏证明。

同一源码快照 `55fdad418ad051f2a6b31ddf8fc5d509a3a56e1b6a1290a8dc5f36354d6a2a9a`，普通 Debug 与 ASAN 的 12 例元数据和 RGBA 逐项相同，ASAN stderr 为 0 字节。对应 Web 对照见 [原始结果](./native-2d-m6.1-directwrite-results.json)：

- **9/12 布局记录一致**：普通、粗体、下划线、颜色、三种 wrap 对齐、多行、Unicode。
- 斜体、描边、嵌套样式的布局继续不一致。
- **严格图像仍 0/12 通过**。字体选择已修复；栅格/基线/纹理映射及效果差异仍需定位，未修改比较器阈值。

## 复现与剩余边界

构建当前 native harness 后，沿用 [字体入口](./native-2d-m6.1-font-assets.md#验证与复现) 和 [RichText GPU 命令](./native-2d-m6.2-richtext-gpu.md#复现)。GPU 结果必须重新构建 native 应用，不能只替换 JS 引擎。

`native/tests/2d-poc/native/out/cc2d_font_resource.exe <absolute-ttf-path> Thonburi` 可单独复现 GDI 三种注册与 DirectWrite 文件 face 的对照。这个诊断会对成功的临时注册、GDI font/DC 和 COM 引用配对释放。

本机日志位于忽略的 build 目录：directwrite-clip-tests.log、directwrite-resource-probe.log、directwrite-clip-normal-run.log、directwrite-clip-asan-run.log、directwrite-clip-comparison.log。审计基线增加四个 Windows Canvas/DirectWrite 支持文件的指纹，所有权静态检查也覆盖 DirectWrite 源码。

TTFFont 的原生字节所有者不变，但此平台后端仍从文件创建字体；同 alias 重载/平台注册表清理、多字体/TTC/彩色字体、旧场景/Prefab、完整异步资源管线与跨平台/Release GPU/性能矩阵仍待验收。Windows 7 的无 Factory2 兼容分支没有本机运行证据。其他平台未迁移至 DirectWrite。

Graphics/Scene 控制组同源码快照 448fba93e00225fb387f0a90183b63ddcae5fda4424574306c259f96513fe993：74 图像全通道差值 0、1000 次真实 Scene/动态纹理切换通过。该控制组不替代字体视觉验收。10 项静态审计检查通过；原有 SpriteFrame.native 工作区改动未纳入本节点，最终候选 Gate 仍未关闭。
