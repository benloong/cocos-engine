# RenderRoot2D 单组件回退

Windows 默认由原生 RenderRoot2D 注册和注销渲染根。设置 ccbuild 构建标志 `USE_JS_RENDER_ROOT_2D: true` 后，同一个 `cc.RenderRoot2D` 类名使用 TS 实现。TS 组件通过 Batcher2D.addScreen/removeScreen 更新列表并同步给原生 Batcher2d。Canvas 继承所选实现。省略标志并重建即可恢复原生注册。

## 复现

按照 [UIOpacity 演练](./native-2d-m6-ui-opacity-rollback.md) 准备同快照的 Windows 和 web-mobile 场景及默认引擎。额外构建回退包并运行下列命令。

```powershell
$harness = 'native/tests/2d-poc'
node "$harness/build-graphics-gpu-engine.cjs" WINDOWS graphics --js-render-root-2d
node "$harness/run-graphics-gpu-web.cjs"
foreach ($config in 'gpu-win', 'gpu-win-release-m6-mask-fresh') {
    foreach ($impl in 'js', 'native') {
        & "$harness/run-graphics-gpu-native.ps1" -Exe "$harness/build/$config/native-2d-m6-gpu.exe" -RootImplementation $impl
        if ($LASTEXITCODE) { throw "$config $impl application failed" }
        node "$harness/compare-graphics-gpu.cjs"
        if ($LASTEXITCODE) { throw "$config $impl comparison failed" }
        Copy-Item "$harness/build/graphics-gpu-comparison.json" "$harness/build/render-root-$config-$impl.json"
        $sample = Select-String -LiteralPath "$harness/build/graphics-gpu-native.log" -Pattern 'M6_ROOT_RESULT (.+)$'
        $sample.Matches[0].Groups[1].Value | Set-Content "$harness/build/render-root-$config-$impl-perf.json"
    }
}
```

演练使用同一份序列化 Prefab 夹具实例化 UITransform 和 RenderRoot2D，检查 JSB 对象身份，并在子节点的最终透明度中写入 -1。每次等待一帧后读取结果：首次启用和反复启用后均应变为 1，禁用后应保留 -1。场景另行验证根节点注册顺序、调整顺序、重复启用、销毁、双 Canvas 及持久根节点。计时针对已有 Canvas 和一个测试根，每批连续执行 256 对禁用和启用操作，预热 10 批后计时 61 批。帧更新与 GPU 渲染在计时窗口外。

## 2026-11-19 验收

四组 Windows 运行的根节点数依次为 1、3、3、2、3、2、1、3、2、3、1，与 Web 的 11 个检查点一致。每组完成 1000 次场景循环和 4998 项场景断言，各自的 85 张图像与 Web 逐字节一致。

| 每 256 对禁用和启用操作的耗时中位数 | JS 回退 | 恢复原生 |
|---|---:|---:|
| Windows Debug | 5.300 ms | 2.465 ms |
| Windows Release | 0.292 ms | 0.102 ms |

该测量覆盖组件生命周期及根注册开销。完整帧 CPU、用户项目中的历史场景和其他模块的回退仍按 M6 计划独立验收。[采样、快照与引擎哈希](./native-2d-m6-render-root-rollback.json)

2026-11-20 复测中，Windows Debug 和全新构建的 Release 各自通过原生和 TS 回退两条路径。三次帧末采样均为 1、1、-1，每次运行完成 1000 轮场景切换，88 张图像均与同快照 Web 逐字节一致。Debug ASan 的原生路径也通过了该图像矩阵。

### 根节点测试接口清理

Windows 发布绑定已移除 `Batcher2d.getRootNodeCount()`。图形夹具的全部渲染根都是场景的直接子节点。Windows 和 Web 均在绘制前标记这些节点，绘制后读取遍历写回的透明度，从而检查启停、销毁以及场景切换时实际参与遍历的根。重叠半透明图形的最终颜色用于验证绘制顺序。C++ 单元测试独立检查重复注册、注销和连续 1000 次节点销毁后的容器大小。

清理后的场景快照为 `8712eb4cb80fc6a05423272fc832ba94faaeb81a665889d7d02c4471c2e4f2e7`。Debug、Release 的原生与 TS 回退四组均通过 11 个根遍历检查点和 4998 项场景断言，每组 88 张图像均与 Web 逐字节一致。
