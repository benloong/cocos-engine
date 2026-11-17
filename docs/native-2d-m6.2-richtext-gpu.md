# M6.2 RichText 同源字体、布局与 GPU 对照

> 原始基线：2026-11-16。后续修复已将布局一致提升到 12/12；2026-11-17 的 Windows mask/预混合修复将严格图像从 0/12 提升为 **8/12，视觉门禁仍未全部通过**，见 [最新报告](./native-2d-m6.2-ttf-preblend.md)。此前的纹理/基线定位见 [映射报告](./native-2d-m6.2-label-raster.md)。不能把字体数据加载、像素非空或资源释放单项通过当作 RichText parity。

## 范围和当前发现

独立模式复用 Graphics GPU 应用外壳及 Camera/RenderTexture/readPixels。两端使用真实 `assetManager.loadRemote<TTFFont>` 加载仓库 `tests/fixtures/Thonburi.ttf`：Windows 读取本机文件，Web 由隔离 runner 的 loopback HTTP 服务提供同一字节文件。字体 SHA256 纳入源码快照。它覆盖 downloader/factory、TTFFont 原生数据和 releaseAsset，但不是 Creator resources bundle、旧场景/Prefab 或异步 SpriteFrame 依赖的完整验收。

12 例包含普通、粗体、斜体、下划线、描边、嵌套样式、颜色、三种最大宽度对齐、多行和泰文/组合字符。每例记录实际 UITransform 尺寸、原生/JS 片段 Node 位置和 256×256 RGBA。native 每段必须在捕获时已有非零字形像素；夹具不主动调用 Label prepare 来补救 Batcher 漏准备。

夹具发现并推动修复 Label 字体失效后 RenderEntity 被禁用的黑屏，见 [运行时记录](./native-2d-m6.2-richtext-runtime.md)。该修复已提交为 `77df1d9239`，Windows Debug/Release 原生和实际 JSB、11 项 Jest 通过。修复前真实捕获时字形 opaque=0，手工 prepare 后才出现；修复后真实渲染路径自行生成字形。

本报告原始同一快照 `6ffee460c14d84c33d3e624961bf1f8bff1d2412cc3459284b77214404ba4805`：

- 两端完成 12 例捕获，字体加载和释放检查通过；native 持有 223404 字节，releaseAsset 后 released 且字节数为 0。Native 应用 stderr 为空。
- 视觉 **0/12 通过**；普通文字 native 宽度 108、Web 95.9765625。只有 wrap-left 的记录布局一致，字形像素仍不同。逐例尺寸、位置、最大通道差值和 RGBA SHA256 见 [未通过结果](./native-2d-m6.2-richtext-gpu-results.json)。
- 临时 Windows `GetTextFaceA` 诊断观察到：请求 Thonburi_LABEL，路径正确、目标 family 为 Thonburi，实际选中宋体；Web 图像为 Thonburi。诊断代码已移除。TTF name 表的 family/full name 只含 Macintosh 记录是观察到的文件特征，尚不能据此断定回退的完整原因。需要继续修复/验证平台注册、字体选择与字形路径，不能默认为已接受的平台容差。
- 比较器默认要求通道差值 ≤1，布局数值统一到 float32 表示后相等；不会因当前存在差异自动扩大阈值。文本的最终布局/字形/基线容差仍按 M6 计划逐字体制定；这个严格失败基线不是已批准的最终文本容差。

## 复现

依赖和 MSVC/Chrome 环境沿用 [Graphics GPU 步骤](./native-2d-m6.3-graphics-gpu.md#复现)。`--richtext` 使用独立 `richtext-gpu-project`、`richtext-gpu-native`、`richtext-gpu-web`，原 Graphics 模式仍为 74 图像。两种 native runner 共用默认应用的 Resources，必须顺序运行，不能同时覆盖该目录。

```powershell
$repo = (Get-Location).Path
$project = Join-Path $repo 'native/tests/2d-poc/build/richtext-gpu-project'
node native/tests/2d-poc/prepare-graphics-gpu-project.cjs --richtext
Push-Location $env:CC_CLI_ROOT
try {
    node dist/cli.js --no-interactive build --project $project --platform windows --build-config "$project/build-config.json"
} finally { Pop-Location }
node native/tests/2d-poc/prepare-graphics-gpu-project.cjs --richtext
Push-Location $env:CC_CLI_ROOT
try {
    node dist/cli.js --no-interactive build --project $project --platform web-mobile --build-config "$project/build-config-web.json"
} finally { Pop-Location }
node native/tests/2d-poc/build-graphics-gpu-engine.cjs WINDOWS richtext
node native/tests/2d-poc/build-graphics-gpu-engine.cjs HTML5 richtext
& native/tests/2d-poc/run-graphics-gpu-native.ps1 -Mode richtext
node native/tests/2d-poc/run-graphics-gpu-web.cjs --richtext
node native/tests/2d-poc/compare-richtext-gpu.cjs # 当前应返回非零，不代表通过
```

CLI 的引擎缓存曾在项目开启 rich-text 后仍未提供导出，导致 addComponent 收到 undefined；这里两端都显式构建当前引擎，使用 `HTML5`（ccbuild 常量名），不能把 CLI 平台名 `web-mobile`/`WEB_MOBILE` 当作 ccbuild 平台常量。两端选用相同的 2D features，Web 另加 gfx-webgl。

使用已构建的 `gpu-win/native-2d-m6-gpu.exe` 时，先按 Graphics 步骤构建当前 native 二进制；只替换脚本不能验证 C++ 修复。原始日志及 RGBA 位于忽略目录 `native/tests/2d-poc/build/richtext-gpu-*`。当前仅 Windows Debug 应用和 Chrome；Release GPU、复杂输入/点击与 Mask/Camera、其他字体、资源循环及平台矩阵继续待验收。

共享工具回归：同一当前源码的 Graphics/Scene 模式快照 4af809aac2ee7f4a5273e0b2477b966400486705877f321f30dc8d0d2e441300，普通 Windows Debug 与 Web 74 图像最大通道差值均为 0，1000 次 Scene/动态纹理循环通过；10 项静态检查及 RichText 夹具 TS（skipLibCheck）通过。该控制组不改变上述字体视觉失败结论。
