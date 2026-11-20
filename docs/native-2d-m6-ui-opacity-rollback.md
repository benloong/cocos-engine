# UIOpacity 单组件回退

Windows 构建默认将 `cc.UIOpacity` 映射到 `ui-opacity.jsb.ts`。向 ccbuild 的 `flags` 传入 `USE_JS_UI_OPACITY: true` 后，原有场景和脚本仍通过同一类名取得组件，启用、禁用和属性更新改由 `ui-opacity.ts` 执行。它通过 Node 的共享缓冲区写入 localOpacity，原生 Batcher2d 继续读取该值。省略此标志并重新构建即可恢复。Web 在两种取值下的完整模块映射相同。

## 复现

使用同一源码准备 graphics-gpu-project，通过 Cocos CLI 分别构建 Windows 和 web-mobile 应用。引擎构建和场景验收从仓库根目录运行。

```powershell
node native/tests/2d-poc/build-graphics-gpu-engine.cjs WINDOWS graphics
node native/tests/2d-poc/build-graphics-gpu-engine.cjs WINDOWS graphics --js-ui-opacity
node native/tests/2d-poc/build-graphics-gpu-engine.cjs HTML5 graphics
node native/tests/2d-poc/run-graphics-gpu-web.cjs
$harness = 'native/tests/2d-poc'
foreach ($config in 'gpu-win', 'gpu-win-release-m6-mask-fresh') {
    foreach ($impl in 'js', 'native') {
        & "$harness/run-graphics-gpu-native.ps1" -Exe "$harness/build/$config/native-2d-m6-gpu.exe" -OpacityImplementation $impl
        if ($LASTEXITCODE) { throw "$config $impl application failed" }
        node "$harness/compare-graphics-gpu.cjs"
        if ($LASTEXITCODE) { throw "$config $impl comparison failed" }
        Copy-Item "$harness/build/graphics-gpu-comparison.json" "$harness/build/opacity-$config-$impl.json"
        $sample = Select-String -LiteralPath "$harness/build/graphics-gpu-native.log" -Pattern 'M6_OPACITY_RESULT (.+)$'
        $sample.Matches[0].Groups[1].Value | Set-Content "$harness/build/opacity-$config-$impl-perf.json"
    }
}
```

同一应用分别部署回退包和默认包。探针在场景启动后反序列化含 `cc.UIOpacity`、`_opacity: 128` 的 Prefab 数据并实例化。它检查当前 JSB 对象身份，读回原生 Node 的实际透明度，覆盖初始值、禁用、恢复和上下界。常规图像回归包含继承透明度、静态图集、材质和场景切换。此处的透明度 Prefab 为测试夹具，未记录来自用户项目的历史 Prefab。

耗时采样在已启用的单个组件上交替写入 0 至 255。每批 8192 次赋值，预热 10 批后记录 61 批。原始耗时由应用输出到 `graphics-gpu-native.log` 的 `M6_OPACITY_RESULT` 行。该计时仅覆盖同步 setter，逐帧遍历、绘制与 GC 的 M6 KPI 仍需独立测量。

## 2026-11-19 验收

四组 Windows 运行各完成 1000 次场景循环和 4998 项场景断言，每组的 85 张图像均与同快照 Web 捕获逐字节一致。每 8192 次 setter 的耗时中位数如下。

| Windows 配置 | JS 回退 | 恢复原生 |
|---|---:|---:|
| Debug | 0.026 ms | 3.571 ms |
| Release | 0.087 ms | 0.317 ms |

回退实现写 Node 共享缓冲，默认实现每次变更调用一次 JSB setter。这两条实际赋值路径在 Release 下每批相差 0.230 ms。该差值包含 getter/setter 内部工作和跨语言开销，测试没有进一步分摊。详见[逐批采样、快照和引擎哈希](./native-2d-m6-ui-opacity-rollback.json)。

## 旧工程复验

在 `cocos-m1-test` 的隔离副本中启动原始 `m1-test.scene`。场景中的 Sprite 使用原有 SpriteFrame，旧 `M1Prefab` 的子 Sprite 复用该帧并实例化项目的内置 Sprite 材质。测试读取场景节点与 Prefab 子节点各 8×8 像素，覆盖序列化初值、独立赋值、禁用、重新启用、边界值、挂接前禁用、组件移除和资源冷重载。

修复前 Windows Debug 挂接已禁用的 `UIOpacity` 时，Prefab 子 Sprite 的绿色通道为 121，Web 为 242。JSB 现在在 `onEnable` 应用序列化透明度。修复后禁用挂接为 242，启用后为 121。Windows Debug 和 Release 各使用同一可执行文件完成原生、TS 回退、恢复原生三次运行。六次运行每次的 18 块 RGBA 与 Web 逐字节一致，恢复后引擎包哈希与初始原生相同。三端另外通过 155 张综合场景图像对照，逐图哈希与上一候选相同。[逐阶段像素、综合对照及 setter 样本](./native-2d-m6-old-ui-opacity.json)

运行 `prepare-old-ui-opacity-project.cjs [旧项目路径]` 生成测试副本。按[本机构建流程](./native-2d-build-and-acceptance.zh-CN.md)用副本内的 `build-windows.json` 和 `build-web-mobile.json` 构建旧场景资产，并用当前引擎编译 Windows 旧工程应用的 Debug 和 Release。随后从引擎根目录运行以下命令。

```powershell
$harness = 'native/tests/2d-poc'
foreach ($mode in 'default', 'fallback', 'web') {
    node "$harness/prepare-old-ui-opacity-project.cjs" "--build-$mode"
    if ($LASTEXITCODE) { throw "Engine build failed for $mode" }
}
node "$harness/run-dynamic-atlas-web.cjs" "$harness/build/old-ui-opacity-project/build/web-mobile" --old-ui-opacity
foreach ($config in 'Debug', 'Release') {
    $exe = Join-Path $oldNativeBuild "$config/cocos-m1-test.exe"
    foreach ($phase in 'native-before', 'js', 'native-restored') {
        & "$harness/run-old-ui-opacity-native.ps1" -Executable $exe -Configuration $config -Phase $phase
    }
}
node "$harness/compare-old-ui-opacity.cjs"
```

`$oldNativeBuild` 指向旧工程的 Windows 构建目录。setter 样本按每批 8192 次计时，在同一个 Prefab 实例上交替写入 127 和 128。Windows Release 的三阶段中位数为 0.411、0.095 和 0.424 ms。
