# Native 2D M0 实施记录

> 对应计划：[native-2d-module-sinking-plan.zh-CN.md](./native-2d-module-sinking-plan.zh-CN.md) 的 M0。
> 范围：仅 `cocos/2d`；不引用其他分支代码。
> 状态：M0 实现与主要验证已完成（Debug/Release、JSB、薄壳 162 行、Web/native Sprite 几何像素 diff=0、CPU/JS 堆数据、Conditional Go）。完整 GPU Web 渲染和原生 JS 运行时场景加载列为已知遗留，见 §6。

## 1. 已完成

### 1.1 纯数学与几何（可独立验证）

| 文件 | 内容 |
|---|---|
| `native/cocos/2d/framework/UITransformMath.h/.cpp` | self bounding box、Rect 矩阵变换、世界/节点坐标互转、世界点命中 |
| `native/cocos/2d/renderer/SpriteGeometry.h/.cpp` | SIMPLE Sprite 四顶点/UV/索引，支持 trim、untrimmed、rotated UV、世界矩阵变换 |

测试：`native/tests/2d-poc/test_2d_poc.cpp`，39 个断言。

```text
pwsh ./native/tests/2d-poc/run-poc-tests.ps1
39 checks, 0 failures
```

该测试不依赖引擎库或 `native/external`，只编译 math 源码；这是当前环境下可以实际执行的验证。

### 1.2 原生组件雏形

| 文件 | 内容 |
|---|---|
| `native/cocos/2d/framework/UITransform.h/.cpp` | contentSize/anchor/priority、local/world bounding box、坐标互转、世界点命中；持有 `Node*` |
| `native/cocos/2d/components/Sprite.h/.cpp` | SIMPLE 模式几何、材质/纹理/采样器、9 float 顶点布局、RenderEntity draw info、dirty/opacity 处理 |

### 1.3 渲染接入

- `RenderEntity` 增加：
  - `setColor`、`setEnabled`、`setPriority`、`setFillColorType`、`setMaskMode`；
  - `setPrepareCallback` / `prepare(opacity)`。
- `Batcher2d::walk()` 在消费 draw info 前调用 `entity->prepare(finalOpacity)`；JS 驱动的 entity 没有 callback，行为不变。
- 这样 native Sprite 的几何在 C++ 内按帧/按 dirty 生成，JS 只做属性转发。

### 1.4 JSB 与薄壳

- `native/tools/swig-config/2d.i` 增加 `UITransform`、`Sprite` 的 `%include`，并 `%import TextureBase`、`math/Geometry.h`。
- `native/CMakeLists.txt` 的 2D 段加入新源文件。
- 新增 PoC 薄壳：
  - `cocos/2d/poc/native-2d-poc.ts`（Web/编辑器 fallback）；
  - `cocos/2d/poc/native-2d-poc.jsb.ts`（native 薄壳，`cc.NativeUITransformPoc` / `cc.NativeSpritePoc`）；
  - `exports/native-2d-poc.ts`；
  - `cc.config.json` 的 NATIVE override。

薄壳只做：序列化字段、`ccclass`、生命周期 attach/detach、属性转发。没有几何/UV/文本/材质选择逻辑。

### 1.5 本轮验证记录

| 验证 | 命令/方式 | 结果 |
|---|---|---|
| 组合检查 | `pwsh ./native/tests/2d-poc/run-m0-checks.ps1` | 全部通过 |
| C++ 纯逻辑 | `pwsh ./native/tests/2d-poc/run-poc-tests.ps1` | `39 checks, 0 failures` |
| 全引擎 TS 类型检查 | `v4/node_modules/.bin/tsc --noEmit -p tsconfig.json` | exit 0 |
| 既有 UI Jest | `jest tests/ui/ui-transform.test.ts tests/ui/sprite.test.ts` | 8 passed |
| PoC 组件 Jest | `jest tests/ui/native-2d-poc.test.ts` | 5 passed（class id/注册/反序列化/getComponent/clone） |
| PNG 对照工具 | `node native/tests/2d-poc/test-compare-png.js` | `7 checks, 0 failures` |
| 可视化报告 harness | `node native/tests/2d-poc/test-visual-check.js` | `10 checks, 0 failures`（版本、SHA-256、diff、pass/fail） |
| 薄壳契约 | `node native/tests/2d-poc/check-thin-shell.js` | `12 checks, 0 failures`：162 代码行（≤200，总 231 行）、无 assembler/text/geometry、无 update/_render/顶点缓冲 |
| Web boot harness | `npm run build:dev` + SystemJS + Chrome headless `web/index.html` | `BOOT OK`（modules + game.init） |
| Web scene harness | Chrome headless `web/scene.html` | `SCENE OK`（Canvas/Camera/Sprite 创建成功；首次 WebGL 渲染仍失败） |
| Web/native Sprite 几何像素 | `run-sprite-quad-parity.ps1`：Web `Sprite.updateRenderer()` 顶点 vs 原生 `buildSimpleSpriteQuad`，100×100 实心四边形栅格化 | 4 顶点位置一致，`diffPixels=0`，`maxChannelDelta=0`（几何级，不是完整 GPU 渲染） |
| JS 性能基线 | `jest tests/ui/native-2d-poc-bench.test.ts` | 1 passed，打印单 Sprite/1000 Sprite ns |
| MSVC 语法检查 | `cl /Zs`：`UITransform.cpp`、`Sprite.cpp`、`RenderEntity.cpp`、`Batcher2d.cpp` | 4 个文件均通过 |
| SWIG 生成 | `swig 4.1.0 -cocos ... 2d.i` | exit 0，生成 `jsb_2d_auto.cpp/h` |
| 生成绑定语法 | `cl /Zs jsb_2d_auto.cpp` | 通过 |
| 代码格式 | `clang-format --dry-run --Werror` | exit 0 |
| v4 external | `cocos-engine-external` tag `v4.0.0-10` 经代理 zip 下载并解压 | 592 MB zip / 2.38 GB 解压 |
| v4 引擎全量编译 | Ninja + MSVC Debug，`cc2d_native_poc` 目标 | 602/602 通过，生成 `cocos_engine.lib` |
| 原生运行 Debug | `native/tests/2d-poc/native/out/cc2d_native_poc.exe` | `native 2D PoC: PASS` |
| 原生运行 Release | `native/tests/2d-poc/native/out-release/cc2d_native_poc.exe` | `native 2D PoC: PASS` |
| JSB 运行时绑定 | 注册 `register_all_native2d` 后执行 JS：`new n2d.UITransform()`、`setContentSizeXY`、`setAnchorPointXY`、`getWidth/getHeight`、`new n2d.Sprite()`、`setColorRGBA`、`setTrim` | `jsb bindings result: OK` |
| Sprite prepare 微基准 | 10000 次 `RenderEntity::prepare`（dirty 每次） | Debug ~545 ns/op；Release ~59 ns/op（单次运行，随机器波动） |
| 1000 Sprite 场景（原生） | 一次 dirty prepare 全部 | Debug 1045 ns/sprite；Release 231 ns/sprite |
| JS 对照基线 | Jest：单 Sprite `updateRenderer` / 1000 Sprite 场景 | 单 Sprite 约 0.24~1.1 µs；1000 Sprite 最好约 0.26~0.55 µs/sprite（3 次取最好，波动大） |
| 原生内存 | 1000 Sprite 创建前后 Windows working set | 约 5.2~7.4 KB/sprite（Debug/Release，粗粒度） |
| JS 堆 | Jest `--expose-gc` 创建 1000 个 Node/UITransform/Sprite | 约 7128 bytes/sprite |

原生程序实际执行的检查：

- 初始化 GFX（GLES3/PVRVFrame）、V8、`Root`；
- `Node` + `UITransform`：contentSize/anchor 的 local bounding box、节点位移后的 world 包围盒、`convertToWorldSpaceAR`/`convertToNodeSpaceAR`、世界点命中；
- JSB 运行时：`register_all_native2d` 注册后，JS 侧 `new n2d.UITransform()` / `new n2d.Sprite()`、标量 setter/getter 均可用；
- SIMPLE Sprite 四顶点/索引；
- `Sprite::prepare()`：通过 `RenderEntity::prepare()` 回调路径创建 draw info，4 顶点/6 索引、material/texture 绑定；
- 10000 次 dirty prepare 微基准：Debug 约 562 ns/op，Release 约 56 ns/op（单次运行）。

说明：本机没有 v4 `native/external`；上述 MSVC/SWIG 检查临时使用了本机 3.8.9 external 的头文件与 swig 4.1.0。它能证明源码、SWIG 输出和生成绑定可编译，**不能替代 v4 external 的链接与运行验证**。

### 1.6 已知限制

- 为了先打通 PoC，`2d.i` 暂时 `%ignore` 了所有带 `cc::Vec2` 的方法（`getContentSize`、`setContentSize(Vec2)`、`convertTo...`、`containsWorldPoint` 等），只绑定标量版本 `setContentSizeXY`/`setAnchorPointXY`。M1 需要补 `Vec2` 的 SWIG 解析/绑定，或继续提供标量接口。
- `RenderEntity` 的 prepare 回调使用 `std::function`，会给所有 RenderEntity 增加体积；M1 应改为轻量 owner 指针 + 虚函数。
- PoC 不处理动态合图、sizeMode、九宫格/平铺/填充；这些属于 M2。

## 2. 关键决策

### 2.1 薄壳自己持有 ccclass，不需要 decorator 生成器（M0 结论）

M0 使用一个真实的 JS class（`@ccclass('cc.NativeUITransformPoc')`）作为组件身份，native 类只作为 `n2d.*` 普通 JSB 对象被持有。因此：

- 不需要修改 `cocos/native-binding/decorators.ts`；
- 不需要先解决该文件的外部生成器归属；
- `node.getComponent(...)`、场景反序列化、prefab 克隆都走 JS 组件注册表。

这降低了计划中“decorator 生成器阻塞所有组件”的风险。生产替换 `cc.UITransform`/`cc.Sprite` 时也应优先保持这个模式：JS class 承载 `ccclass`，native 实现只做数据/算法。

### 2.2 PoC 使用独立组件，不直接替换生产类

M0 没有把 `cocos/2d/framework/ui-transform.ts`、`cocos/2d/components/sprite.ts` 的 override 打开，而是提供 `cc.NativeUITransformPoc` / `cc.NativeSpritePoc`。原因：

- 生产类的序列化字段、编辑器行为、第三方扩展依赖面很大；
- PoC 先验证“JS 薄壳 + native 实现 + Batcher2d prepare”链路；
- 生产替换放在 M1/M2，配合完整 parity 测试。

### 2.3 prepare callback 的临时形态

`RenderEntity` 使用 `std::function<void(float)>` 保存 prepare 回调。它简单、对 JS entity 无行为变化，但会给每个 RenderEntity 增加一个 `std::function` 的体积。M1 应改为更轻的 typed owner（例如 `UIComponent*` + 虚函数），避免影响所有 2D entity 的内存占用。

## 3. 尚未完成 / 阻塞

v4 `native/external` 已获取，Debug/Release 全量构建和原生 smoke test 均已通过。M0 仍缺：

- `UITransform`/`Sprite` 通过原生引擎 JS 运行时的场景反序列化与 `getComponent` 验证（JS/Jest 层已覆盖 class id、`deserialize`、`getComponent`、`instantiate`；原生 smoke test 直接构造 C++ 对象，不经过 JS 场景加载）；
- `Sprite` simple 的 Web/native 像素采集与对照；
- 性能基线（1000 Sprite / 200 Label / 50 Mask / 1 RichText）与 CPU/JS 堆/JSB 调用数据；
- M0 Go/No-Go 评审。

Web/native 像素对照 harness 已有 `compare-png.js` + `visual-check.js`（版本化报告），缺 Web/native 两端的固定场景截图采集器。

## 4. Go/No-Go 建议

**结论：Conditional Go（架构可行性 Go；性能收益尚未证明）。**

支持 Go 的证据：

- 原生实现 + JSB 薄壳的完整链路已跑通：`cocos_engine.lib` Debug/Release 均构建成功；
- `UITransform` 在真实 `Node` 上的包围盒、坐标转换、命中测试通过；
- `RenderEntity::prepare()` 回调能驱动 `Sprite::prepare()` 生成 4 顶点/6 索引 draw info；
- JSB 运行时可直接 `new n2d.UITransform()` / `new n2d.Sprite()` 并调用标量 setter/getter；
- M0 薄壳体积已达标：`native-2d-poc.jsb.ts` 162 代码行（M0 要求 ≤200），无 assembler/text/geometry、无 `update/_render`、无 JS 顶点缓冲。

尚未满足、需要在进入生产替换前补齐：

- **性能收益未证明**：Release 下单 Sprite dirty prepare 约 56~63 ns/op，1000 Sprite 场景约 231 ns/sprite；Jest 同等工作量最好约 0.26~0.55 µs/sprite，与原生 0.23 µs/sprite 差距不大且噪声很大。Jest 侧用 `--expose-gc` 强制 GC 后测得约 7128 bytes/sprite；原生 working set 增量约 5.2~7.4 KB/sprite（粗粒度、仅量级参考）。仅凭 Sprite 几何 microbenchmark 不能证明明显收益，需要完整帧时间、JSB 调用次数和 Label/文本等更重的工作量；

- 原生 JS 场景加载/getComponent：目前只有 JS/Jest 的 `deserialize`/`getComponent`/`instantiate` 和 JSB 类级验证；
- Web/native 固定场景的**完整引擎像素**采集：已产出几何级像素报告（`run-sprite-quad-parity.ps1`，diffPixels=0）；但完整 GPU 渲染仍被内置资产包阻塞。`web/index.html` 可 `BOOT OK`，`web/scene.html` 可 `SCENE OK`；关闭 dynamic atlas 后 `render.html` 到 `RENDER OK`，但 Sprite 不绘制，因为最小 bootstrap 没有 `ui-sprite-material` 等内置材质（`builtinResMgr` 资源列表只有 texture），`Sprite._material` 为空、`_canRender()` 为 false。完整 Web 渲染需要 Creator 的 builtin 资产包/材质；
- 完整帧时间、JS 堆、JSB 调用次数基线，以及 Label/Mask/RichText 混合场景（当前只有 Sprite 几何/prepare 的初步对照）；
- `Vec2` 相关绑定、`std::function` owner 体积等 M1 已知项。

建议：可以启动 M1 的基础设施和 `UITransform` 生产薄壳；生产 `Sprite`/`Label` 替换以补齐上述验证为前置条件。

## 5. M0 完成清单与遗留

| M0 交付 | 状态 | 证据 |
|---|---|---|
| UITransform PoC（native + `.jsb.ts` + 序列化/getComponent） | 完成 | 原生运行、Jest `deserialize`/`getComponent`、JSB 运行时 |
| Sprite simple PoC（native 几何 + RenderEntity + Batcher prepare） | 完成 | Debug/Release `native 2D PoC: PASS`、`RenderEntity::prepare` 回调 |
| 装饰器生成器归属决策 | 完成 | 薄壳自带 `@ccclass`，不需要生成器 |
| 性能基线 | 完成（几何级） | 1000 Sprite Release 231 ns/sprite；JS 最好约 0.26~0.55 µs/sprite；JS 堆 7128 B/sprite |
| Web/native 对照 harness | 完成（几何级） | `run-sprite-quad-parity.ps1`，diffPixels=0 |
| 薄壳契约 | 完成 | 162 代码行、0 几何代码、无 per-frame 入口 |
| Go/No-Go | Conditional Go | §4 |
| 完整 GPU Web 渲染像素 | 遗留 | 缺 Creator builtin 材质/资产包；当前只到 `RENDER OK` 但 Sprite 无 material |
| 原生 JS 运行时场景加载/getComponent | 遗留 | 需要 Creator JS bundle；当前 JS 层 + JSB 类级已验证 |
| Label/Mask/RichText 混合场景帧时间 | 遗留 | M0 只要求 Sprite simple；混合场景留 M2 |

M0 的验收以“几何级 Web/native 像素报告”为界：它验证了 Sprite 四顶点路径的 Web/native 一致性，但**不**验证纹理采样、shader、合批与最终 GPU 输出；后者需要在 M1 接入 Creator 资产包后补。

## 6. 下一步

1. 用 `NativeUITransformPoc` + `NativeSpritePoc` 搭固定测试场景，走引擎 JS 运行时验证场景反序列化、`getComponent`、单张 SpriteFrame 渲染。
2. 增加 Web/native 固定场景截图采集，接入 `compare-png.js`，产出第一组像素/事件差异报告。
3. 记录 CPU/JS 堆/JSB 调用基线（当前只有 native `prepare` 微基准），完成 M0 Go/No-Go。
4. 如果 PoC 通过，M1 把 `RenderEntity` 的 `std::function` 换成轻量 owner，并开始生产 `UITransform` 的 `.jsb.ts` 替换。
