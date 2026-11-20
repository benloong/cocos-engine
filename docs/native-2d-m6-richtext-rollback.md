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

## 42 项应用矩阵回退与恢复

以 `f100d95c7b` 构建引擎包和两种 Windows 配置。在每种配置上先运行原生实现，再部署 TS 回退包，最后恢复原生包。应用在三次启动中分别确认实现类型为 `native`、`js`、`native`，各完成 1000 轮字体生命周期。42 项布局按像素比较器的 float32 精度一致，每张 Windows RGBA 在切换前后逐字节一致。对 Chrome 的严格像素验收仍为 39/42，粗体、描边及嵌套样式三项超差。[构建和逐图哈希、采样记录](./native-2d-m6-richtext-roundtrip.json)

| 配置 | 原生 | TS 回退 | 恢复原生 |
|---|---:|---:|---:|
| Windows Debug | 20.326 ms | 91.080 ms | 19.551 ms |
| Windows Release | 13.778 ms | 71.211 ms | 14.833 ms |

计时取同一 Prefab 每批 8 次同步更新的 31 批中位数。各阶段分别启动应用，表中耗时限于该轮更新场景。
