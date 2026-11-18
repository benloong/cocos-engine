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

## 同尺寸 Label 纹理复用后的复测

`dfd1b03028` 中，普通文本和 CHAR 缓存模式的同尺寸更新均保留 GFX 纹理，字形像素发生变化；尺寸变化时重新分配。Windows Debug/Release 均运行了设备身份断言。三轮 Windows Release 混合变更帧 CPU 中位数为 6.3762 ms，上一组为 6.0933 ms，迁移前为 4.5881 ms。该提交减少了已验证的纹理重建次数，本组数据没有显示混合 CPU 改善。

每帧 JSB 为 196，堆峰值 16,949,796 字节，强制 GC 中位数 4.277 ms。迁移前与 Web 沿用三份冻结输入；新候选独立跑三轮。原始文件名为 m6-perf-dfd1b03028-1.json 至 -3.json，汇总命令为 `node native/tests/2d-poc/compare-m6-perf.cjs --candidate dfd1b03028`。[各轮与各负载数据](./native-2d-m6-performance-label.json)

## Windows 测量 Canvas 复用实验

本次 A/B 两端都是迁移后的 Windows x64 Release。对照使用 `dfd1b03028` 的运行时，实验组在 `8906b527b9` 上仅修改 Label 的两个文本测量入口。每个线程保留一个 1×1 的测量上下文，同一系统字体描述连续使用时命中。文件字体仍随本次测量释放，绘制 Canvas 和纹理上传沿用原路径。

| 变更帧主线程耗时 | 原实现（ms/帧） | 复用（ms/帧） | 配对节省中位数（ms/帧） | 改善轮数 |
|---|---:|---:|---:|---:|
| 200 个 Label，每帧变更 20 个 | 3.6273 | 3.1228 | 0.5099 | 6/6 |
| 40 个 RichText，每帧变更 4 个 | 2.2586 | 1.9105 | 0.3481 | 6/6 |
| 混合场景，每帧变更 10% | 5.3182 | 4.6220 | 0.6890 | 5/6 |

两端共独立启动 12 次，奇数轮先跑对照，偶数轮先跑复用，同一轮共用引擎 JS 和负载。各场景预热 30 帧，每个阶段采样 120 帧。表中两端分别取各轮帧中位数的中位数，节省列先逐对相减。纯 Label 场景每个变更 Label 平均节省约 25.5 µs。混合场景首轮从 5.4182 增至 9.3863 ms，计入统计，其余五轮节省 0.6320–0.9314 ms。12 次运行的五组文本、字号及斜体切换均得到相同的纹理尺寸、像素校验和及非透明像素数。[逐轮数据和构建哈希](./native-2d-m6-measure-context.json)

独立控制台微基准直接调用 Win32 Canvas，固定 `14px Arial`，交替测量 `AB` 和 `CD`。对照每次创建 1×1 Canvas、设置字体、测宽并析构，复用组在计时区外创建及设置字体，每次仍实际测宽。预热一对后交错运行八对，每组 2000 次，累计宽度均为 38000。每次调用中位数从 35.36 降至 13.57 µs，配对节省 21.13 µs，包含设备上下文、位图和字体的建立与释放。按 20 次估算约 0.423 ms。该估算与上表整帧差值的测量范围不同。混合场景 4.6220 ms 仍高于 M6 CPU 门槛 2.29405 ms。

复现微基准时，在上文的 Windows Release 性能工程添加控制台目标，链接同一 `cocos_engine` 并沿用应用目标的编译定义、包含目录及选项。运行后 CSV 每行依次给出轮次、复用标记、每次调用微秒数和累计宽度。[微基准源码](../native/tests/2d-poc/m6-canvas-measure-bench.cpp)


## Windows 纯 Sprite 合批分段

迁移前 `7e83734299` 和当前 `9e8f2a0311` 使用各自匹配的 Windows x64 Release 引擎和 JS。每次独立启动只运行空 Canvas 与 1000 个 SIMPLE Sprite，所有 Sprite 共用一张 8×8 纹理和默认材质。预热 30 帧后，稳态和每帧轮换 100 个 Sprite 颜色的变更态各测 120 帧。四对运行交替交换先后。设备计数两端每帧均为 1 次 draw call、2000 个三角形，空 Canvas 为零。

| 变更帧 CPU，ms/帧 | 迁移前 | 当前 | 配对差值中位数（当前减迁移前） |
|---|---:|---:|---:|
| 100 次颜色属性写入 | 0.0793 | 0.1388 | +0.0423 |
| JS 脏渲染器更新 | 0.0010 | 0.0015 | 0.0000 |
| Batcher2d::update | 0.1034 | 0.3983 | +0.2703 |
| Batcher2d::uploadBuffers | 0.0163 | 0.0116 | −0.0042 |
| Batcher2d::reset | 0.0003 | 0.0005 | +0.0001 |
| 合批三段合计 | 0.1205 | 0.4106 | +0.2607 |
| 含属性写入、JS 更新的合计 | 0.2112 | 0.5833 | +0.3110 |

各列分别对每轮的帧中位数取中位数，配对差值先逐对相减。四对变更帧的 update 增量介于 0.2592 与 0.3780 ms。稳态完全没有颜色写入，update 仍从 0.1212 增至 0.4532 ms。变更帧 JSB 计数从 71 增至 171，额外的 100 次调用对应颜色 setter；表内 setter 独立于合批计时。

另用当前版本运行三轮诊断，在 Sprite::prepare 与 SpriteMeshPage::append 内每 17 次调用取一次耗时，按当帧实际调用数外推。稳态和变更态每帧均各调用 1000 次。稳态的 prepare、append 估算分别为 0.175、0.240 ms，变更态为 0.216、0.209 ms。此组绝对值含采样时钟开销，不能从另一组的配对增量中扣除。[逐轮数据、计数与输入哈希](./native-2d-m6-sprite-stages.json)

当前 prepare 在干净对象的提前返回之前检查 SpriteFrame 修订、纹理及采样器身份、世界矩阵、尺寸和锚点。append 每帧将 1000 个四边形的 144,000 字节顶点复制入合批页，并重写 6000 个 16 位索引。迁移前使用共享 MeshBuffer，保留顶点槽位，按脏标记更新顶点位置和颜色，遍历时仍复制索引。两端最终绘制的批次数相同，主要差额落在绘制前的 CPU 准备和合批页组装。


## JSB 与原生 UIRendererManager 的纯 Sprite 复测

对照为 `910dac1194` 的 Windows x64 Release（运行时代码与 `9e8f2a0311` 相同）。候选加入原生 dirty 集合。原生 Sprite 的 JSB setter 直接登记颜色或几何变更，Label 登记纹理重建，Graphics 的几何写入也通知使用该几何的组件。原生组件禁用或解绑时退出待处理集合，重新启用后按保留的标记重新登记。JS 驱动的 renderer 通过单独的 manager 实例批量取出待更新项。Web 使用现有 TypeScript manager。

测试沿用独立 1000 Sprite 场景。六对新进程交替交换顺序，每个场景预热 30 帧，每种负载采样 120 帧。在候选的 720 个变更帧中，Batcher2d::update 开始时均有 100 个 dirty，结束时均为 0；720 个稳态帧开始及结束均为 0。两端每帧均绘制 1 批、2000 个三角形。集合计数读数位于 update 计时区外。

| CPU（ms/帧） | 对照 | 候选 | 配对变化中位数 | 候选更快 |
|---|---:|---:|---:|---:|
| 稳态，Batcher2d::update | 0.5073 | 0.5043 | −0.0038 | 4/6 |
| 每帧 100 个改色，Batcher2d::update | 0.4247 | 0.4203 | −0.0088 | 4/6 |
| 每帧 100 个改色，属性写入、JS 更新与合批合计 | 0.6365 | 0.6673 | +0.0265 | 1/6 |

各端分别取六轮帧中位数的中位数，配对变化先在同轮相减。改色场景没有显示稳定的 CPU 收益。颜色写入的配对中位数增加 0.0145 ms。共享纹理、父节点变换、尺寸及继承透明度仍可在组件 setter 之外变化，遍历继续检查这些依赖并按绘制顺序组装合批页。dirty 数仅反映已登记的工作。[逐轮结果及输入哈希](./native-2d-m6-renderer-manager.json)

## 原生 Sprite 按 dirty 标记准备

Windows x64 Release 对照提交为 `be93bb4458`。沿用上节的 1000 个 SIMPLE Sprite、共享纹理与默认材质，两端加载同一份 JS。六对新进程交替交换顺序，预热 30 帧，每种负载采样 120 帧。两个版本均在 `Sprite::prepare` 入口递增计数。候选在场景遍历中比较有效透明度，发现变化时登记颜色标记，随后只为有待处理标记的 Sprite 调用 prepare。父节点变换、尺寸、锚点和共享资源变更从各自的写入路径登记。合批页继续按原顺序组装。

| 场景与指标 | 对照（ms/帧） | 候选（ms/帧） | 配对差值中位数（ms/帧） | 更快的配对 |
|---|---:|---:|---:|---:|
| 静止，Batcher2d::update | 0.4356 | 0.3514 | −0.0830 | 5/6 |
| 静止，属性写入、JS 更新与合批合计 | 0.4610 | 0.3721 | −0.0832 | 5/6 |
| 每帧 100 个改色，Batcher2d::update | 0.4020 | 0.3617 | −0.0465 | 4/6 |
| 每帧 100 个改色，属性写入、JS 更新与合批合计 | 0.5901 | 0.5371 | −0.0549 | 4/6 |

每种负载、每端各检查 720 帧。静止时 prepare 从每帧 1000 次降到 0 次，每帧 100 个改色时从 1000 次降到 100 次。所有采样帧均为 1 次绘制、2000 个三角形。计时结束后另行修改父节点位置、继承透明度、共享采样器和共享帧矩形，候选均在变更帧准备 1000 个 Sprite，下一帧回到 0 次。父节点透明度降为 0 时整组跳过绘制，恢复可见后重新准备全部 Sprite。原生缓冲区测试另外检查了实际顶点位置、alpha、替换后的纹理及采样器和重算的 UV。[六轮计时、依赖检查与输入哈希](./native-2d-m6-sprite-dirty-prepare.json)

## 移除 RenderEntity 准备回调后的 Windows 纯 Sprite 对照

对照提交为 `234d8c0017`。两端使用 Windows x64 Release、相同 JS 包、同一默认材质和共享纹理。六对新进程交替交换启动顺序，每轮预热 30 帧，静止和轮换改色各采样 120 帧。manager 计时包含 TypeScript 队列和原生队列的更新。

| 场景 | CPU 指标 | 对照（ms/帧） | 候选（ms/帧） | 配对差值中位数（ms/帧） | 更快的配对 |
|---|---|---:|---:|---:|---:|
| 静止 | Batcher2d::update | 0.2870 | 0.2113 | -0.0737 | 6/6 |
| 每帧 100 个改色 | Batcher2d::update | 0.2659 | 0.1935 | -0.0712 | 6/6 |
| 静止 | 属性写入、manager 更新与合批合计 | 0.3002 | 0.2241 | -0.0742 | 6/6 |
| 每帧 100 个改色 | 属性写入、manager 更新与合批合计 | 0.4072 | 0.3235 | -0.0839 | 6/6 |

两端的 1000 个 Sprite 在全部采样帧中均为 1 次绘制、2000 个三角形。静止帧调用 Sprite::prepare 0 次，轮换改色帧调用 100 次。改变父节点透明度或从隐藏恢复可见时，对照分别调用 1000 次，候选均为 0 次。父节点平移、共享采样器或共享帧矩形变化时，两端均在变更帧准备 1000 个 Sprite，下一帧回到 0 次。原生回归另行核对了继承 alpha 在实际 Sprite 顶点及位图 Label 的全部分块末端顶点上的值。[各轮计时、计数与输入哈希](./native-2d-m6-direct-update.json)

## Windows 迁移前后纯 Sprite 的合批页耗时

Windows x64 Release 同机比较 `7e83734299` 和 `4fcdb412a0`。1000 个 SIMPLE Sprite 共享一张 8×8 纹理和默认材质。六轮覆盖迁移前、当前、当前加局部探针三个进程的六种启动顺序。每个进程预热 30 帧，静止和每帧轮换 100 个改色各采 120 帧。每帧均为 1 次绘制、2000 个三角形。下表单位为 ms/帧，update 取各进程帧中位数的六轮均值，不含 uploadBuffers 和 reset。

| CPU 指标 | 静止 | 每帧 100 个改色 |
|---|---:|---:|
| 迁移前 Batcher2d::update | 0.1171 | 0.1266 |
| 当前 Batcher2d::update | 0.2478 | 0.2318 |
| 同轮差值 | +0.1307 | +0.1052 |
| 当前 SpriteMeshPage::append 整体估计 | 0.1394 | 0.1225 |
| 当前 update 其余部分（无页内探针的总计减 append 估计） | 0.1083 | 0.1093 |
| 在带探针的同一帧内扣除 append 后的余量 | 0.1294 | 0.1274 |

两种负载都调用 append 1000 次/帧，将 144000 字节顶点数据写入页，重排 6000 个索引。另做四对交替启动的局部计时，旧版测 fillIndexBuffers 整体及其中的索引 memcpy，新版测 append 整体及其中从 vertices.insert 到索引重排结束的区间。扣除旧路径后，两端完整函数的净差为静止 +0.0877、改色 +0.0879 ms/帧。仅比较写入区间的净差为 +0.0865 和 +0.0893 ms/帧，分别相当于上述 update 差距的约 66% 和 85%。余下约 0.0442 和 0.0159 ms/帧尚未细分。

每 53 次调用分别抽 1 次测整函数、1 次测写入区间、1 次测连续读钟，扣除空读钟耗时后按实际调用数折算。主测试中，局部探针使当前 update 均值增加 0.0337 和 0.0189 ms/帧。独立抽样的写入区间估计有时高于整个函数，说明计时边界对短函数的估值有影响。占比只用于定位开销，不能作为省去页复制后的预计提速。[各轮采样、计时口径与二进制哈希](./native-2d-m6-sprite-page-profile.json)
