# Native 2D M2 进展记录

> 对应计划：[native-2d-module-sinking-plan.zh-CN.md](./native-2d-module-sinking-plan.zh-CN.md) 的 M2。
> 范围：仅 `cocos/2d`；不引用其他分支代码。
> 状态：M2 Sprite override 已启用；五种模式、SpriteFrame native 缓存、custom pipeline 提交、人工可见渲染、RenderTexture 像素探针和 ≥30% 性能 KPI 均已确认。Web golden 仍是遗留项。

## 1. native UIRenderer 基座

新增 `native/cocos/2d/framework/UIRenderer.h/.cpp`：

- 继承 `Component`，进入 native Node 的 UI 组件槽位；
- `TYPE_ID = 3`；
- color、material、priority、src/dst blend factor；
- `setColor/setColorRGBA/getColor`；
- `setMaterial/getMaterial/getRenderMaterial`（显式 material 优先，否则
  `ui-sprite-material`）；
- `setSharedMaterial/getSharedMaterial`（按 index 保存材质数组）；
- `getMaterialInstance`：有 effect 时复制 parent material，空 material 回退 shared；
- `setPriority/getPriority`。

`Sprite` 改为：

```cpp
class Sprite final : public UIRenderer, public RenderEntity::IPrepareListener
```

- `TYPE_ID = 4`；
- 复用 UIRenderer 的 color/material/priority；
- 继续持有 frame、RenderEntity 和 SIMPLE 几何；
- 通过 `Component::setNode` 注册到 Node UI 槽位。

## 2. 绑定与构建

- `native/CMakeLists.txt` 登记 `UIRenderer.h/.cpp`、`SpriteFrame.h`；
- `native/tools/swig-config/2d.i` 在 `Sprite.h` 前 include/`%include`
  `UIRenderer.h`、`SpriteFrame.h`；
- 生成绑定包含 `cc::UIRenderer`、`cc::SpriteFrame`；
- V8 冒烟：`new n2d.UIRenderer()`、`new n2d.SpriteFrame()` 及 setter 通过；
- Debug clean rebuild 605/605（M2 基座阶段）。

## 3. SpriteFrame native 缓存

新增 `native/cocos/2d/assets/SpriteFrame.h`：

- texture / rect / originalSize / offset / rotated / 九宫格 insets 字段；
- `Sprite::setFrame(SpriteFrame*)` 重载，一次 JSB 调用复制全部字段；
- texture 尺寸从 `TextureBase::getWidth/getHeight` 获取；
- JS 壳构造 `n2d.SpriteFrame` 后调用单参数 `setFrame`。

## 4. Sprite SIMPLE 薄壳

`cocos/2d/components/sprite.jsb.ts`（约 182 行有效代码）：

- `@ccclass('cc.Sprite')` 和序列化字段；
- `onLoad` 创建 `n2d.Sprite`、`setNode`、绑定 native UITransform；
- `spriteFrame` 构造 native SpriteFrame 并转发；
- `color`/`priority`/`enabled` 转发；
- `customMaterial` 转发到 native `setMaterial`；
- `getSharedMaterial/setSharedMaterial` 转发到 native indexed material；
- `type`/`fillType`/`fillStart`/`fillRange`/`fillCenter` 转发；
- `sizeMode` 转发；TRIMMED 使用 frame rect，RAW 使用 originalSize 更新 UITransform；
- `srcBlendFactor`/`dstBlendFactor` 转发到 native UIRenderer；
- 不包含几何、assembler 或材质实例逻辑。

当前 **已启用**：`native/tests/2d-poc/m2-components.json` 中 `sprite.enabled = true`，`cc.config.json` 已增加 Sprite override。
## 4.1 Sliced 几何（builder 阶段）

`SpriteGeometry` 新增：

- `SpriteMesh { vertices, indices, valid }`；
- `SlicedSpriteGeometryParams`（contentSize/anchor/frameRect/textureSize/insets）；
- `buildSlicedSpriteMesh()`：4×4 顶点网格、9 个 quad、54 个索引；
- insets 会 clamp 到 contentSize，避免反向 quad；
- `transformSpriteMesh()` 支持世界矩阵。

纯 C++ 测试新增 `testSlicedMesh`：

```text
75 checks, 0 failures
```

`Sprite::prepare` 已接入 `_type == 1`（SLICED）分支：使用
`buildSlicedSpriteMesh`、`transformSpriteMesh`，并生成 16 顶点/54 索引的
drawInfo。`sprite.jsb.ts` 的 `type` setter 转发到 native `setType`。

C++ 测试覆盖 SLICED drawInfo 顶点/索引数。

尚未接入 Radial。

## 4.2 Filled 几何（H/V）

`SpriteGeometry` 新增：

- `FilledSpriteGeometryParams`（content/anchor/frame/texture/fillType/fillStart/fillRange/fillCenter）；
- `buildFilledSpriteMesh()`：
  - horizontal/vertical fill 生成裁剪 quad（4 顶点、6 索引）；
  - fillStart/fillRange clamp；
  - UV 随 fill 区间裁剪；
  - radial fill 暂返回 invalid。

`Sprite::prepare` 已接入 `_type == 3`（FILLED）分支；`sprite.jsb.ts` 转发
`type/fillType/fillStart/fillRange/fillCenter`。

C++ 测试：

- `testFilledMesh`：x/(-25,25)、u/(0.25,0.75)；
- Sprite FILLED drawInfo 4/6。

## 4.3 Tiled 几何

`SpriteGeometry` 新增：

- `TiledSpriteGeometryParams`（content/anchor/frame/texture）；
- `buildTiledSpriteMesh()`：
  - 按 frameRect 尺寸在 content 内重复平铺；
  - 边缘 tile 裁剪；
  - 每个 tile 4 顶点/6 索引，动态累积；
  - UV 按实际 tile 尺寸裁剪。

`Sprite::prepare` 已接入 `_type == 2`（TILED）分支。

C++ 测试：

- `testTiledMesh`：200×100 content + 100×100 frame → 8 顶点/12 索引；
- Sprite TILED drawInfo 8/12；
- `75 checks, 0 failures`。

## 4.4 Radial fill

`SpriteGeometry` 新增：

- `buildRadialSpriteMesh()`：以 fillCenter 为扇心，按 fillStart/fillRange
  生成三角扇；
- 24 段半圆（fillRange=0.5）时 26 顶点/72 索引；
- 扇边半径按射线与 content 矩形边界的交点裁剪，不再越出 Sprite 边界；
- 顶点 UV 按内容坐标映射回 frameRect；
- `buildFilledSpriteMesh` 的 fillType=2 委托给 radial builder。

`Sprite::prepare` 的 FILLED 分支已自动覆盖 radial；C++ 测试校验
26/72 的 drawInfo。

至此 Sprite 的 SIMPLE/SLICED/TILED/FILLED（H/V/RADIAL）五种路径均已接入。

## 5. 真实 Creator 探测

临时启用 override 后确认：

- native bundle 包含 `new n2d.Sprite()`；
- `Sprite::setNode`/`setFrame` 被调用；
- 换用 16×16 `default-texture` SpriteFrame 后 `setFrame rect 0 0 16 16`；
- 用真实 `assets/resources/M2Sprite.png`（64×64 红色贴图）加载
  `resources.load('M2Sprite/spriteFrame')` 成功，`M1_SPRITE_TEXTURE
  {"hasFrame":true}`；
- `Batcher2d::walk` 到达 `M1TestNode` 并执行到 `callPrepare`；
- `RenderEntity` enabled、opacity 0.501961、listener 非空；
- `Sprite::prepare` 生成 drawInfo：`vb=4, ib=6`，material/texture 非空；
- `Batcher2d::fillBuffersAndMergeBatches` 结束时 `Batcher2d::batches 2`
  （Sprite + profiler）；
- 项目 custom pipeline 实际进入 `NativeExecutor::draw2D`；
- `submitUICommands` 收到 `batches=2`、`phase=1`、cameraVis=1108344832，
  两个 batch 的 `vis=33554432` 均通过 camera 过滤；
- batch pass phase=1，与 phaseLayoutID=1 匹配，最终执行到 `cmdBuff->draw`；
- native sprite shader 编译成功；
- `M1_SPRITE_FRAME {"hasFrame":true}`；
- 人工确认：运行中的 `cocos-m1-test` native 窗口可见 64×64 红色 Sprite。

因此 native 侧 Sprite 不仅完成 draw 提交，也已实际显示。WGC/PrintWindow
无法捕获，但改用 **Canvas 相机 targetTexture + 256×256 RenderTexture +
readPixels** 的离屏探针后，五种模式都读到了红色像素：

```text
SIMPLE  red=438 maxR=128
SLICED  red=300 maxR=175
TILED   red=300 maxR=175
FILLED_H red=300 maxR=175
FILLED_RADIAL red=300 maxR=175
M2_PIXEL_RESULT {"ok":true}
```

探针通过 `run-m2-pixel-probe.ps1` 接入可选的 M2 回归（`CC_M2_APP_EXE`）。

## 6. 验证

```
native 2D PoC: PASS
jsb bindings result: OK
39 checks, 0 failures      # 旧 pure C++ 基线
75 checks, 0 failures      # 含 sliced/filled/tiled/radial mesh
18 checks, 0 failures      # M1 shell contract
Jest: 1 passed             # Sprite M2 shell mock
M2 pixel probe: PASS       # RenderTexture, five modes
```

性能补充（Release 多次采样）：

- native 1000 Sprite 场景约 143~220 ns/sprite（中位数约 166）；
- JS 1000 Sprite 场景约 288~389 ns/sprite；
- 最好值提升约 50.7%，中位数提升约 45%，达到 ≥30% KPI；
- native prepare 约 56.6 ns/op。

C++ 断言：

- `Sprite::getTypeId() == Sprite::TYPE_ID`；
- 继承的 `setColorRGBA/getColor`；
- 继承的 `setPriority/getPriority`；
- `getRenderMaterial() == 显式 material`；
- `getSharedMaterial(0/1)` 分别返回主材质和第二个 shared material；
- 空 material 的 `getMaterialInstance(0)` 回退到 shared material；
- `sizeMode=1` 使用 frame rect 50×60，`sizeMode=2` 使用 originalSize 80×90。

Jest 覆盖：native 构造/Node 绑定、color、customMaterial、SpriteFrame 字段
（含 insets）、frame 转发、disable/destroy。

## 7. 尚未完成

1. 可靠的 native 截图与 Web/native 像素对照；
2. material instance 解析；
3. SpriteFrame 完整 native 资产化/insets 边界用例；
4. TS UIRenderer 继承链最终决策；
5. 默认启用 Sprite override 的决策。

## 8. 下一步

native Sprite 已经走通 SIMPLE/SLICED/TILED/FILLED 五种 drawInfo 路径以及
drawInfo → batch → custom pipeline `draw2D` → `submitUICommands` → draw。
下一步集中解决可靠截图/像素对照，再决定默认启用。
