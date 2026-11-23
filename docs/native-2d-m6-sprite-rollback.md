# Sprite 单模块回退

Windows 默认使用原生 Sprite。ccbuild 标志 `USE_JS_SPRITE` 切换到 TS Sprite 和对应 assembler。TS Sprite 通过现有 RenderEntity 和原生 Batcher2d 提交几何，原生 Mask 用该实体作为 Sprite 模板。材质实例销毁时同步释放渲染 passes。

## 复现

按[构建验收流程](./native-2d-build-and-acceptance.zh-CN.md)准备 Windows 和 web-mobile 环境。用 `prepare-graphics-gpu-project.cjs` 生成图形夹具，经 Cocos CLI 构建两端应用资源。下列命令生成三个引擎包，采集 Web 基准，再在每个 Windows 二进制上顺序部署三个阶段。

```powershell
$d = 'native/tests/2d-poc'
node "$d/build-graphics-gpu-engine.cjs" WINDOWS graphics
node "$d/build-graphics-gpu-engine.cjs" WINDOWS graphics --js-sprite
node "$d/build-graphics-gpu-engine.cjs" HTML5 graphics
node "$d/run-graphics-gpu-web.cjs"
foreach ($folder in 'gpu-win', 'm6-system-graphics-fresh-release') {
    foreach ($phase in 'native-before', 'js', 'native-restored') {
        $implementation = if ($phase -eq 'js') { 'js' } else { 'native' }
        & "$d/run-graphics-gpu-native.ps1" -Exe "$d/build/$folder/native-2d-m6-gpu.exe" -SpriteImplementation $implementation
        if ($LASTEXITCODE) { throw "$folder $phase application failed" }
        node "$d/compare-graphics-gpu.cjs"
        if ($LASTEXITCODE) { throw "$folder $phase comparison failed" }
        Copy-Item "$d/build/graphics-gpu-native/manifest.json" "$d/build/sprite-$folder-$phase-manifest.json"
        Copy-Item "$d/build/graphics-gpu-comparison.json" "$d/build/sprite-$folder-$phase-comparison.json"
    }
}
```

应用在图集 Prefab 挂接后检查 Sprite 实现身份。每次运行覆盖普通和旋转图集帧、Sprite 各几何模式、材质槽与实例释放、Sprite Mask 模板及 1000 轮场景切换。六次 Windows 运行各 116 张图与 Web 和上一候选逐字节一致，各通过 4998 项场景断言。恢复时的引擎包哈希与该配置的初始原生包一致。默认 Windows Release 功能包的 Web assembler 保留量为 0 字节。[快照、二进制及逐图哈希](./native-2d-m6-sprite-rollback.json)

## 同场景帧耗时

同一画布包含 128 个相邻 SIMPLE Sprite，每帧交替改变位置和颜色。预热 30 帧后采集 60 帧。计时从 `BEFORE_DRAW` 中第一处修改前开始，到 `AFTER_DRAW` 结束，涵盖 setter、dirty 更新、引擎帧处理和提交。表中为同一轮的墙钟中位数。M6 的固定混合负载 KPI 在独立门禁中跟踪。

| Windows 配置 | 原生 | TS 回退 | 恢复原生 |
| --- | ---: | ---: | ---: |
| Debug | 10.069 ms | 11.670 ms | 10.706 ms |
| Release | 1.323 ms | 1.188 ms | 1.360 ms |

## 旧工程复验

在已有 cocos-m1-test 工程的同配置二进制上，用原工程的功能列表和 `USE_JS_SPRITE: true` 生成回退包。在各次启动前同步工程资源并核对实际部署包的哈希。Windows Debug、Release 的回退包均通过 M2 Sprite、M4 Mask 和动态图集禁用检查、M5 RichText。恢复原生包后，两种配置再次通过 M2 的五种 Sprite 模式。[旧工程二进制与部署包哈希](./native-2d-m6-sprite-rollback.json)
