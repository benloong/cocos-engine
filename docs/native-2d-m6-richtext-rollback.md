# RichText 单组件回退

Windows 默认使用原生 RichText。ccbuild 标志 `USE_JS_RICH_TEXT` 选择原有 TS RichText，段节点继续由原生 Label 和 Sprite 绘制。恢复默认标志并重建引擎包即可恢复原生 RichText。两种实现使用相同的序列化类名、TTF、图集和材质。

## 复现

用 `native/tests/2d-poc/prepare-graphics-gpu-project.cjs --richtext` 生成夹具，经 CLI 构建 Windows 和 web-mobile 工程。分别用 `build-graphics-gpu-engine.cjs WINDOWS richtext`、`HTML5 richtext` 构建默认包。再运行以下命令生成独立的 Windows 回退包。

```powershell
$d = 'native/tests/2d-poc'
node "$d/build-graphics-gpu-engine.cjs" WINDOWS richtext --js-rich-text
node "$d/run-graphics-gpu-web.cjs" --richtext
foreach ($cfg in 'Debug', 'Release') {
    $exe = "$d/build/label-coverage-gpu-$cfg/native-2d-m6-gpu.exe"
    node "$d/run-font-http-native.cjs" --exe $exe --js-rich-text
    node "$d/compare-richtext-gpu.cjs"
    node "$d/run-font-http-native.cjs" --exe $exe
    node "$d/compare-richtext-gpu.cjs"
}
```

每次比较后保存 `build/richtext-gpu-comparison.json` 和 `build/richtext-gpu-native/manifest.json`。像素比较器会为超差场景返回非零状态。旧混合场景另外使用 M5 应用，在 Resources 中部署相应引擎包后运行 `run-m5-richtext-probe.ps1 -AppExe <exe> -Implementation js` 或 `-Implementation native`。Web 对应入口为 `run-dynamic-atlas-web.cjs --bitmap`。

## 验收范围

序列化 Prefab 恢复后载入 Thonburi.ttf，实例生成粗体与普通文本两段，并在销毁后释放。计时针对同一实例，每批同步切换样式字符串 8 次，预热 10 批，再取 31 批的中位数。计时窗口不含帧提交。原生组件的内部段通过原生接口查询，TS 回退版和 Web 可用子节点的 `getComponent` 查询。

旧混合场景检查 9 个 Label 和 1 个图集 Sprite、点击命中与解绑、行尾空格和图像位置。Windows 首次测量分离的新 Label 前会通过正常节点生命周期初始化度量后端。合成斜体按未舍入的自然宽度累加段位置，到提交变换时才转为 float。

完整数据见[四次 Windows 运行及 Web 对照](./native-2d-m6-richtext-rollback.json)。该数据区分 Windows 切换实现前后的像素一致性与 Web 字形验收，保留粗体、描边和嵌套样式的已有超差结果。
