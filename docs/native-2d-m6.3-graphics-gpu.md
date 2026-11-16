# M6.3 Graphics/Mask GPU 对照

2026-11-16。独立 Creator 夹具使用相同脚本、场景和 256×256 RenderTexture，分别运行 Web 构建与真正的 Windows native 构建。native 脚本断言 Graphics/Mask 的 native override 已生效，通过正常 Camera、Batcher、graphics shader、local UBO 和 stencil 链路绘制；不使用 CPU 栅格化结果替代 GPU readback。

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
    node dist/cli.js --no-interactive build --project $project --platform web-mobile
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

## 未关闭的门禁

本轮不替代全部平台、Release 真正应用 GPU、复杂混合 Sprite/Label/Graphics、Camera/root/排序场景矩阵、Mask radius/动态形状和资产切换、完整 subComp（Sprite 类型仍缺失）及材质 API 验收。GPU 夹具使用 direct SpriteFrame 桥接设置 native sprite mask；因此不能据此声称 Sprite subComp API 已实现。

逐 API/命令批量提交成本、JSB 调用数、CPU/分配/合批/上传量、事件几何命中和 1000 次真实资产加载卸载保持 M6.3–M6.5 待办。这里的面积 sanity 和像素一致性不构成性能证据。
