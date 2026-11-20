# M6.1 SpriteFrame 数据与算法下沉

> 更新：2026-11-16。SpriteFrame 基础数据、UV、reset/clone 和原生消费者联动已实现，并有 Windows 定向验证。M6.1 整体仍未收口：SpriteAtlas 表同步、字体资产、动态合图及真实资源/场景回归继续跟踪。

## 1. 实现与状态归属

- `SpriteFrameData.h` 保存 rect、originalSize、offset、insets、rotated、flip、pivot、packable、pixelsToUnit、meshType；提供 quad/sliced UV 算法与几何 reset。
- `SpriteFrame.h` 持有数据、texture 强引用与 atlasUuid；提供标量读写、版本号、texture reset/依赖解析、clone 数据复制、UV 和 trimmedBorder。
- `.jsb.ts` 不再保存 `_texture/_rect/_originalSize/_offset/_rotated/_capInsets` 等第二份权威状态，也不计算 UV；只保留元数据、序列化、事件/API 桥接和数学对象视图。
- `rect/originalSize/offset/pivot` 是按实例惰性创建的 Rect/Size/Vec2 视图；直接修改分量或调用 set 会写入 native，旧视图也能读到 native 后续修改。getRect/getOriginalSize/getOffset 仍提供副本或复用 out 参数。
- `uv/unbiasUV/uvSliced/trimmedBorder` 是由 native 数据生成的读取结果；不将直接改写这些派生数组作为 native 数据更新入口。quad UV 的旋转/翻转排列与 Web 对齐；sliced UV 沿用 Web 不应用 quad flip 的约定。
- texture 为零尺寸时，quad UV 对齐 Web 的 0/1 回退；sliced UV 用有限占位值，避免 Web 除零产生的 NaN/Infinity。该差异只用于纹理尺寸尚未就绪时。

## 2. API 与消费者修正

- `reset()` 无参数且未指定 clearData 时保留几何；只有 clearData=true 才清空，与 Web 对齐。
- public texture 赋值重置几何并初始化尺寸；反序列化依赖通过 loadTexture 绑定，保留已序列化的有效 rect/originalSize。
- width/height 返回 texture 尺寸；恢复 EVENT_UV_UPDATED、MeshType、createWithImage，补 clone 与 trimmedBorder。
- 序列化保留字段格式、atlas 和 texture 依赖登记；遗漏的 packable/pixelsToUnit/pivot/meshType 使用明确默认值。
- Sprite 在 native prepare 的空闲返回前检查 frame 版本和纹理尺寸；共享 frame 修改后不需 JS 重新绑定即可重建五种模式。清空 texture/无效 rect 移除旧 draw info，恢复后能重新提交。
- Mask 内部 Sprite 复用同一版本检测；BMFont Label 检测 atlas frame 版本，替换 texture 后重建文本纹理。没有增加 JS 逐帧轮询。

## 3. 验证记录

以下均在当前 v4 工作区执行；不是全平台或完整 Creator 场景验收。

| 检查 | 结果与范围 |
|---|---|
| C++/Web UV parity | 32 组：旋转 × flipX × flipY × 四种纹理尺寸组合；正常尺寸下逐项比较 16 点 sliced UV |
| 既有纯 C++ 几何测试 | 99 checks，0 failures |
| JS/Web 定向回归 | 6 suites，14 tests 通过；原生存储 mock 验证视图、转发、clone/reset、依赖解析及导出依赖，Web SpriteFrame 原有测试通过 |
| Windows native Debug/Release | SWIG 生成、编译、链接和 cc2d_native_poc 运行通过 |
| 真实 JSB 方法 | jsb.SpriteFrame/jsb.SpriteAtlas 注册，frame 默认值、版本、copy/reset、非空 texture 的 UV vector 转换通过 |
| 原生渲染数据 | 五模式共享 frame 修改、simple/sliced 的八组旋转/翻转组合、清空/恢复 texture、Mask 与 BMFont 程序化资产消费通过 |
| 生命周期定向检查 | 1000 次 native frame copy/release，原 texture 仍有效；不是 1000 次完整场景加载，也不是泄漏工具验收 |
| TypeScript | 常规 tsc --noEmit 与显式包含 sprite-frame.jsb.ts 的类型检查通过 |

复现入口：

```powershell
pwsh -NoProfile -File native/tests/2d-poc/run-m6-sprite-frame-tests.ps1
pwsh -NoProfile -File native/tests/2d-poc/run-poc-tests.ps1
node node_modules/jest/bin/jest.js --runInBand --silent tests/ui/native-2d-m2-sprite-frame-shell.test.ts tests/ui/native-2d-m2-sprite-shell.test.ts tests/ui/native-2d-m3-label-shell.test.ts tests/ui/native-2d-m4-mask-shell.test.ts tests/assets/native-sprite-atlas.test.ts tests/ui/sprite-frame.test.ts
```

native harness 用 `native/tests/2d-poc/native/CMakeLists.txt` 配置，构建 cc2d_native_poc 并在输出目录运行。此次 Debug 的 MSVC /Zi 构建遇到 C1902 PDB 管理器不匹配，改用本地 CMake Debug flags `/Z7 /Ob0 /Od /RTC1` 后构建与运行通过；未改仓库默认工具链。

`run-m0-checks.ps1` 已接入上述 M6.1 UV 对照入口，正常执行 C++ 夹具后启用对应 Jest 对照。普通 Jest 未提供夹具路径时会明确跳过该跨运行时用例，不将缺少 C++ 产物记为通过。

同时修正旧 harness：SpriteAtlas 测试原来在 remove 释放 frame 后继续使用裸指针，现持有 IntrusivePtr；JSB 测试更新为 assets.i 导出的 jsb.SpriteFrame/jsb.SpriteAtlas。测试初始化的 wasm 报错和无 alphaThreshold 参数的测试材质警告不作为像素或材质兼容通过证据。

## 4. 仍需验收

- 真实 PNG/.fnt、旧场景/prefab、完整 native 引擎 JS bundle 与 Creator 资源加载链的回归；本次原生消费者使用程序化 ImageAsset/Texture2D，不等同于文件加载。
- 更新后的 Web/native GPU RenderTexture 像素 golden；本次检查了 native draw buffer 与 UV，未重跑 M2/M3 场景像素探针。
- 动态合图打包与恢复的剩余组合继续验收。旧序列化 mesh 的验证见[旧序列化多边形](#旧序列化多边形)。
- SpriteAtlas map/native 表同步、字体资产完整生命周期及 M6 平台/内存/线程矩阵，见 [M6 计划](./native-2d-m6-plan.md)。

## 帧末归还纹理引用

SpriteFrame 通过 IntrusivePtr 持有当前纹理。打包状态下，另一份 IntrusivePtr 持有原图。C++ 与 JSB 分别在自己的帧末销毁队列调用同一清理方法，清空两份引用和原图状态，并更新 revision。Sprite 和 BitmapFont Label 在下次原生准备阶段据此收到空纹理。仍由调用方独立持有的纹理沿用其自身生命周期。

销毁请求排队后仍可读取现有数据。公开纹理赋值、依赖回填和原生纹理绑定入口检查销毁标志。JSB 在帧末同时移除图集登记。C++ 夹具在保留帧对象的条件下交替销毁普通与打包帧，检查引用计数复归以及迟到写入。真实 Prefab 夹具在保留已释放的帧 wrapper 时检查纹理、原图和 UV，并尝试写入一份新纹理验证回填约束。

Windows Debug 和 Release 的 C++ 探针各完成 1000 轮，普通帧与打包帧各占一半。真实 Windows Debug Prefab 与 Web 工程、完整串行门禁及 39 项定向 Jest 通过，100 组现有像素对照逐字节一致。M5 用时 40.33 秒。测试覆盖图集与帧归还自身的引用，长期堆和跨平台仍待验收。

## 旧序列化多边形

Web 和 JSB 从旧格式读入多边形后，SpriteRenderer 通过 ensureMeshData 首次构造网格。修复前定向回归读到空索引。修复后保留作者指定的原始顶点、索引和 UV，按当前 pivot 与 pixelsToUnit 更新位置和边界。克隆独立持有原始坐标与缓冲；同一对象重新反序列化时采用新的索引和边界。

Windows Debug、Release 与 Web 的同一场景执行反序列化、纹理依赖回填、SpriteRenderer 绑定、克隆与替换克隆纹理。GPU 样本检查红色原图和克隆、绿色替换纹理及黑色凹口，每张有 3072 个着色像素。三张新增图和 116 张既有图均通过逐字节对照。对照快照为 e5aac01ecbd429ddf30e9ae630db4de80330110c6af43fd81d1c2a2e993a38b3。

| 捕获 | 三端共同的 RGBA SHA256 |
|---|---|
| authored-mesh | 7547ae52964ef737da8f9b12cbd01bf4dedddb83e33b5d56d2ed51eab1ad20ef |
| authored-mesh-clone | 7547ae52964ef737da8f9b12cbd01bf4dedddb83e33b5d56d2ed51eab1ad20ef |
| authored-mesh-replaced-texture | 4c54b0c487ce6a6f4509bb2fa5d92d113c2d2f7bb2485ed2661ebb08758bbb9f |

[场景与实际 Mesh 缓冲断言](../native/tests/2d-poc/fixtures/graphics-gpu/assets/scripts/M6GraphicsGpuProbe.ts)通过既有 SpriteFrame 和 SpriteRenderer API 执行。JSB 薄壳检查为 295/300 行，复用已生成 Mesh 的边界。

标准旧工程在 Windows Debug、Release 通过 M2–M5。Debug 完整 M0 和 Release 六组真实 JSB 探针通过，Web 旧工程完成 92 张位图、旧图集与 RichText 检查。

## 同一帧的图集页和源纹理

SpriteFrame 在打包时保留源纹理和源坐标。Web 的 2D Sprite 接收帧 UV 事件，标记 UV 所在的几何数据和纹理提交为待刷新。SpriteRenderer 的矩形网格按源图尺寸与源坐标生成 UV，序列化多边形沿用作者提供的 UV。材质绑定采样同一源纹理，打包和恢复时已生成的网格可以继续使用。

夹具从旧 plist 和 PNG 加载纹理。矩形与多边形各使用两个节点共享帧，分别绘制 2D Sprite 和 SpriteRenderer。Web 将同一源纹理的原帧与懒加载克隆打入同一页。Windows Debug 和 Release 提交同样的启用和打包请求，动态合图维持禁用。Windows 两种配置的 C++ 探针各做 1000 次直接打包、克隆和独立恢复，验证 UI UV 随图集坐标改变，网格的像素 UV 与归一化 UV 均沿用源图。Web 定向回归覆盖普通、九宫格、平铺、横向填充和径向填充的帧通知，以及换帧、禁用和销毁解绑。

| Web 相对同场景源图 | 重绑材质的差异像素 | 打包后首次建网格的差异像素 | 恢复源图后的差异像素 |
|---|---:|---:|---:|
| 修复前，矩形 | 4608 | 2304 | 2304 |
| 修复前，多边形 | 4032 | 4032 | 1728 |
| 修复后，两种形状 | 0 | 0 | 0 |

修复前使用 998f57e283147615865c65b5b02f5bbe00105667b467a2ab50f955e07c60977f 的测试包。修复后的三端快照为 831ef9686ecceb2ad53435a11577ceac747a9fd7ca2dd31facaf299ac528236e。新增八张图逐字节一致，119 张旧图在各端分别与上一候选哈希相同。Windows 两种配置与 Web 各完成 1000 次场景切换。

| 形状 | 四个状态共同的 RGBA SHA256 |
|---|---|
| rect | 729ea170a2ac49e3528fe3ce41dbeb222d55f4f4ad0762b93063ba37dc620efc |
| polygon | ed1ca8c8cd38e83a8c6e9ee140880de938b4ff05a0df9c3fcaba165cb759fa39 |

[共享帧场景与打包状态断言](../native/tests/2d-poc/fixtures/graphics-gpu/assets/scripts/M6GraphicsGpuProbe.ts)、[严格图像比较器](../native/tests/2d-poc/compare-graphics-gpu.cjs)。

Windows Debug 完整 M0、Windows 双配置旧工程 M2–M5 和各六组真实 JSB 探针均通过。Web 旧工程通过 92 张位图捕获、旧图集及 RichText 检查。

| Windows GPU 候选 | 可执行文件 SHA256 |
|---|---|
| Debug | bdc71bd41c48b0dce2857efdf8169159588e0fc5d586f1a8b8de8aef94e556ea |
| Release | 84d417c0be38c6a6f2231a2d8dcb6a0365b52618d8e2788be14cc890f53228a8 |

## 帧末释放生成的网格

Web 和 JSB 在 SpriteFrame 的延迟销毁入口释放并清空该帧的 Mesh。提交销毁请求后，当前帧仍能使用已生成的网格。帧末归还网格所持的 GPU 顶点与索引缓冲，下一销毁批次将调用方仍持有的 Mesh 对象标为无效。已销毁的 SpriteFrame 调用 `ensureMeshData()` 时不会生成新网格。

修复前，Web 定向测试在两次销毁队列刷新后仍读到有效的 Mesh。三端各通过 `assetManager.releaseAsset()` 释放六个已提交的矩形或多边形帧，保留 Mesh 和渲染子网格引用检查顶点和索引缓冲。Web 释放仍打包的原帧后，独立克隆仍可恢复并采样旧 plist 与 PNG 提供的源纹理。Windows Debug 和 Release 在动态合图禁用的条件下执行对应的原图用例。[定向回归](../tests/ui/native-2d-m2-sprite-frame-shell.test.ts)、[GPU 场景](../native/tests/2d-poc/fixtures/graphics-gpu/assets/scripts/M6GraphicsGpuProbe.ts)

快照 `83a78c641a96cde3a226a80b51441b51430ad4a3bd27d4e33c846ef3bd461f26` 中，三端各完成 1000 次场景切换与 4998 项断言。127 张 RGBA 的最大通道差均为 0，各端逐张与上一候选的哈希相同。Debug 和 Release 的比较器完整输出 SHA-256 均为 `7ca4a15f80445a298441bb371cbfd2fad0f028c2340eef5ddc91d836c9339734`。[严格图像比较器](../native/tests/2d-poc/compare-graphics-gpu.cjs)

| Windows GPU 候选 | 可执行文件 SHA-256 |
|---|---|
| Debug | `01db5b7289c84a7bcb2f703c635ef775f32883794c0afac9476161963130f994` |
| Release | `ab05e5d29eb9061f6bb543531c9fa72261b813e7b985d17d3f5b266fec50cdf2` |

Windows Debug 完整 M0 通过，末尾 45 项 Jest 均通过。Windows 双配置各通过 M2–M5、六组 JSB 探针和 92 张与 Web 逐字节一致的位图字体捕获。Web 旧工程的合图和 RichText 检查也通过。

## 矩形网格的旋转与翻转

修复前，非方形旋转帧的矩形网格使用未交换的图集宽高和错误的角点顺序。32×32 的定向回归中，逻辑尺寸 10×6 的帧把右侧 U 边界读成了 14/32，正确位置为 10/32。Web 和 Native 现在复用各自的 2D Sprite 角点映射。矩形网格的归一化 V 保留 SpriteRenderer 着色器使用的底部原点，像素 UV 保留原有存储约定，导入的多边形继续使用作者提供的顶点和 UV。[定向回归](../tests/ui/native-2d-m2-sprite-frame-shell.test.ts)

SpriteRenderer 在 UV 变化时检查当前网格，源纹理坐标改变就重绑模型，并恢复模型的可见层。仅图集页或页内位置改变时继续复用已有 Mesh。禁用期间修改翻转属性，重新启用后会使用更新的网格。

GPU 场景从同一纹理写入四种颜色，使用非方形普通区域与顺时针旋转区域。四种翻转组合各在平放和旋转区域验证。新增 11 张图分别逐角核对 2D Sprite 与 SpriteRenderer，覆盖 Web 真实打包、禁用组件后修改翻转属性及恢复源纹理。Windows 双配置保持 Native 动态合图禁用，执行对应原图路径。[GPU 场景](../native/tests/2d-poc/fixtures/graphics-gpu/assets/scripts/M6GraphicsGpuProbe.ts)、[图像及角点比较器](../native/tests/2d-poc/compare-graphics-gpu.cjs)

快照 `075ad0861ad9a4e5f065bc9c4b8016dfb36faa8021a38b565b63fa580d897699` 中，Windows Debug、Release 和 Web 的 138 张 RGBA 逐字节一致。127 张既有图在各端逐张与上一候选哈希相同，三端各完成 1000 次场景切换。双配置比较输出的 SHA-256 均为 `cc980229dd22187a8c703a616de4c0d530fd18f25f0c4da93bdb41165beabea7`。

| Windows GPU 候选 | 可执行文件 SHA-256 |
|---|---|
| Debug | `b3eb934746340b7be41b8423dc5a366451fcce4994bf92a268c254747bb717aa` |
| Release | `9836d6621aadab80c96ffcf2819499e0c0ef16f9f576a532bcb355c4f41906f7` |

Windows Debug 完整 M0 通过，末尾 46 项 Jest 均通过。Windows 双配置各通过 M2–M5、六组真实 JSB 探针与 92 张和 Web 逐字节一致的位图字体图像。Web 旧工程的动态图集和 RichText 验收通过。

## 多边形的深度边界与相机裁剪

JSB 生成 Mesh 时使用作者提供的三维包围盒。修复前，Windows 原生网格的顶点 Z 正常，包围盒最小和最大 Z 均为 0。把相机远平面放在模型原点与多边形之间后，旧 Debug 把完全位于视锥内的多边形裁掉。

同场景使用深度为 8 到 20 的凹多边形，比较原网格、延迟生成的网格、克隆和图集恢复后的边界。Web 实际打包并从该状态克隆，Windows 双配置执行原图路径。远平面位于世界 Z=4 时，三端各有 1728 个着色像素，与源图中的网格部分逐字节一致。移至 Z=24 后，三端捕获均为空。157 张图三端逐字节一致，155 张既有图与上一候选相同。[逐配置证据](./native-2d-m6-sprite-polygon-depth.json)
