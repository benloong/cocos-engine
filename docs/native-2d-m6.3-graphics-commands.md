# M6.3 Graphics 路径命令提交对照

**接口选择。** 单次形状操作保留直接转发。对于一次 fill 前连续生成几十到数百个形状的路径，选择复用命令缓冲，在 fill 前一次提交。两者均由原生 Graphics 构建路径、三角化并产生绘制数据。批量入口目前仅编入测试程序，本节点交付接口选择与对照数据。采样没有定位精确的切换阈值。

Windows x64 Release。表中为三轮每帧提交 CPU 均值的中位数，单位 µs。计时包含 clear、计算坐标、逐调用或编码与解码、原生路径处理、fill，以及计时边界的固定 JSB 开销。

| 每帧输入 | 逐调用 | 新建缓冲 | 复用缓冲 | 逐调用 → 批量 JSB 次数 |
|---|---:|---:|---:|---:|
| 1 个 rect | 13.7 | 26.3 | 18.9 | 3 → 3 |
| 32 个 rect | 34.9 | 50.5 | 25.3 | 34 → 3 |
| 256 个 rect | 219.9 | 157.7 | 132.8 | 258 → 3 |
| 1 个闭合路径 | 24.2 | 30.2 | 26.8 | 7 → 3 |
| 32 个闭合路径 | 114.0 | 99.5 | 72.6 | 162 → 3 |
| 256 个闭合路径 | 581.7 | 341.4 | 349.1 | 1282 → 3 |

闭合路径为一次 moveTo、三次 lineTo、一次 close。每帧重新生成坐标和命令，交替平移一个像素。调用数按实际工作负载的确定调用序列计算，含每帧的 clear 和 fill。三个提交方式轮换先后顺序，每轮预热 4 帧，采集 24 帧。小样本存在波动，例如 32 个 rect 的复用缓冲在三轮中的两轮快于直接调用。[逐轮 CPU、批处理及分配数据](./native-2d-m6.3-graphics-commands.json)

**分配。** 256 个闭合路径需要 26,624 字节的 Float64 命令数据。新建缓冲每帧分配一次，复用缓冲在测试窗口前分配一次。Windows Debug 在提交线程统计 CRT 分配与重分配请求，包括在窗口内释放的内存。逐调用、新建缓冲、复用缓冲的每帧请求数分别为 3840、3845、3841；请求字节数分别为 271360、298216、271464。CRT 计数范围与 V8 堆不同，不能与缓冲容量简单相加。两条批量路径都保留了几何构建的分配成本。

**绘制。** 所有 Windows 采样都得到每帧 1 个 batch、1 次 draw、每个矩形 2 个三角形，纹理上传量为 0。256 个闭合路径的 `Batcher2d::update()` 耗时中位数为直接调用 35.7 µs、复用缓冲 35.4 µs。主要差异发生在命令提交阶段。Debug 和 Release 分别对各轮各方式做完整 RGBA 对照，六种输入又分别与 Web 的 256×256 像素逐字节相等。报告中保存了逐图哈希。

**复现。** 使用[绘制成本报告](./native-2d-m6.3-graphics-cost.md)的两个专用构建目录。重新构建计数版应用后执行以下命令。

```powershell
$tests = 'native/tests/2d-poc'
& "$tests/run-graphics-metrics.ps1" -Platform windows -Commands
& "$tests/run-graphics-metrics.ps1" -Platform windows -Commands -BinaryDir (Resolve-Path "$tests/build/m6-graphics-metrics-debug")
& "$tests/run-graphics-metrics.ps1" -Platform web -Commands
node "$tests/summarize-graphics-commands.cjs"
```
