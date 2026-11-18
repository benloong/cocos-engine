# Windows 和 Web 的 M6 性能对照

迁移前取总计划提交 7e83734299，候选取 7045a76a35。硬件为 Core i7-13700KF 和 GeForce RTX 4080，Windows 显卡驱动 32.0.16.1088，Chrome 157.0.8103.78。Windows 两端均使用 x64 MSVC Release，引擎 JS 的 DEBUG 为 false。[三轮逐场景数据与原始文件哈希](./native-2d-m6-performance.json)

每个后端在一次启动中依次运行空 Canvas、1000 Sprite、200 Label、50 Mask、40 RichText、以上全部组件混合。每个场景预热 30 帧，分别采集稳态与变更态各 120 个实际 END_FRAME。变更态每帧轮换 10% 的对象，切换精灵颜色、文本、遮罩反转或富文本样式。三轮各自独立启动应用，按 before/after/web、web/before/after、after/web/before 顺序运行。

Windows 计时为属性写入、JS 脏渲染器更新、C++ Batcher2d 的 update、uploadBuffers、reset 的主线程耗时之和。Web 对应采集 JS Batcher。JSB 记录进入 V8 SE 包装器的次数，包含帧调度及测量开销，空 Canvas 同时作为对照。每帧读取 JS 堆，按窗口取峰值。GC 单列每个窗口结束时的强制收集耗时。每轮的 CPU 和调用次数取帧中位数，三轮取中位数。Chrome 的计时器精度会将极短的阶段记为零。

混合变更场景从 4.5881 ms 增至 7.8115 ms，回退 70.3%。JSB 由每帧 876 次降至 196 次，下降 77.6%。JS 堆峰值由 29,851,076 B 降至 16,938,372 B，下降 43.3%。强制 GC 由 7.943 ms 降至 4.206 ms。CPU 门禁失败。1000 Sprite 变更场景从 0.3465 ms 增至 1.8111 ms；该场景的稳态耗时也上升，需处理原生合批和每帧准备成本。

## 复现

在 native/tests/2d-poc/build 下准备名为 perf-before 与 perf-after 的独立 Git worktree，分别检出上文版本，为两者配置与当前工程相同的 node_modules、native/external。先按 Graphics GPU 验收步骤生成 graphics-gpu-project 及其 Windows 和 Web 产物。prepare-m6-perf.cjs 仅在两份性能 worktree 中插入相同测量点。源码路径、二进制和运行结果均保存在本地 build 目录。

从仓库目录对 before 和 after 分别运行下列命令。CMake 使用 Visual Studio x64 开发者环境。

```powershell
$poc = (Resolve-Path native/tests/2d-poc).Path
node "$poc/prepare-m6-perf.cjs" $key WINDOWS
$project = "$poc/build/perf-project-$key".Replace('\','/')
cmake -S "$project/native/engine/win64" -B "$poc/build/perf-bin-$key" -G Ninja -DCMAKE_BUILD_TYPE=Release "-DRES_DIR=$project/build/windows"
cmake --build "$poc/build/perf-bin-$key" -j 10
```

运行 node native/tests/2d-poc/prepare-m6-perf.cjs after HTML5 生成 Web 对照。使用 run-m6-perf.ps1 -Target before、after 或 web 启动。按上述顺序将 Windows 的 m6-perf-before-results.json、m6-perf-after-results.json 和 Web 的 perf-web/manifest.json 复制到 build/m6-perf-formal-轮次-目标.json，最后运行 node native/tests/2d-poc/compare-m6-perf.cjs。

## 原生 Sprite 合批后的三轮复测

Windows Release 候选 `cfe140f062` 使用相同的测量点、预热及采样帧数。对照沿用首轮实验的三份迁移前 Windows 和三份 Web 原始记录。新候选的三轮运行另行采集，未与对照交错运行。每轮输入的 SHA256 和各负载的逐轮数据见[复测结果](./native-2d-m6-performance-pages.json)。

| 混合负载，10% 变更/帧 | 迁移前 | 首个候选 | 合批后 |
|---|---:|---:|---:|
| 准备、更新及合批 CPU（ms） | 4.5881 | 7.8115 | 6.0933 |
| 每帧 JSB 调用 | 876 | 196 | 196 |
| JS 堆峰值（字节） | 29,851,076 | 16,938,372 | 16,951,268 |
| 强制 GC（ms） | 7.943 | 4.206 | 3.967 |

相对迁移前，CPU 时间增加 32.81%，JSB 调用减少 77.63%，JS 堆峰值减少 43.21%。CPU 达标上限为 2.29405 ms。单独测试 1000 个 Sprite 的变更帧，CPU 从首个候选的 1.8111 ms 降至 0.4702 ms，迁移前为 0.3465 ms。

复现时将 CC_M6_PERF_CHECKOUT 指向 build/perf-after-cfe140f062，使用上文 after 构建和运行流程，将三轮结果依次保存为 build/m6-perf-pages-1.json 至 build/m6-perf-pages-3.json，再运行 `node native/tests/2d-poc/compare-m6-perf.cjs --candidate cfe140f062`。
