# M6.3 Graphics 与 Mask 绘制成本

对同一套 Windows 应用与 Web 场景分别测量创建首帧、预热 8 帧后的静止窗口和连续改动窗口。后两者各取 48 帧，每种组合运行三轮，中间一轮反转场景顺序。Graphics 的改动是清空、改色并重新构造 32 个矩形，Mask 的改动是逐帧反转遮罩。两种 Graphics 组织方式均绘制 2048 个有色像素与 64 个三角形。

| 场景 | 每帧 UI batch | 每帧设备 draw call | 每帧三角形 |
|---|---:|---:|---:|
| 空 Canvas | 0 | 0 | 0 |
| 一个 Graphics 绘制 32 个矩形 | 1 | 1 | 64 |
| 32 个 Graphics 各绘制一个矩形 | 32 | 32 | 64 |
| 矩形 Mask 和一个 Sprite | 3 | 3 | 6 |
| 椭圆 Mask 和一个 Sprite | 3 | 3 | 66 |
| Sprite stencil 和一个 Sprite | 3 | 3 | 6 |
| 两层矩形 Mask 和一个 Sprite | 5 | 5 | 10 |

在 Windows Release 上取三轮每帧均值的中位数，一个 Graphics 的批处理更新在静止帧耗时 30.1 µs，重绘帧 41.5 µs。拆成 32 个 Graphics 后分别为 111.3 µs 和 200.3 µs。矩形 Mask 与双层矩形 Mask 在反转帧分别为 102.5 µs 和 118.4 µs。该场景中，拆分组件增加了批次数和 CPU 时间，已上传的共享纹理在上述三个测量阶段均无重复上传。

批次数来自 Windows 的 `Batcher2d::_batches` 和 Web 的 `batcher2D.batches`。draw call 和三角形数在 Windows 的 GLES3 队列提交时累加，在 Web 读取设备帧计数。CPU 分别测量应用调用组件 API 的时间，以及 `Batcher2d::update()` 或 Web 对应方法的时间。后者包括遍历和形成批次，不含单独的 dirty manager、上传或 GPU 执行。浏览器计时精度会影响微秒级数据。各轮每帧均值、像素面积、运行时与产物哈希见[逐项数据](./native-2d-m6.3-graphics-cost.json)。

纹理计数使用上传区域的格式、尺寸与层数累加逻辑字节数。Windows 在 GLES3 backend 的 buffer-to-texture 调用计数，Web 在 GFX 设备的 buffer/image-to-texture 调用计数。窗口开始与结束前均读回 RenderTexture，同步渲染。先单独上传一次 32×32 RGBA8 纹理，计数必须等于 4096 字节。随后共享这张已上传的纹理构造所有场景。顶点与索引 buffer、GPU 读回、RenderTexture 分配和驱动内部流量不计入该指标。

## 复现

使用图形矩阵已经生成的 Windows data 与 Web build。在 x64 MSVC 环境配置专用应用构建目录，向原图形工程的 CMake 参数添加 `-DCMAKE_PROJECT_INCLUDE=<绝对路径>/native/tests/2d-poc/graphics-metrics.cmake`。该配置在构建目录生成四个带计数器的源码副本。Debug 和 Release 可执行文件分别放在 `build/m6-graphics-metrics-debug` 和 `build/m6-graphics-metrics-release` 下。从仓库根目录依次执行以下命令。

```powershell
$tests = 'native/tests/2d-poc'
& "$tests/run-graphics-metrics.ps1" -Platform windows
& "$tests/run-graphics-metrics.ps1" -Platform windows -BinaryDir (Resolve-Path "$tests/build/m6-graphics-metrics-debug")
& "$tests/run-graphics-metrics.ps1" -Platform web
node "$tests/summarize-graphics-metrics.cjs"
```
