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

### 7.2 M2 像素

```powershell
pwsh -NoProfile -File v4\native\tests\2d-poc\run-m2-pixel-probe.ps1
```

### 7.3 M3 Label

```powershell
pwsh -NoProfile -File v4\native\tests\2d-poc\run-m3-label-probe.ps1
```

### 7.4 M4 Mask / Graphics

```powershell
pwsh -NoProfile -File v4\native\tests\2d-poc\run-m4-mask-probe.ps1
pwsh -NoProfile -File v4\native\tests\2d-poc\run-m4-extra-probe.ps1
```

### 7.5 M5 RichText

```powershell
pwsh -NoProfile -File v4\native\tests\2d-poc\run-m5-richtext-probe.ps1
```

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

## 8. 完整验收顺序

```text
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
```

全部通过后再提交：

```powershell
git -C v4 status
git -C v4 add ...
git -C v4 commit
```

## 9. 常见问题

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
M5 RichText: children=10, labels=9, sprites=1, colored=8337
M6.1 UV parity: PASS
Jest: 8 suites / 24 tests passed
```
