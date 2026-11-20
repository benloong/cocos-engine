# M6.3 Graphics/Mask GPU 对照

2026-11-16。独立 Creator 夹具使用相同脚本、场景和 256×256 RenderTexture，分别运行 Web 构建与真正的 Windows native 构建。native 脚本断言 Graphics/Mask 的 native override 已生效，通过正常 Camera、Batcher、graphics shader、local UBO 和 stencil 链路绘制；不使用 CPU 栅格化结果替代 GPU readback。

后续夹具已扩展到 48 个捕获和 19 个命中检查，并补齐 radius/尺寸/anchor/类型切换与原生命中，见 [状态与命中报告](./native-2d-m6.4-mask-state-hit.md)。下述 40 例与对应 JSON 保留为本节点历史证据；复现命令运行当前扩展夹具。

再后续的 [RenderRoot2D 注册报告](./native-2d-m6.4-render-root-lifecycle.md)将当前夹具扩展为 58 个捕获、11 项 root 注册结果和 19 项命中检查。历史阶段 JSON 保留原始快照，当前比较器核对最新用例集合。

## 本轮修复

- 完整引擎的 deprecated 模块会将 `Mask.graphics` 替换为 `subComp` 别名。native Mask 增加 Graphics 类型的 `subComp` 入口，内部初始化直接调用私有 helper，避免依赖被替换的废弃属性。Jest 使用真实 replaceProperty 重现启动后的接口状态。
- Graphics 与 Web 的 VERTEX 模式一致，保留 fill/stroke 自身顶点 alpha，不再次乘父 UIOpacity；entity 仍保存级联 opacity 供后代使用。删除重复 alpha vector 和 prepare 时的逐顶点重写。
- native 空 Mask 不压入 stencil 层，退出时也不弹层；多 chunk Mask 只进入一次。Web 同时修复空嵌套 Mask 误弹父层：记录当前 renderer 之前的栈深，只有实际进入后才退出，排序队列模式先 flush 父级再记录深度。
- 夹具显式清空自定义路径、设置 Sprite CUSTOM 尺寸，确保两端比较相同输入。没有为通过测试放宽像素阈值。

没有新增 shared_ptr。Graphics 仍以值成员拥有几何、unique_ptr 拥有 chunks、IntrusivePtr 拥有 RenderEntity；Mask 几何来源仍使用登记/注销和同步失效的非 owning 借用。

## 覆盖与证据

40 个完整 RGBA 捕获，每个 262144 字节，逐通道容差 1。比较器核对两端 backend、相同源码/夹具 SHA256、唯一且相同的用例列表、尺寸、字节长度，并对矩形/清空/空蒙版/多分块/alphaThreshold 等加入独立覆盖面积 sanity，防止两端都未绘制时误判成功。比较时重新计算当前源码摘要，拒绝准备后又修改源码的结果。

本轮 **40/40 通过，所有通道最大差值均为 0**。源快照为 `39c8cc4aed1d7bd0fb3d37c7da6078887f29da1241e26be839500ffcd5e5be44`；[逐例结果与原始 RGBA SHA256](./native-2d-m6.3-graphics-gpu-results.json) 已入库。Debug/Release 原生 harness 与实际 JSB probe 通过；4 个定向 Jest suite 共 10 项通过，含普通/反向、排序开启/关闭的空嵌套 stencil 配对；常规 tsc 和完整 native TS 编译通过。

| 类别 | 覆盖 |
|---|---|
| 几何与变换 | 矩形、大局部坐标、非均匀缩放和旋转、3D 旋转的 local UBO、凹多边形、多子路径、曲线、ellipse、roundRect、arc、clear |
| 颜色 | 半透明重叠、父 UIOpacity 与顶点 alpha |
| 大网格 | 20000 个矩形、80000 顶点、uint16 chunk 拆分，普通 Graphics 和 Mask 分别绘制 |
| Mask | rect、ellipse/segments、自定义、inverted、嵌套 inverted、空/空 inverted、空嵌套后兄弟裁剪、source 更新、disable 前后 |
| Sprite stencil | 相同 120×100 尺寸、alphaThreshold 0.2/0.5/0.8 |
| 描边 | 3×3 lineCap/lineJoin、miterLimit=2、半透明描边 |

运行环境：Windows；native Debug GLES3 使用 PVRVFrame 10.8（host NVIDIA GeForce RTX 4080、driver 610.88），不是移动设备实测；Web Chrome 157.0.8103.78，具体 renderer/vendor 保存在结果 JSON；Node 24.18.1。

本次源快照包含工作区已有的 SpriteFrame `native` getter 改动，该文件未纳入本节点提交。它使原有“SpriteFrame 无 native 属性”测试失败，完整 Sprite API Jest 门禁未通过；不能把此 GPU 结果视为全部 M6 的同一最终候选版本验收。

## 复现

夹具位于 `native/tests/2d-poc/fixtures/graphics-gpu`，生成项目、编译产物、浏览器独立 profile、原始 RGBA 和日志均放在忽略目录 `native/tests/2d-poc/build`。要求 native/external、仓库依赖、可构建当前引擎的 cocos-cli、MSVC/Ninja、Chrome。CLI 必须在其自身目录运行，避免引擎根目录 Babel 配置改变 CLI 的模块输出。

从仓库根目录开始，设置本机路径：

```powershell
$repo = (Get-Location).Path
$cli = $env:CC_CLI_ROOT
$project = Join-Path $repo 'native/tests/2d-poc/build/graphics-gpu-project'
node native/tests/2d-poc/prepare-graphics-gpu-project.cjs
Push-Location $cli
try {
    node dist/cli.js --no-interactive build --project $project --platform windows --build-config "$project/build-config.json"
} finally { Pop-Location }
# 首次 CLI 生成 native scaffolding 后写入当前引擎的 canonical native 路径。
node native/tests/2d-poc/prepare-graphics-gpu-project.cjs
Push-Location $cli
try {
    node dist/cli.js --no-interactive build --project $project --platform web-mobile --build-config "$project/build-config-web.json"
} finally { Pop-Location }
# 显式重编译当前 native JS 引擎，避免复用 CLI 引擎缓存。
node native/tests/2d-poc/build-graphics-gpu-engine.cjs
```

在已初始化 x64 MSVC 环境的终端配置/编译真实应用：

```powershell
cmake -S native/tests/2d-poc/build/graphics-gpu-project/native/engine/win64 `
    -B native/tests/2d-poc/build/gpu-win -G Ninja -DCMAKE_BUILD_TYPE=Debug `
    "-DRES_DIR=$project/build/windows" `
    '-DCMAKE_CXX_FLAGS_DEBUG=/Z7 /Ob0 /Od /RTC1' '-DCMAKE_C_FLAGS_DEBUG=/Z7 /Ob0 /Od /RTC1'
cmake --build native/tests/2d-poc/build/gpu-win -j 8
& native/tests/2d-poc/run-graphics-gpu-native.ps1
node native/tests/2d-poc/run-graphics-gpu-web.cjs
node native/tests/2d-poc/compare-graphics-gpu.cjs
```

Web runner 默认使用系统 Chrome，也可通过 CC_GPU_CHROME 指定。它只访问本机 loopback 的测试页面，使用独立 profile，并在捕获完成后结束浏览器。native runner 复制本次 Resources、要求新的 manifest、捕获失败即报错并结束自己启动的隐藏应用。沙箱中的 Chrome 若不能启动 crashpad，需由工具对该测试进程单独申请沙箱外运行。

### Windows Release 从空目录构建

在 x64 MSVC 环境中，以正斜杠路径传入 `RES_DIR`。本机的默认 CMake 探测使用 Debug 的 `/Zi`，触发 MSVC C1902。令探测使用 Release 后即可配置。旧增量构建在启动时以 `0xC0000409` 退出，根因未定位。以下新构建用隔离缓存和标准脚本各实跑一次，每次 88 张图与 Chrome 逐字节一致，1000 次场景切换通过，两行 Arial 的自然宽度为 80.9453125。[二进制哈希和复测记录](./native-2d-m6-system-font.json)

```powershell
$project = (Resolve-Path 'native/tests/2d-poc/build/graphics-gpu-project').Path.Replace('\', '/')
$build = 'native/tests/2d-poc/build/m6-system-graphics-fresh-release'
cmake -S "$project/native/engine/win64" -B $build -G Ninja -DCMAKE_BUILD_TYPE=Release `
    -DCMAKE_TRY_COMPILE_CONFIGURATION=Release "-DRES_DIR=$project/build/windows"
cmake --build $build --target native-2d-m6-gpu --parallel 8
& native/tests/2d-poc/run-graphics-gpu-native.ps1 -Exe "$build/native-2d-m6-gpu.exe"
node native/tests/2d-poc/compare-graphics-gpu.cjs
```

## 未关闭的门禁

本轮不替代全部平台、Release 真正应用 GPU、复杂混合 Sprite/Label/Graphics、Camera/root/排序场景矩阵、Mask radius/动态形状和资产切换、完整 subComp（Sprite 类型仍缺失）及材质 API 验收。GPU 夹具使用 direct SpriteFrame 桥接设置 native sprite mask；因此不能据此声称 Sprite subComp API 已实现。

逐 API/命令批量提交成本、JSB 调用数、CPU/分配/合批/上传量、事件几何命中和 1000 次真实资产加载卸载保持 M6.3–M6.5 待办。这里的面积 sanity 和像素一致性不构成性能证据。

## Graphics 与 Mask 的 Windows 回退

`USE_JS_GRAPHICS_MASK=true` 选择 TS Graphics、Mask 和 Sprite，并使用对应的 Graphics 与 Sprite assembler。TS Mask 在宿主 Graphics 或 Sprite 提交的 RenderEntity 上设置模板状态。三者使用同一套实体提交方式，便于用同一个 Windows 二进制演练回退。设为默认值 `false` 时使用原生组件。

沿用本页的项目生成、Cocos CLI 构建和引擎覆盖流程。生成默认 Windows 包和 Web 包后，另外生成 Windows 回退包。

```powershell
node native/tests/2d-poc/build-graphics-gpu-engine.cjs WINDOWS graphics --js-graphics-mask
```

对 Windows Debug 和 Release 分别使用同一个可执行文件。依次以 `-GraphicsMaskImplementation native`、`js`、`native` 调用 `run-graphics-gpu-native.ps1`。每次保留本轮的 manifest 和原始图像，再用 `compare-graphics-gpu.cjs` 与同一份 Web 捕获比较。manifest 记录实际部署的引擎哈希、应用哈希和三种组件的实现断言。

帧计时场景每帧清空并重新提交 64 个矩形，由 80×80 的 Mask 裁剪。每次启动预热 30 帧，再记录 60 帧从 `EVENT_BEFORE_UPDATE` 到 `EVENT_AFTER_DRAW` 的耗时。该区间包含路径生成、准备和渲染提交。测试另回读裁剪像素，确认计时场景进了真实渲染。

旧工程使用相同的功能列表和设置生成默认、回退包。部署两种包时核对 `cc.js` 哈希。通过 `run-m4-mask-probe.ps1 -Implementation native|js` 和 `run-m4-extra-probe.ps1` 检查实际 Graphics 绘制、反向及椭圆 Mask、Sprite 模板、自定义 Graphics 模板和嵌套 Mask。

两种 Windows 配置各用同一个可执行文件完成三次切换。同一候选共 138 张场景图，六次 Windows 运行均与 Web 逐字节一致，22 项命中和 1000 轮场景切换全部通过。恢复后的引擎包与初始包的 SHA-256 相同。默认包裁掉了 Web assembler，回退包实际载入 TS Graphics、Mask、Sprite。

预验收暴露出两个问题。原生命中遍历没有 TS Mask 槽位，圆角外点会通过。UITransform 保留摄像机和窗口过滤，回退时实时查询 TS 祖先 Mask。随后尺寸加锚点的组合更新仍有 4902 个差异像素。JSB setter 写入原生锚点后派发 `ANCHOR_CHANGED`，重复赋值仍只产生一次事件，TS 模板也按新锚点重绘。

| Windows 配置 | 初始原生中位数 | TS 回退中位数 | 恢复原生中位数 |
| --- | ---: | ---: | ---: |
| Debug | 3.5885 ms | 3.2140 ms | 3.5405 ms |
| Release | 0.3705 ms | 0.3445 ms | 0.3195 ms |

三个运行阶段均观察到 2704 个着色像素。Web 的同场景中位数为 0.3000 ms。完整帧样本、实际二进制和构建哈希见[回退记录](./native-2d-m6-graphics-mask-rollback.json)。

旧工程的 Windows Debug、Release 也各通过默认、TS 回退和恢复三阶段。独立 Graphics、普通与反向 Mask、椭圆、Sprite 模板、自定义 Graphics 模板及嵌套 Mask 的着色覆盖保持一致。每阶段的 12 张源纹理、禁用及重置图均与对应的 Web 源纹理截图逐字节一致。默认旧工程通过 M0 与 M2–M5，Release 的六组真实 JSB 探针通过。
