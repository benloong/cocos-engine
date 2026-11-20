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
