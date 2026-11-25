# Native 2D：Cocos CLI 构建与验收流程

> 适用于当前 workspace：
> `C:\Users\wangbenlong\Works\cocos-engine-worktrees`
> v4 通过 `cocos-cli/packages/engine` junction 挂到测试工程。
> 本文只描述 **Windows Debug** 流程；Release/跨平台见 M6 矩阵。

## 1. 目录与前置

```text
v4/                         native 引擎源码（git 仓库）
cocos-cli/                  Cocos CLI / ccbuild
cocos-m1-test/              验收工程 + native app
cocos-m1-test/build/windows CLI 构建输出和 native 工程
```

需要：

- Node.js（cocos-cli 自带依赖）；
- Visual Studio 2022/2026 + MSVC；
- CMake 3.20+；
- PowerShell 7；
- M6 C++ 夹具需要 `g++`（MinGW）。

检查：

```powershell
node --version
cmake --version
where.exe g++
```

## 2. 设置测试工程

确认 junction：

```powershell
New-Item -ItemType Junction `
  -Path C:\Users\wangbenlong\Works\cocos-cli\packages\engine `
  -Target C:\Users\wangbenlong\Works\cocos-engine-worktrees\v4
```

`cocos-m1-test/tools/build-engine.cjs` 使用 v4 的 `@cocos/ccbuild` 和 `cc.config.json` 的 NATIVE override。

构建前，从 v4 同步受版本管理的验收探针（LabelSpike、M4Probe、M4ExtraProbe、RichTextProbe、BitmapGpuProbe、StaticAtlasProbe 和 M6StaticAtlas 资源；保留测试工程现有 `.meta` UUID）：

```powershell
cd C:\Users\wangbenlong\Works\cocos-engine-worktrees\v4
node native/tests/2d-poc/sync-acceptance-probes.cjs
```

M4 Graphics 探针通过原生几何与隔离的 GPU readPixels 检查 80×80 填充。GRAPHICS_STENCIL 使用 Mask.subComp，沿用原有像素阈值。M5 应用通过子节点位置、GPU 回读和触摸事件验证 Native RichText，独立原生测试通过 Node 的组件注册验证 Label/Sprite 段和包装对象生命周期。Windows 的应用查询返回零个内部 JS Label/Sprite，Web 返回对应组件。

## 3. CLI 构建

### Windows

```powershell
cd C:\Users\wangbenlong\Works\cocos-cli

node .\dist\cli.js --no-interactive build `
  --project C:\Users\wangbenlong\Works\cocos-engine-worktrees\cocos-m1-test `
  --platform windows
```

### Web

```powershell
node .\dist\cli.js --no-interactive build `
  --project C:\Users\wangbenlong\Works\cocos-engine-worktrees\cocos-m1-test `
  --platform web-mobile
```

### 指定启动场景（可选）

```powershell
node .\dist\cli.js --no-interactive build `
  --project C:\Users\wangbenlong\Works\cocos-engine-worktrees\cocos-m1-test `
  --platform windows `
  --build-config C:\Users\wangbenlong\Works\cocos-engine-worktrees\cocos-m1-test\m1-build-config.json
```

配置示例：

```json
{
  "platform": "windows",
  "buildPath": "project://build",
  "outputName": "windows",
  "startScene": "db://assets/scenes/m1-test.scene",
  "debug": true
}
```

## 4. 重新编译 native 2D override

CLI build 只生成 JS/资源；NATIVE override 必须用 ccbuild 重新打进 `cc.js`。

```powershell
cd C:\Users\wangbenlong\Works\cocos-engine-worktrees\v4

node C:\Users\wangbenlong\Works\cocos-engine-worktrees\cocos-m1-test\tools\build-engine.cjs
```

成功输出：

```text
CCBUILD_DONE
```

然后同步到 native 资源目录：

```powershell
$data = C:\Users\wangbenlong\Works\cocos-engine-worktrees\cocos-m1-test\build\windows\data
$res  = C:\Users\wangbenlong\Works\cocos-engine-worktrees\cocos-m1-test\build\windows\proj\Debug\Resources

robocopy $data $res /E /NFL /NDL /NJH /NJS /NP
```

缺少这一步的典型现象：

- 修改了 `*.jsb.ts`，但 app 仍是旧行为；
- 新方法不存在；
- `CCBUILD_DONE` 后 app 没变化。

## 5. 编译 native app

Windows Ninja 构建会从 MSVC 的原始 `/showIncludes` 输出提取依赖前缀。2026-11-23 发现 UTF-8 输出被旧 CMake 缓存按本机代码页解码，导致头文件依赖遗漏。旧增量构建出现 Label 透明度及 Graphics 提交错误，干净重建后相应检查通过。

已有错误前缀的构建目录需要在更新引擎后重新配置并执行一次干净构建，重新建立依赖记录。`$sourceDir` 和 `$buildDir` 分别指向对应的 CMake 源目录和 Ninja 构建目录。

```powershell
cmake -S $sourceDir -B $buildDir
cmake --build $buildDir --clean-first --parallel 8
ninja -C $buildDir -t deps
```

本机验证中，原生测试入口已记录 616 个头文件依赖，调整 `RenderEntity.h` 的修改时间可触发重编译。随后恢复了头文件时间戳。干净 Debug 原生测试和六组 JSB 探针通过。

CLI build 会生成：

```text
cocos-m1-test/build/windows/proj/cocos-m1-test.slnx
```

命令行编译（推荐）：

```powershell
cmd /c ""C:\Program Files\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvars64.bat" && `
  cmake --build C:\Users\wangbenlong\Works\cocos-engine-worktrees\cocos-m1-test\build\windows\proj `
  --config Debug -- /m:4"
```

或使用项目脚本：

```text
cocos-m1-test/build-cli.bat windows
```

编译前清代理变量，避免 MSBuild 报 `MSB6001`：

```powershell
$env:ALL_PROXY = ''
$env:all_proxy = ''
$env:HTTP_PROXY = ''
$env:http_proxy = ''
$env:HTTPS_PROXY = ''
$env:https_proxy = ''
$env:NO_PROXY = ''
$env:no_proxy = ''
```

产物：

```text
cocos-m1-test/build/windows/proj/Debug/cocos-m1-test.exe
```

## 6. 运行 native app

```powershell
$exe = C:\Users\wangbenlong\Works\cocos-engine-worktrees\cocos-m1-test\build\windows\proj\Debug\cocos-m1-test.exe

Start-Process $exe -WorkingDirectory (Split-Path $exe)
```

## 7. 验收命令

### 7.1 总门禁

```powershell
$env:CC_M2_APP_EXE = '...\Debug\cocos-m1-test.exe'

pwsh -NoProfile -File v4\native\tests\2d-poc\run-m0-checks.ps1
```

覆盖：

- C++ PoC；
- M2 五种 Sprite 模式；
- M3 Label；
- M4 Mask/Graphics；
- Jest 套件。

M0 在 native PoC 可执行文件存在时还执行 run-native-log-visibility-tests.ps1：安静子进程的日志调用返回后，必须在退出前从重定向 stdout 读到 Kernel/Script 标记；ready/release 与结果保存在 build/log-visibility。

### 7.2 M2 像素

```powershell
pwsh -NoProfile -File v4\native\tests\2d-poc\run-m2-pixel-probe.ps1
```

### 7.3 M3 Label

```powershell
pwsh -NoProfile -File v4\native\tests\2d-poc\run-m3-label-probe.ps1
```

### 7.4 M4 Mask / Graphics

M4 探针默认启动预算为 60 秒，可用 `-TimeoutSeconds` 指定；该预算覆盖图形初始化和场景内 10/16 秒的延时阶段。像素及几何断言不变。

```powershell
pwsh -NoProfile -File v4\native\tests\2d-poc\run-m4-mask-probe.ps1
pwsh -NoProfile -File v4\native\tests\2d-poc\run-m4-extra-probe.ps1
```

### 7.5 M5 RichText

```powershell
pwsh -NoProfile -File v4\native\tests\2d-poc\run-m5-richtext-probe.ps1
```

M6 内部段查询契约已在 Windows Debug、Release 与 Web 验证。宿主节点均可通过 getComponent(RichText) 查询。Windows 上，逐子节点 getComponent 与宿主 getComponentsInChildren 均查到 0 个 JS Label/Sprite，原生段 API 查到 9 个 Label、1 个 Sprite。两种 Windows 构建实测内容尺寸 300×104.32，着色像素 8725。Web 通过 run-dynamic-atlas-web.cjs --bitmap 在同一夹具验证两种 JS 查询均查到 9 个 Label、1 个 Sprite。

M5 默认预算保持 45 秒，可用 -TimeoutSeconds 指定；每次 stdout/stderr 和 JSON 持久保存在 native/tests/2d-poc/build/m5-probe-runs，可用 -LogDirectory 指定。报告包含实际 app SHA256、单调/墙钟采样、CPU、退出码与阶段时间线。killedForCleanup 仅表示工具善后，不是应用自然退出码。

### 7.6 M6.1 SpriteFrame 数据/UV

```powershell
pwsh -NoProfile -File v4\native\tests\2d-poc\run-m6-sprite-frame-tests.ps1
```

该脚本：

1. 用 `g++` 编译 `test_sprite_frame_data.cpp`；
2. 生成 `build/sprite-frame-uv.json`；
3. 在 v4 目录下运行 Jest UV parity。

Jest 必须从 v4 运行，否则会报：

```text
Could not find a config file
```

### 7.7 定向 Jest

```powershell
cd v4

node node_modules/jest/bin/jest.js --runInBand `
  tests/ui/native-2d-m2-sprite-frame-shell.test.ts `
  tests/ui/native-2d-m2-sprite-shell.test.ts `
  tests/ui/native-2d-m3-label-shell.test.ts `
  tests/ui/native-2d-m4-mask-shell.test.ts `
  tests/assets/native-sprite-atlas.test.ts `
  tests/ui/sprite-frame.test.ts
```

### 7.8 动态合图 Web/native 原始像素

涉及 SpriteFrame 合图、动态图集或 Mask 时，在同一候选上构建第 3 节 Web 工程，并收集/比较两端产物：

```powershell
# Web 工程已从 cocos-cli 构建为 cocos-m1-test/build/web-mobile
cd C:\Users\wangbenlong\Works\cocos-engine-worktrees\v4
node native/tests/2d-poc/run-dynamic-atlas-web.cjs
pwsh -NoProfile -File native/tests/2d-poc/run-m4-mask-probe.ps1
node native/tests/2d-poc/compare-dynamic-atlas.cjs
```

Web 生成 12 份 256×256 RGBA，覆盖 Sprite/Mask × REPEAT/CLAMP × 原图/打包/恢复。CLAMP 打包/恢复与原图字节相同，REPEAT 的恢复帧与原图字节相同。Web 阈值使用组件的默认值 0.1。Web 必须记录 `M6_ATLAS_FALLBACK_PASS`、`M6_ATLAS_LIFECYCLE_PASS` 和 `M6_ATLAS_AUTOMATIC_PASS`，覆盖拒绝来源、满页复用、同源帧生命周期及组件激活、换资源和恢复。

JSB + Native 暂停运行时动态图集。Windows Debug 必须记录 `M6_ATLAS_NATIVE_DISABLED_PASS`。显式设置单例和独立管理器的 enabled、插入和打包应保持源纹理、UV 和零图集页。原生侧生成原图、尝试启用后、重置后三个状态的 12 份 RGBA，全部与同候选的 Web 原图比较，通道容差 1。原生同组图像须逐字节一致。清除旧的预期原生捕获后再运行，不接受缺失或重复数据。仍须运行 `node node_modules/jest/bin/jest.js --runInBand tests/ui/auto-atlas.test.ts`。

Windows Debug 与 Web 均须记录 `M6_STATIC_ATLAS_PASS`。M4 先加载包含旧式 TexturePacker 图集引用的真实 Prefab，再显式加载同一 SpriteAtlas，检查依赖身份、旋转和裁剪数据、两个实例独立换帧、红绿 GPU 采样、Prefab 释放后独立持有的图集仍可访问，以及最终依赖移出缓存。该流程重复三次。Windows Debug 还须在保留图集 JS wrapper 和旧字典时验证帧末原生帧表为空，旧字典的迟到写入不能恢复条目。保留的 SpriteFrame wrapper 应在帧末归还纹理、清空原图和 UV，公开纹理赋值和迟到依赖回填均须保持空纹理。

#### 静态图集资源压力

在同一 Windows Debug 和 Web 构建上，另用千轮模式运行真实资源循环。常规场景门禁和压力模式均须通过，压力运行器依次启动。

```powershell
pwsh -NoProfile -File native/tests/2d-poc/run-m6-static-atlas-stress.ps1
node native/tests/2d-poc/run-dynamic-atlas-web.cjs --static-atlas-stress
```

每轮从资源路径加载 plist 编译资产与 Prefab、实例化两个 Sprite、实际提交两种原图帧、销毁实例并归还资源。每端要求 5000 个资产引用和缓存断言、22 个 GPU 中心像素断言以及 11 个 GC 采样。Windows 记录 V8 wrapper 存活、进程私有字节和工作集；Web 记录 Chrome JS 堆与 wrapper 存活。Windows 进程私有字节同时包含脚本堆、原生分配和其他进程占用。两端在各自的 build/static-atlas-stress-* 目录写入 JSON 和完整原始日志。

#### Web 堆增长诊断

同一压力场景可在第 100 和 1000 轮的采样标记后立即取 Chrome 堆快照，并按对象类型和名称比较自身字节变化。第二次运行关闭 V8 的 TurboFan 和 Maglev 优化编译器，用于区分编译代码增长与资产引用累积。两种运行写到不同目录。

```powershell
node native/tests/2d-poc/run-dynamic-atlas-web.cjs --static-atlas-stress --heap-snapshots
node native/tests/2d-poc/compare-static-atlas-heap.cjs
node native/tests/2d-poc/run-dynamic-atlas-web.cjs --static-atlas-stress --heap-snapshots --no-optimizing-jit
node native/tests/2d-poc/compare-static-atlas-heap.cjs native/tests/2d-poc/build/static-atlas-heap-no-opt
```

快照自身字节与时点采样的 Chrome JS 堆是两套指标。分析时同时检查资产对象数量、V8 编译代码和元数据，以及其余对象的增量和持有者。

### 7.9 BitmapFont / LabelAtlas GPU 图集消费者

M5 探针先运行 BitmapGpuProbe。Web 采集 BitmapFont/LabelAtlas × 普通/旋转帧 × 原图/打包/恢复，Windows Debug 和 Release 采集原图/尝试启用后/重置后。各端有 12 份固定 CENTER/CENTER、CLAMP、64×32 内容框的 RGBA，另有 80 份布局捕获，覆盖九种对齐组合、字号缩放、spacing、词换行、四种 overflow、行距、裁剪，以及带 padding 的非零帧原点、trim、offset 和旋转。Windows 直接提交原生字形网格并检查实际源纹理绑定，CPU 诊断构建次数须为 0。70000 字形须分为 5 个 chunk，随后清空并检查引用。

```powershell
node native/tests/2d-poc/run-dynamic-atlas-web.cjs --bitmap
if ($LASTEXITCODE) { throw 'Web 采集失败' }
$project = (Resolve-Path ../cocos-m1-test).Path
foreach ($config in 'Debug', 'Release') {
    pwsh -NoProfile -File native/tests/2d-poc/run-m5-richtext-probe.ps1 -AppExe "$project/build/windows/proj/$config/cocos-m1-test.exe"
    if ($LASTEXITCODE) { throw "$config 采集失败" }
    node native/tests/2d-poc/compare-bitmap-gpu.cjs $project $config
    if ($LASTEXITCODE) { throw "$config 图集像素对照失败" }
    node native/tests/2d-poc/compare-bitmap-layout.cjs $project $config
    if ($LASTEXITCODE) { throw "$config 布局对照失败" }
}
```

每份图像必须为 256×256 RGBA。Web 打包/恢复与 Web 原图逐字节相同，Windows 各配置的三个状态也须逐字节相同。与 Web 对照的通道容差为 1。应用清空并恢复 GPU 源纹理，确认位图字体随源纹理变化。Windows 还读取 70000 字形文本的末尾，并确认清空文本后字形消失。比较器从所选配置的 `m6-bitmap-captures` 目录读取 RGBA 和 `layout-metrics.json`，核对 80 组内容尺寸、actualFontSize 和记录的帧状态，数值容差为 0.0001。M0 另运行 `run-m6-bitmap-layout-parity.ps1`，对照实际 Web TextProcessing、BmfontUtils 与原生字形布局、四顶点位置和 UV。独立 C++ 测试核对字形数、五个提交分块、清空后的资源释放和 CHAR 纹理复用。

## 8. 完整验收顺序

```text
0. sync-acceptance-probes.cjs
1. CLI build windows
2. tools/build-engine.cjs
3. robocopy data -> Resources
4. cmake --build ... Debug 和 Release，逐文件核对导出和部署的 Resources
5. run-m0-checks.ps1
6. run-m2-pixel-probe.ps1
7. run-m3-label-probe.ps1
8. run-m4-mask-probe.ps1
9. run-m4-extra-probe.ps1
10. run-m5-richtext-probe.ps1 -RequireNormalExit -TimeoutSeconds 120（两个配置）
11. run-m6-sprite-frame-tests.ps1
12. 定向 Jest
13. 涉及动态合图/Mask 的节点追加第 7.8 节原始像素对照
14. 涉及字体图集采样的节点追加第 7.9 节原始像素对照
15. 两个配置各执行 run-m1-m5-public-api.ps1，保留 checks.json
16. run-m2-perf.ps1 使用 Release PoC，对照当前源码的 Jest 基准，CPU 提升至少 30%
```

步骤 6–10 在每个配置的新资源副本上分别执行。M5 在夹具恢复节点和相机、调用 `rt.destroy()` 后记录一次 `M5_EXIT_REQUESTED`，并在启动预算内自然退出 0。记录强制结束的轮次为失败。发布包内没有运行器创建的退出标记时，测试场景保留正常的交互生命周期。

### 改动后的复验门槛

| 改动 | 同一工作树须补跑的检查 |
|---|---|
| 组件、原生 C++、JSB、生成绑定、override 或构建选择 | 重新从 cocos-cli 导出测试工程、构建 override、同步资源并编译 Windows Debug/Release。保留输入和部署哈希，重新执行完整门禁。 |
| 现行公开接口的声明、默认值、转发或生命周期 | 用 `npm run build:declaration` 刷新声明，运行器从源码和声明重新生成公开成员清单。在真实组件上加入能在修复前失败的行为断言，覆盖默认创建、加载前后修改及必要的对照。兼容接口与已弃用接口排除。 |
| 命中、渲染、文本或资源行为 | 命中分别断言默认参数、实际输入窗口、错误窗口及外点。渲染与文本按受影响场景比对像素、布局及事件。调整基准或容差时记录契约变更、旧值、新值与依据。 |
| 应用夹具、脚本或基准工具 | 应用夹具从源文件同步后重新打包，双配置验证信号、产物、超时及退出码。测试工具只采集当前源码的用例，并检查子进程退出码。前一轮失败保留在记录中。 |

新的失败用例进入后续门禁，未受影响的原有断言和预算继续生效。原文档含 Web 对照的命令同时记录原始结果和 Windows JSB/Native 范围内的结果；跨端差异应保留用例编号、输入及两侧实测值。

全部通过后再提交：

```powershell
git -C v4 status
git -C v4 add ...
git -C v4 commit
```

## 9. 常见问题

### CLI 工作目录与缺失脚本组件

CLI 命令必须从第 3 节的 cocos-cli 目录执行。从引擎目录运行曾使测试工程的编辑器脚本缓存混入 CommonJS `exports`，出现 `ReferenceError: exports is not defined`。之后 CLI 即使显示 Build completed，也可能记录 `Missing class`，并把场景中的 M1Test 编译为 null；此时应用不会运行验收探针，不能判定构建验收通过。

先核对构建日志中的脚本加载异常与场景组件 UUID。确认是该问题后，可将该测试工程自身的 `temp/programming/packer-driver/targets` 可逆移到同目录备份，再从 cocos-cli 重建。不得改写源场景或删除缺失组件来绕过检查。重建后确认生成场景保留 M1Test 类型，再执行 override、资源同步、native 编译和完整门禁。

### LNK1163 / COMDAT

生成绑定或头文件大幅变化后增量链接失败：

```powershell
Remove-Item build\windows\proj\cocos_engine.dir\Debug\jsb_2d_auto.obj
Remove-Item build\windows\proj\Debug\cocos_engine.lib
```

再重新编译；必要时 `--clean-first`。

### C1902 PDB 管理器不匹配

- 确认没有多个 cl.exe/MSBuild 同时写同一 PDB；
- 关闭残留 `MSBuild.exe`；
- 清理 `proj/Debug/*.pdb` 后重编。

### MSB6001 代理错误

清空第 5 节的 `*_PROXY` 变量。

### 改了 jsb 不生效

检查：

```text
build/windows/data/src/cocos-js/cc.js
```

搜索新增日志/方法；没有则重跑 `build-engine.cjs`。

### CLI build 后 native 场景空

- 检查 `build/windows/data/src/settings.json` 的 `launchScene`；
- 检查 `Resources/src/settings.json` 是否同步；
- 不要手改 `application.js`。

## 10. 历次门禁结果

2026-11-25 从 cocos-cli 重打的 M0–M5 结果见[本轮签收记录](./native-2d-m6-gate.md#2026-11-25-cli-新包整体验收)。以下记录对应此前各次验收。

```text
M2 pixel probe: PASS
M3 Label probe: PASS
M0 checks passed
M5 RichText: children=10, labels=9, sprites=1, colored=8725
M6.1 UV parity: PASS
总门禁末尾 Jest: 8 suites / 33 tests passed
定向 Jest: 6 suites / 32 tests passed
```

探针更新后的 Windows Debug 定向结果：M4 Graphics GPU=6400、GRAPHICS_STENCIL=1600、nested Mask=3600；M5 原生段=10、Label=9、Sprite=1、colored=8725，样式与 hit/miss 通过。该功能验收不替代 M6 全平台、完整 API、长期内存、性能或严格文字像素门禁；RichText 严格 GPU 对照仍为 9/12，继续按 M6 计划跟踪。

当前候选已修复 Win32 重定向 stdout 缓冲完成标记的问题：确定性 red/green 与 M0 新增可见性回归通过，完整串行文档门禁一次通过，同一 app 连续 3 次 M5 在原 45 秒预算内无重试通过。12/12 Web/native RGBA SHA256 仍相同，最大通道差值 0。旧两次缺失没有完整资料，不能逐例倒推根因；完整 M6 长期稳定性仍未收口，见 [观测报告](./native-2d-m6.4-log-observability.md)。

字体 GPU 消费者节点也已完成同一候选的完整串行验收：M0、M2–M5、UV 与定向 Jest 全通过；BitmapFont/LabelAtlas 的 12/12 RGBA 和 Sprite/Mask 的 12/12 RGBA 最大通道差值均为 0，70000 字形/5 块的 GPU 提交及清空通过。仅覆盖固定 TOP/LEFT 字体采样条件，默认 CENTER/CENTER 等完整布局继续待办，见[报告与边界](./native-2d-m6.1-bitmap-gpu.md)。

最新 BMFont 布局候选已完成完整串行验收：2307 组 g++/MSVC 实际 Web 数值对照通过；含 kerning 的 76 组布局、12 组默认居中字体合图、12 组 Sprite/Mask 图像全部字节一致，M5 保持 45 秒预算。M3 探针现固定字号/源配置，检查精确尺寸与字形提交；不再用旧 CPU 纹理宽度阈值代替 kerning GPU 验收，见[布局报告](./native-2d-m6.1-bitmap-layout.md)。

配置源字号验收已纳入同一字体矩阵：公共 fontSize=64，fntConfig.fontSize=16/32/8；尺寸、actualFontSize、字形数及两个独立字号字段都须一致。最新候选完整串行门禁和 100 组 RGBA 比较通过，非法/清空/非正源字号由原生回归覆盖，见[源字号报告](./native-2d-m6.1-bitmap-source-size.md)。

JSB + Native 暂停动态图集的候选已通过完整文档门禁。Windows Debug 记录了禁用标记，Web 保留自动合图、回退和生命周期标记。12 组 Sprite/Mask、12 组位图字体源纹理及 76 组字体布局的最大通道差值均为 0。M5 用时 40.12 秒，见[验收记录](./native-2d-m6.1-atlas-automatic.md#jsb--native-暂停运行时合图)。
