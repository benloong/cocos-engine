# Label 单模块回退

Windows 默认使用原生 Label。ccbuild 的 `USE_JS_LABEL` 选择 TS Label 和原有 TTF、CHAR、BMFont 组装器，仍通过原生 RenderEntity 和 Batcher2d 提交。Label 和 Sprite 各有独立的组件与组装器覆盖规则，两种回退可以组合。Windows Release 默认功能包的 Web 组装器代码为 0 字节。

## 复现

按[构建验收流程](./native-2d-build-and-acceptance.zh-CN.md)构建 Windows Debug、Release 和 Web。先用 `prepare-graphics-gpu-project.cjs` 准备夹具并用 Cocos CLI 构建两端场景资源。

```powershell
$d = 'native/tests/2d-poc'
node "$d/build-graphics-gpu-engine.cjs" WINDOWS graphics
node "$d/build-graphics-gpu-engine.cjs" WINDOWS graphics --js-label
node "$d/build-graphics-gpu-engine.cjs" HTML5 graphics
node "$d/run-graphics-gpu-web.cjs"
foreach ($folder in 'poc-exports-gpu-Debug', 'poc-exports-gpu-Release') {
    foreach ($phase in 'native-before', 'js', 'native-restored') {
        $implementation = if ($phase -eq 'js') { 'js' } else { 'native' }
        & "$d/run-graphics-gpu-native.ps1" -Exe "$d/build/$folder/native-2d-m6-gpu.exe" -LabelImplementation $implementation
        if ($LASTEXITCODE) { throw "$folder $phase application failed" }
        node "$d/compare-graphics-gpu.cjs"
        if ($LASTEXITCODE) { throw "$folder $phase comparison failed" }
        Copy-Item "$d/build/graphics-gpu-native/manifest.json" "$d/build/label-$folder-$phase-manifest.json"
        Copy-Item "$d/build/graphics-gpu-comparison.json" "$d/build/label-$folder-$phase-comparison.json"
    }
}
```

每次运行从 Prefab 的 `cc.Label` 反序列化并实例化组件，核对实现、字串、字号、可见像素、销毁结果和实际部署的引擎包。应用矩阵同时覆盖位图字体资源、材质槽、Label 布局和 1000 轮场景切换。

Windows Debug 和 Release 各用同一二进制依次运行原生、TS 回退和恢复原生。六次运行各通过 4998 项场景断言，116 张对照图均与 Web 逐字节一致。恢复后的引擎包哈希与初始原生一致。

## 同场景更新耗时

对同一个 Prefab 实例交替设置两段文字并同步更新，每批 8 次，预热 10 批后取 31 批中位数。计时覆盖文字设置、布局更新和同步数据刷新。

| Windows 配置 | 原生 | TS 回退 | 恢复原生 |
| --- | ---: | ---: | ---: |
| Debug | 4.618 ms | 10.070 ms | 4.579 ms |
| Release | 0.656 ms | 1.010 ms | 0.654 ms |

该 Prefab 单独采样，Windows 两种配置的可见像素均为 1091 → 1029 → 1091，Web 为 1091。数值和独立的 116 张对照图分别归档。[逐配置采样、图像与构建哈希](./native-2d-m6-label-rollback.json)

## 旧工程复验

旧 cocos-m1-test 工程使用相同场景配置和原有功能列表，从已有资产复制到独立项目目录构建。同步 `fixtures/acceptance/LabelSpike.ts` 后分别部署默认包和 `USE_JS_LABEL: true` 的包，运行 `run-m3-label-probe.ps1 -AppExe <exe> -Implementation <native|js>`。探针从各自的 RenderEntity 读取实际提交的几何和纹理，检查 BMFont 原始资源、CHAR 缓存、换行和 GPU 字形。这一验收保留两种实现在离屏像素覆盖上的测量差异。

两种 Windows 配置的旧项目均通过原生、TS 回退、恢复原生三阶段。三组 Label 尺寸依次为 240×56.4、240×40 和 220×97.8，BMFont 提交和像素覆盖计数三阶段一致。四组系统字体与 CHAR 用例在 TS 回退时有覆盖差，例如 CJK 着色像素为 2679 → 1709 → 2679。恢复后的全部 7 组像素统计与初始原生一致。

## 旧版描边与阴影复验

Windows Canvas 的 `fillText` 读取 JSB 提交的阴影颜色、偏移和模糊值，使用 DirectWrite 在前景字形之前绘制阴影。Canvas 保存与恢复时同步保存这三个属性。原生 Label 已自行绘制阴影，Windows 上继续沿用显式绘制。

本机 Windows Debug、Release 各在同一二进制上执行原生、TS 回退、恢复原生。两种配置的旧版描边与阴影通过 Prefab 启用、属性转发、单独启停、销毁以及与直接接口的图像等价性。独立 Canvas 用例覆盖硬阴影、模糊、恢复和透明颜色。

原生和恢复阶段各 163 张图与 Chrome 逐字节一致。每个 TS 回退阶段有 160 张严格一致。`scene-ttf-bundle-first`、`scene-ttf-bundle-next`、`scene-ttf-bundle-cold` 各有 996 个像素超差，最大通道差为 209，字体宽度和资源生命周期断言通过。完整 Debug 原生探针在字体资产检查后超时，独立阴影探针已通过。[本机数据](./native-2d-m6-label-shadow-fallback.json)

## 捆绑 TTF 的小数尺寸

Web 的 Canvas 将小数像素尺寸截为整数，Windows 的 JSB Canvas 适配器向上取整。TS Label 在设置 Canvas 宽高时显式按照 Web 的规则取整，布局仍保留小数。旧矩阵里的 TTF 宽度 95.9765625 和高度 37.8 在改动前后均通过。

Windows Debug、Release 各在原生、TS 回退和恢复三个阶段完成 163 张 RGBA 读回，每个阶段均与 Chrome 逐字节一致。同一配置的恢复引擎哈希与初始原生一致。旧回退超差的三张捆绑 TTF 图均通过，另外 160 张的哈希维持一致。[比较与二进制记录](./native-2d-m6-label-ttf-canvas-size.json)
