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

构建前，从 v4 同步受版本管理的验收探针（LabelSpike、M4Probe、M4ExtraProbe、RichTextProbe、BitmapGpuProbe；保留测试工程现有 `.meta` UUID）：

```powershell
cd C:\Users\wangbenlong\Works\cocos-engine-worktrees\v4
node native/tests/2d-poc/sync-acceptance-probes.cjs
```

M4 Graphics 已使用原生几何；探针以隔离的 GPU readPixels 检查 80×80 填充，不依赖旧 CPU 纹理的 getFrame/getOpaquePixels。GRAPHICS_STENCIL 使用 Mask.subComp 的真实路径；原有像素阈值保持不变。M5 在 native 下直接检查原生 Label/Sprite 段，另行记录 JS 子组件数量；不为探针创建重复 JS 渲染组件。内部节点的 JS 组件查询兼容性仍按 M6 单列验收。

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

每端必须生成 12 份 256×256 RGBA：Sprite/Mask × REPEAT/CLAMP × 原图/打包/恢复。通道容差沿用 M6 的 1；缺失、重复或旧 native 文件不得算通过。CLAMP 打包/恢复与原图字节相同；REPEAT 的跨边采样以同候选 Web 为准，全部恢复帧仍须字节相同。Web 阈值需与组件值一致，不能以材质默认 0.5 代替组件默认 0.1。两端构建先后不限，但必须是相同源码候选。

### 7.9 BitmapFont / LabelAtlas GPU 图集消费者

涉及字体图集采样时，M5 探针会先运行 BitmapGpuProbe：BitmapFont/LabelAtlas × 普通/旋转帧 × 原图/打包/恢复，共 12 份 RGBA。原有 12 份图集捕获现使用默认 CENTER/CENTER、CLAMP、64×32 内容框；另加入两类字体/普通和旋转帧各 19 组布局，共 76 份布局捕获，覆盖九种对齐组合、字号缩放、spacing、词换行、四种 overflow、行距和裁剪，并交叉带 padding 的非零帧原点、trim、offset 和旋转边界。打包纹理没有 CPU ImageAsset，必须直接提交原生字形网格，CPU 诊断构建次数为 0。另在真实 native GPU 路径提交 70000 字形、5 个 chunk，随后清空并检查引用。

```powershell
node native/tests/2d-poc/run-dynamic-atlas-web.cjs --bitmap
pwsh -NoProfile -File native/tests/2d-poc/run-m5-richtext-probe.ps1
node native/tests/2d-poc/compare-bitmap-gpu.cjs
node native/tests/2d-poc/compare-bitmap-layout.cjs
```

两端每份图像必须为 256×256 RGBA，通道容差 1；打包/恢复与本端原图必须字节相同。完成标记、字形数、实际 GPU 纹理绑定、大字形分块/清空检查也必须通过。布局对照还要求 76 组内容尺寸、actualFontSize、字形数及记录的帧状态相同（数值容差 0.0001）。M0 已加入 run-m6-bitmap-layout-parity.ps1，执行 2307 组实际 Web TextProcessing、BmfontUtils 与原生布局及四顶点位置和 UV 对照；可传 NativeExecutables 追加其他编译器的同一夹具。

## 8. 完整验收顺序

```text
0. sync-acceptance-probes.cjs
1. CLI build windows
2. tools/build-engine.cjs
3. robocopy data -> Resources
4. cmake --build ... Debug
5. run-m0-checks.ps1
6. run-m2-pixel-probe.ps1
7. run-m3-label-probe.ps1
8. run-m4-mask-probe.ps1
9. run-m4-extra-probe.ps1
10. run-m5-richtext-probe.ps1
11. run-m6-sprite-frame-tests.ps1
12. 定向 Jest
13. 涉及动态合图/Mask 的节点追加第 7.8 节原始像素对照
14. 涉及字体图集采样的节点追加第 7.9 节原始像素对照
```

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

## 10. 当前门禁结果（最近一次）

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
