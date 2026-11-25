# Cocos 4.0 Native 2D 模块 JS 组件下沉方案

> 范围：**仅 `cocos/2d` 模块**（UITransform、UIRenderer、Sprite、Label、Mask、Graphics、RichText、UIOpacity、Canvas/RenderRoot2D 及配套 assembler/assets/event）。已弃用的 `UIStaticBatch` 不纳入范围。`UIMeshRenderer`、`UIMesh`、`UISkew`、`Canvas`、`Camera`、`Widget`、`View` 明确不下沉，保持 JS。
> 不包含：`cocos/ui` 控件（Button/ScrollView/EditBox/Widget/Layout 等）以及动画、粒子、骨骼、物理、3D UI 桥接、编辑器逻辑、用户脚本。范围已冻结，`cocos/ui` 不进入本次任何阶段。
> 目标读者：引擎 2D/JSB/构建方向的同学。
> 2026-11-25 从 cocos-cli 重打 Windows Debug/Release 后，M0–M5 合并签收仍为 **NO-GO**。当前新包的公开接口、应用、对照和性能结果见 [M6 Gate](./native-2d-m6-gate.md#2026-11-25-cli-新包整体验收)和 [M6 清单](./native-2d-m6-plan.md)。第 6 节各阶段的进度说明保留了当时的签收范围。

---

## 0. 结论摘要（TL;DR）

1. **现状不是“2D 全是 JS”**。native 侧已经有 `Batcher2d`、`RenderEntity`、`RenderDrawInfo`、`UIMeshBuffer`、`UIModelProxy`、`StencilManager` 六个 C++ 类，native 构建下 `Batcher2D.update()` 直接返回，节点遍历、合批、提交都在 C++ 完成。真正还在 JS 的是**组件属性/生命周期、几何装配（assembler）、文本排版、材质选择、命中测试**。
2. **路线已定：原生实现 + JSB 薄壳（方案 A），这就是终态**。C++ 负责数据与算法，TS 只保留 `Component` 壳、序列化、编辑器元数据和公开 API 转发，通过 `.jsb.ts` 替换接入。薄壳里不允许再出现几何装配、文本排版、材质选择、逐帧遍历等逻辑。
3. **分七个阶段（M0~M6）**：M0 PoC → M1 基础设施 + UITransform → M2 UIRenderer + Sprite → M3 Label/文本 → M4 Mask/Graphics → M5 RichText 与剩余组件 → M6 硬化。按 2~3 名熟悉 JSB/2D 的工程师估算约 **8~11 个月**（不含 15~20% 风险缓冲）；只做 P0 组件（UITransform/Sprite/Label/Graphics 基础）约 **6~7 个月**。
4. **“纯原生 Component 运行时”（方案 B）不作为终态，也不纳入本计划**。它需要原生场景加载/序列化、组件注册表、编辑器工具链和用户脚本兼容，属于另一条产品路线。
5. **立项时先做两个 PoC 再全量投入（现已有阶段记录）**：UITransform（验证组件挂载、序列化、编辑器兼容）和 Sprite simple 模式（验证逐帧几何/合批收益与 JSB 边界成本）。用数据决定是否进入 M1。
6. **实现只基于当前 v4 worktree**：不引用其他分支的代码、夹具或设计文档；所有 C++ 落点、绑定、测试都在 v4 内新建或扩展。

---

## 1. 现状盘点

> 本节原始行数和缺口用于说明立项基线，不代表当前进度；当前状态以第 6 节、各阶段 Gate 和 M6 清单为准。

### 1.1 两套 runtime 与构建选择

- Web/编辑器：纯 TS 实现，`cocos/**` 源码直接打包。
- Native：C++ 引擎 + JSB + TS 组件。构建时 `cc.config.json` 的 `moduleOverrides` 按 `context.buildTimeConstants.NATIVE` 把部分 `.ts` 替换成 `.jsb.ts`，例如：
  - `cocos/scene-graph/node.ts` → `node.jsb.ts`
  - `cocos/2d/renderer/native-2d.ts` → `native-2d.jsb.ts`
  - `cocos/asset/assets/texture-2d.ts` → `texture-2d.jsb.ts`
- JSB 绑定由 `native/tools/swig-config/*.i` 描述，CMake 构建时自动生成 `native/cocos/bindings/auto/*`；2D 当前对应 `native/tools/swig-config/2d.i`，导出到 JS 的命名空间是 `n2d`。
- 原生类的 `ccclass`/`serializable` 元数据通过 `cocos/native-binding/decorators.ts` 里的 `patch_cc_*` 函数补挂；历史补丁的外部生成器未找到；2026-11-16 已为六个 2D 资产补仓库内 AST 生成器和 CI，产物由该模块重导出，见 [元数据维护入口](./native-2d-m6.0-metadata.md)。

### 1.2 2D 模块构成（TS 侧，约 2.25 万行）

| 子目录 | 行数 | 主要内容 | 当前实现 |
|---|---:|---|---|
| `framework/` | 2,577 | `UITransform`、`UIRenderer`、`UIComponent`、`Canvas`、`RenderRoot2D`、`SpriteRenderer`、`UIRendererManager`、`UISkew` | TS |
| `components/` | 5,721 | `Sprite`、`Label`、`LabelOutline`、`LabelShadow`、`Mask`、`Graphics`、`RichText`、`UIOpacity` | TS |
| `renderer/` | 4,299 | `Batcher2D`、`RenderData`、`MeshRenderData`、`MeshBuffer`、`RenderEntity`、`RenderDrawInfo`、`StencilManager`、`StaticVBAccessor` | TS 编排 + C++ 核心 |
| `assembler/` | 6,060 | Sprite 五种模式（simple/sliced/tiled/bar/radial）、Label（TTF/BmFont/Letter/排版）、Graphics（路径/earcut） | TS |
| `assets/` | 1,871 | `SpriteFrame`、`SpriteAtlas`、`TTFFont`、`LabelAtlas`、`BitmapFont` | TS |
| `event/` | 261 | `pointer-event-dispatcher`、UITransform 命中测试 | TS |
| `utils/` | 1,687 | `text-utils`、HTML 解析、动态合图、字体加载、UI skew | TS |

### 1.3 已经原生的部分

- `native/cocos/2d/renderer/` 的 6 个类：`Batcher2d`、`RenderEntity`、`RenderDrawInfo`、`UIMeshBuffer`、`UIModelProxy`、`StencilManager`。
- native `Node` 已把 opacity、colorDirty、skew、transform flags 等放进与 JS 共享的内存块（`node.jsb.ts` 里的 `_sharedFloat32Arr`、`_sharedUint8Arr`），C++ 读取不需要 JSB 调用。
- 平台层已有原生 `CanvasRenderingContext2D` 及 win32/apple/java/linux/openharmony/empty/qnx delegate（`native/cocos/platform/interfaces/modules/canvas/`、`native/cocos/platform/*/modules/CanvasRenderingContext2DDelegate.*`），提供 `measureText`/`fillText`/`strokeText`，并通过 `native/cocos/bindings/manual/jsb_global.cpp` 暴露给 JS；当前 Label 的 TTF 位图生成走的就是这条路径。
- `RenderEntity::setNode()` 会把自身挂到 native `Node` 的 `userData` 上；native `Batcher2d::walk()` 通过 `node->getUserData()` 拿到 RenderEntity，直接处理 draw info。
- native 构建下 `Batcher2D.update()` 直接 return，节点遍历和合批由 C++ 完成（`cocos/2d/renderer/batcher-2d.ts` 的 JSB 分支）。

**结论：渲染提交链路已经原生，JS 仍然负责“每个组件产生什么 RenderEntity/DrawInfo、顶点怎么算、文字怎么排、材质选哪个、点击落在哪”。下沉的核心就是把这段搬进 C++。**

### 1.4 关键缺口

- 没有原生 `Component` 基类参与 JSB 组件生命周期（`native/cocos/core/scene-graph/Node.h` 里组件相关代码目前是注释状态）。
- `Node` 的 UI 属性 `_uiProps`（`NodeUIProperties`）是 JS 对象，`UITransform` 也是 JS；native 侧没有 `UITransform` 指针。
- `Renderer`（材质/材质实例基类）是 JS，无 native 对应物；`UIRenderer` 继承它。
- `SpriteFrame`、`SpriteAtlas`、`TTFFont`、`LabelAtlas` 等 2D 资产是 JS。
- 文本排版/字体栅格化、Graphics 路径三角化、RichText 解析与排版全部在 JS。
- 指针事件的 hit test 在 JS（依赖 `UITransform.hitTest`）。
- `cocos/2d/components/ui-mesh.ts`（约 636 行）是 v4 新增组件，没有现成 native 对应实现，需要单独补。

---

## 2. 目标、边界与原则

### 2.1 目标

1. 2D 逐帧热点（组件几何准备、文本排版、遮罩状态、命中测试、材质解析）全部在 C++ 执行，JS 只做低频属性设置和生命周期转发。
2. 对外 API、序列化格式、场景/预制体资源、编辑器行为与 Web 完全一致；Web 构建行为不变。
3. 可度量：2D 密集场景 CPU 帧时间、JS 堆、GC、每帧 JSB 调用次数有明确基线，并有回退开关。
4. 分组件可独立合入、独立回退，不要求一次性全量。
5. **终态 JS 层是薄壳**：只保留元数据、序列化 accessor、生命周期转发和公开 API；不保留任何算法/逐帧逻辑，也不长期保留与 native 重复的可变状态。

### 2.2 非目标

- 用户脚本组件、第三方扩展（Spine/DragonBones）的生命周期迁移。
- “2D 组件零 JS 对象”或“无 JS 线程的 2D runtime”；薄壳路线接受每个组件一个 JS 壳对象及其生命周期开销。
- 原生场景加载/反序列化（方案 B 的内容）。
- `cocos/ui` 控件模块（Button/ScrollView/EditBox/Widget/Layout 等）：不纳入本计划，也不作为后续阶段预留。`cocos/ui` 继续使用 `UITransform`、`UIOpacity` 等公开 API，本次下沉只保证这些 API 行为不变，不改 `cocos/ui` 代码。
- 编辑器内的原生实现（编辑器继续用 Web 引擎）。
- **代码改动边界**：主体在 `cocos/2d`、`native/cocos/2d`、绑定与构建配置；`cocos/ui`、`cocos/3d` 等模块不做功能迁移，必要时只加兼容接口/类型，不改其行为。

### 2.3 原则

- **Web 是行为黄金标准**：每个组件先有 Web/原生对照用例，再谈优化。
- **先测量后迁移**：没有基线数据的组件不进入排期。
- **粗粒度边界**：跨 JSB 用 `setXxx/getXxx/prepare/update` 这种批量接口，不做逐顶点、逐字符调用。
- **薄壳只做壳**：序列化/生命周期/编辑器元数据/公开 API 留在 JS；数据、算法、逐帧逻辑一律 native。终态不存在“先留 JS、以后再评估”的算法代码。
- **同一 runtime 只有一条热路径**：Web 保留 TS 实现、native 用 C++ 实现，是两套 runtime 的既定事实；但 native 构建里，迁移完成的组件不得再执行 JS 几何/文本/材质逻辑，两边行为由 parity 测试锁定。
- **薄壳可验收**：每个组件有壳体积、稳态每帧 JSB 调用数、JS 侧是否残留几何/文本代码的量化检查（见 4.6）。

---

## 3. 路线对比与选择

| 维度 | 方案 A：原生实现 + JSB 薄壳（终态） | 方案 B：纯原生 Component 运行时 | 方案 C：只下沉热点 |
|---|---|---|---|
| 组件对象 | 仍是 JS `Component`，持有 native impl | C++ 组件，C++ 生命周期/反序列化 | JS 组件 + C++ 几何/文本函数 |
| 序列化 | JS 不变 | 需要原生场景加载 | JS 不变 |
| 与用户脚本 | 完全兼容 | 需要桥接/重写 | 完全兼容 |
| 性能收益 | 高（逐帧工作原生） | 最高（无 JS GC/跨语言） | 中（仅热点） |
| 改动范围 | 中 | 大（runtime 分叉） | 小 |
| 周期（2~3 人） | 8~11 个月（不含缓冲） | 12 个月以上 | 2~3 个月 |
| 风险 | 中低，可增量回退 | 高 | 低 |
| 适合 | 4.0 现有 JSB 架构 | 明确去 JS 化/多线程产品 | 快速验证收益 |

**选择：方案 A 为终态；方案 C 只作为 M0~M2 的交付节奏（先热点、后全组件），不是最终形态。** 方案 B 不采用。终态验收以 4.6 的“薄壳契约”为准，而不是“还有多少 JS 代码”。

**薄壳路线的既定成本**：每个 2D 组件仍有一个 JS 对象、一次序列化/反序列化和生命周期调用开销；换来的是与用户脚本、编辑器、预制体、第三方扩展的完全兼容，以及可增量合入/回退。这个成本是终态的一部分，不再以“以后去掉壳”为目标。

---

## 4. 推荐架构

### 4.1 分层

```
┌──────────────────────────────────────────────────────────────┐
│ TS 层（Web/编辑器完全复用）                                   │
│  Sprite / Label / ...  （薄 Component：decorator、序列化、    │
│  onLoad/onEnable/onDestroy、公开 API、编辑器元数据）          │
│  属性 setter/getter ──转发──▶ native impl                    │
└──────────────────────────┬───────────────────────────────────┘
                           │ JSB（粗粒度）
┌──────────────────────────▼───────────────────────────────────┐
│ Native 组件层（native/cocos/2d）                              │
│  UITransform / UIRenderer / Sprite / Label / Mask / ...      │
│  几何装配、文本排版、材质选择、RenderEntity/DrawInfo 生成      │
└──────────────────────────┬───────────────────────────────────┘
                           │ C++ 直接调用
┌──────────────────────────▼───────────────────────────────────┐
│ 已有原生渲染层                                                │
│  Batcher2d::walk → RenderEntity → DrawInfo → 合批/提交        │
└──────────────────────────────────────────────────────────────┘
```

> 注意：`cocos/2d/**/x.ts` 仍保留完整的 Web 实现，编辑器/Web 继续使用；native 构建通过 `moduleOverrides` 换成 `x.jsb.ts`。**“薄壳”指 native 侧的 JS 文件，不是删掉 Web 实现。**

### 4.2 组件挂载与生命周期

关键设计：**native 组件对象需要一个挂在 native `Node` 上的锚点**，否则 C++ 侧无法在 `Batcher2d::walk()` 中直接找到组件。

- 在 native `Node` 上增加（仅 JSB 构建可见）：
  - `UITransform` 指针（或通用 `Component* _uiComponent`）；
  - 可选的轻量 `std::vector<IntrusivePtr<Component>> _components` 与 `getComponent<T>()`；在 v4 的 `native/cocos/core/component/` 新建最小 `Component` 基类（只含 Node 指针、enabled、类型 id 和生命周期虚函数，**不引入** registry/scheduler/serialization）。
- JS 薄壳生命周期：
  - `onLoad()`：`this._native.attach(this.node)`，native 侧注册到 Node；
  - `onEnable()/onDisable()`：转发 enabled；
  - `onDestroy()`：`detach()`，释放 RenderEntity；
  - `update()`：默认不需要；热点在 native `prepare()`。
- 渲染组件（Sprite/Label/Mask/Graphics/RichText）在 native 侧创建并持有 `RenderEntity`，调用 `setNode(node)` 挂到 `userData`；`Batcher2d::walk()` 在遍历到该节点时直接调用组件的 `prepare(opacity)`，不再经过 JS。
- 非渲染组件（UITransform、UIOpacity）通过 native Node 的组件槽位查找；`UIOpacity` 直接写 native Node 的 opacity 字段。

这样 `Batcher2d::walk()` 的现有实现几乎不用改：它已经通过 `node->getUserData()` 拿 RenderEntity，只需在 `entity` 存在时增加“从 entity 找到 owner 组件并 prepare”的回调/指针。

### 4.3 数据与序列化

- 序列化字段仍定义在 `.jsb.ts` 的 JS 类上（`@serializable`、`@type`、`_contentSize` 等），保证场景/预制体格式不变。
- 字段用 accessor 转发到 native，例如 `get _contentSize()` / `set _contentSize(v)`；反序列化发生在 `onLoad` 之前，native setter 必须允许“未 attach 时先缓存”，在 attach/onLoad 后统一 flush（pending 模式）。
- 对高频字段（如 opacity、color）优先走 Node 已有的共享内存，避免每次 setter 都跨 JSB。
- 克隆/预制体：`instantiate` 仍走 JS 序列化，逐字段 setter 会同步到 native；需要保证构造后、attach 前的状态一致。

### 4.4 材质与资产

- `Material` 在 v4 已经是 native 资产（`material.jsb.ts`），native 组件可以直接持有 `Material*`。
- SpriteFrame 已有 native 数据缓存和 Sprite 消费路径；M6 继续统一 UV/字段权威状态与 API，避免恢复逐帧跨 JSB 读取。
- 当前 SpriteFrame、SpriteAtlas 已直接导出 jsb.SpriteFrame/jsb.SpriteAtlas 并修改 prototype，实例字段在 _ctor 中初始化，调用 Asset 初始化；覆盖同名 API 前保存原生方法，避免递归。不再派生 JS 资产子类或另建 _nativeAtlas 包装对象。
- 组件继续保留 JS Component 身份；资产 prototype 模式不直接套用到组件继承链。
- 2026-11-16：SpriteFrame 基础数据、quad/sliced UV、reset/clone 已迁入 native，JS 数学对象改为可写视图，见 [SpriteFrame 报告](./native-2d-m6.1-sprite-frame.md)。SpriteAtlas 已补 map/依赖回填/native 表同步及 Windows 实际 JSB 壳验证，见 [SpriteAtlas 报告](./native-2d-m6.1-sprite-atlas.md)。动态合图/mesh 与真实资源场景验收仍待补齐。
- TTFFont/LabelAtlas/BitmapFont、动态合图按需 native 化；逐类确认数据、所有权和生命周期，见 M6.1。
- `Renderer` 的材质实例/共享材质解析属于“逻辑”，终态要在 native：M2 就把 UI 需要的 `getSharedMaterial/setSharedMaterial`、material instance 选择做成 native 接口，JS 壳只转发；不要把它留成永久 JS 逻辑。
- 当前 UIRenderer 保留 extends Renderer；M6 复核 sharedMaterials/material/getSharedMaterial/setSharedMaterial 等 API、继承身份和间接执行路径，确保迁移组件不再执行 JS 材质选择逻辑。组件不直接改为原生资产式 prototype 导出。

### 4.5 绑定与构建集成

每个下沉的类需要以下改动：

1. `native/cocos/2d/...` 新增 `.h/.cpp`，并在 `native/CMakeLists.txt` 的 `##### 2d` 段登记（或加入模块化 source list）。
2. `native/tools/swig-config/2d.i`：
   - `%include` 新头文件；
   - `%import` 依赖的基类/类型；
   - `%attribute` 暴露属性；
   - `%ignore` 掉不需要暴露的内部方法、`IntrusivePtr` 细节、回调类型。
3. 生成绑定：CMake 会自动跑 `genbindings`；新增/删除 `.i` 后需要重新生成工程（仓库脚本有提示）。
4. `cocos/2d/**/x.jsb.ts`：
   - 组件用 `export class X extends Component` 保持 JS Component 身份；非组件辅助对象直接导出原生类；2D 组件辅助类使用 n2d.X，SpriteFrame/SpriteAtlas 资产使用 jsb.X（绑定在 assets.i）；
   - `patch_cc_X` 补 `@ccclass('cc.X')`、`@serializable`、`@type`、`@menu`、`@executeInEditMode` 等；
   - 公开 API 的 getter/setter 转发；不复制算法。
5. `cc.config.json` 的 `NATIVE` override 增加 `"cocos/2d/.../x.ts": "cocos/2d/.../x.jsb.ts"`。
6. 通过 `scripts/generate-native-2d-decorators.cjs` 生成 2D 资产 `patch_cc_X`，由 `cocos/native-binding/decorators.ts` 重导出；组件壳保留源码装饰器。
7. 类型声明：`@types/jsb.auto.d.ts` 由 SWIG JSON 生成；`n2d` 在 `.jsb.ts` 里可先 `declare const n2d: any`，但建议补正式声明以便类型检查。

### 4.6 薄壳契约（终态验收标准）

薄壳**只允许**包含以下四类内容：

1. 编辑器与序列化元数据：`@ccclass`、`@property`、`@serializable`、`@type`、`@menu`、`@help`、`@executeInEditMode`、`@requireComponent` 等。
2. 序列化字段的 accessor、默认值、类型声明；字段名和序列化格式必须与 Web 版逐一对齐。
3. 生命周期转发与注册：`onLoad` attach、`onEnable/onDisable`、`onDestroy` detach、`__preload` 等；只做转发，不写业务。
4. 逐类核对现行公开 API 的签名和转发行为，覆盖公开属性、方法、枚举和静态成员。兼容接口和已弃用接口（含弃用别名）排除在组件 parity 验收范围外。

薄壳**禁止**包含：

- 顶点/索引/UV 计算，几何装配，Sprite 填充/平铺/九宫格计算；
- 文本测量/排版/换行/字形缓存，HTML 解析；
- 路径构建/earcut/三角化（Graphics 的路径 API 若保留 JS，必须是纯命令收集，三角化仍在 native）；
- 逐帧 `update` 中的业务逻辑，或每帧遍历子节点/组件；
- 材质选择/材质实例解析（终态在 native，JS 只传 `Material` 句柄）；
- 与 native 重复的可变状态缓存（允许序列化字段的镜像 accessor，但不得在 JS 侧维护第二份权威数据）。

完整终态门禁以 [M6 计划第 3 节](./native-2d-m6-plan.md#3-终态验收标准) 为准。M3/M4/M5 Windows 阶段功能通过不能替代终态验收；RichText 的 JS HTML/布局和 Graphics 兼容光栅化欠项必须关闭。

每个组件的量化验收（写进 PR checklist）：

- 薄壳承担元数据、序列化、生命周期和桥接；渲染算法下沉到 Native，薄壳不导入 `assembler/`、`text-*`、`geometry` 等热路径实现；
- 稳态每帧 JSB 调用 0 次（属性变更、生命周期、用户显式 API 调用除外）；
- 薄壳内不新增 `if (JSB)` 分支；Web/native 差异只通过 override 到 `.jsb.ts` 表达；
- Web 实现文件（`cocos/2d/**/x.ts`）只允许新增类型/接口，不允许为 native 改行为。

### 4.7 跨平台与线程

- 组件数据/几何准备默认在主线程；v4 已有 Multithreading（#322），需要确认 `Batcher2d::walk()`、`RenderEntity`、共享内存的线程约束，避免在渲染线程读 JS 侧可变数据。
- 原生组件不得持有 JS 对象指针（除明确的 `se::Object` 回调，且要管理 root/unroot）；材质、纹理、Node 一律用 native 指针/`IntrusivePtr`。
- 平台字体/文字测量后端（DirectWrite/CoreText/FreeType）要按平台隔离，不能把 Windows 行为写进通用代码。

---

## 5. 单组件迁移配方（可复制）

以 `Sprite` 为例：

1. **建 parity 矩阵**：列出公开属性、序列化字段、生命周期回调、依赖资产、Web 行为用例。
2. **C++ 数据与算法**：`native/cocos/2d/components/Sprite.{h,cpp}` + `renderer/SpriteGeometry.*`。先实现数据/几何，不碰生命周期。
3. **绑定**：`2d.i` 增加 `%include`、`%attribute`；确认 `IntrusivePtr`/`Material*`/`Texture*` 的 typemap 正确。
4. **JS 薄壳**：`cocos/2d/components/sprite.jsb.ts`，保留 `@ccclass('cc.Sprite')`、全部 `@serializable` 字段、`Sprite.Type/FillType/SizeMode` 枚举、`Assembler` 静态字段（如仍被外部引用）。
5. **生命周期桥**：`onLoad` attach、`onEnable/onDisable` 转发、`onDestroy` detach；`_render` 在 JSB 下不再调用 assembler。
6. **序列化回归**：加载旧场景/预制体，检查 `_spriteFrame`、`_type`、`_sizeMode`、`_fillType` 等字段的读写和默认值。
7. **行为/像素回归**：Web vs native 截图、事件、属性切换序列。
8. **性能**：记录 `Batcher2d.update` CPU、JS 调用次数、堆/GC；达到 KPI 后确保 native 构建的 `.jsb.ts` 不再引用 JS 热路径（assembler/text/geometry）。

---

## 6. 阶段计划

> 以下工期为立项估算，不能作为当前剩余工期。M6 接收了 M4/M5 的终态欠项，须在 M6.0 盘点后重新排期。阶段进度依据已有 Gate，不代表本次重新验证。

### M0：PoC 与决策（2~3 周）

- 目标：用最小闭环验证“原生实现 + JSB 薄壳”可行性与收益。
- 内容：
  1. `UITransform` PoC：native 类 + `.jsb.ts` 壳 + `@serializable` + 场景反序列化 + `getComponent` 正常。
  2. `Sprite` simple 模式 PoC：native 几何 + RenderEntity + native `Batcher2d` 直接 prepare；与 Web 像素对照。
  3. 确认 `native-binding/decorators.ts` 生成器归属与扩展方式。
  4. 建立 2D 性能基线场景（1000 Sprite / 200 Label / 50 Mask / 1 RichText）与 KPI。
  5. 搭建最小 Web/native 对照 harness：固定测试场景、Web 端截图、native 端截图、像素/事件序列比较，至少覆盖 UITransform 与 Sprite simple。
- 退出标准：两个 PoC 在 Windows Debug/Release 跑通；对照 harness 能产出第一组 Web/native 像素/事件差异报告；薄壳契约（4.6）初版通过——UITransform/Sprite 的 `.jsb.ts` 壳 ≤ 200 行、稳态每帧 0 次 JSB 调用、壳内无几何代码；给出 CPU/JS 调用/堆的对比数据；Go/No-Go 评审。

### M1：基础设施 + UITransform（5~6 周）

> 进度：UITransform/UIOpacity override 已启用，场景/prefab、命中测试等已有验证；见 [M1 Gate](./native-2d-m1-gate.md)。平台和稳态调用数等终态检查归入 M6。

- 内容：
  - native `Component` 轻量基类（仅数据/生命周期，不启用 registry/serializer）与 Node 组件槽位；
  - attach/detach 协议、RenderEntity 所有权、`Batcher2d` prepare 回调；
  - `UITransform`（contentSize/anchorPoint/boundingBox/convertToWorld/NodeSpace/hitTest）；
  - `UIOpacity` 与 Node opacity 联动；
  - 绑定/shim/override/decorator 的模板化脚本（减少每组件重复劳动）；
  - 特性开关（按组件/模块回退到 JS）。
- 退出标准：UI 布局、变换、命中测试用例与 Web 一致；每帧无 UITransform 的 JSB getter 调用；场景加载/预制体回归通过。

### M2：UIRenderer + Sprite（6~8 周）

> 进度：**M2 已完成**。Sprite override、五种模式、SpriteFrame 薄壳、custom pipeline、Web/native 像素 golden、性能 KPI 均通过；详见 [native-2d-m2-report.md](./native-2d-m2-report.md)。

- 内容：
  - native `UIRenderer`（color/material/stencil/blend/renderData/priority 的 UI 子集）；
  - 材质解析下沉：`getSharedMaterial/setSharedMaterial`、material instance 选择、内置 ui-sprite 系列/custom material/alpha-separated/gray 的选择都在 native，JS 只转发句柄；
  - `Sprite` 全部模式：simple/sliced/tiled/bar-filled/radial-filled；
  - `SpriteFrame` native 化（或至少 native 缓存 rect/offset/rotated/insets）；
  - `UIMeshRenderer` 不下沉（见 M5）。
- 退出标准：五种 Sprite 模式与 Web 像素对照（容差内）；属性动态切换序列通过；2D 密集场景 CPU 下降达到 KPI（建议 ≥30%）；`sprite.jsb.ts` 壳无几何或材质选择算法，稳态每帧 0 次 JSB 调用。

### M3：Label + 文本栈（8~10 周，风险最高）

> 进度：**M3 Windows 收口通过**。TTF、wrap/align/overflow、Outline/Shadow、BMFont/kerning/真实资产、CHAR/BITMAP cacheMode 完成；见 [native-2d-m3-gate.md](./native-2d-m3-gate.md) 与 [native-2d-m3-report.md](./native-2d-m3-report.md)。跨平台字体矩阵留到 M6。

- 内容：
  - 文本测量/排版（TTF、BmFont、Letter）、换行/对齐/overflow；
  - 字体加载与 native 字体句柄；字形/图集缓存；
  - `Label`、`LabelOutline`、`LabelShadow`；
  - 与 `UIOpacity`、遮罩、RichText 的联动。
- 退出标准：布局/行宽/基线/换行与 Web 一致；字形位图在约定容差内（不同平台字体后端——DirectWrite/CoreText/FreeType/OHOS——光栅化结果天然不同，不要以“整图像素完全一致”作为硬门槛）；跨平台（Win/mac/iOS/Android）至少各一套字体用例。

### M4：Mask + Graphics（5~6 周）

> 进度：**M4 Windows 功能收口通过**。RECT/ELLIPSE/SPRITE_STENCIL/GRAPHICS_STENCIL、嵌套 Mask、Graphics 基础均通过；跨平台、native 三角化、性能后置。见 [native-2d-m4-gate.md](./native-2d-m4-gate.md) 与 [native-2d-m4-report.md](./native-2d-m4-report.md)。

- 内容：
  - native `Mask`（RECT/GRAPHICS_SPRITE/GRAPHICS_STENCIL，inverted、segments、alphaThreshold）；
  - StencilManager 联动、嵌套遮罩；
  - Graphics 路径/earcut 三角化 native；**路径 API 建议保留 JS 或做批量提交**，避免每次 `lineTo` 跨 JSB 反而变慢；
  - 填充/描边/端点/连接/贝塞尔/圆弧。
- 退出标准：遮罩裁剪像素对照；Graphics 常用路径与 Web 对照；给出“路径 API 逐调用 vs 批量提交”的性能结论。

### M5：RichText（5~7 周）

> 进度：**M5 Windows 场景功能收口**（RichText 文本/图片段与 RenderRoot2D），不是终态下沉完成。RichText HTML 解析、样式和布局仍在 JS，列入 M6.2 阻断项。Canvas/Camera/Widget/View、UIMeshRenderer/UIMesh/UISkew 保持 JS。见 [M5 Gate](./native-2d-m5-gate.md) 与 [RenderRoot2D 报告](./native-2d-m5.1-renderroot.md)。

- 内容：
  - `RichText`（HTML 解析、嵌套 Label/Sprite、图片混排、布局/换行/对齐）；
  - `UIMeshRenderer`、`UIMesh`、`UISkew` **不下沉，保持 JS**；
  - `UIStaticBatch` **已弃用，不实现、不纳入 native 范围**；
  - `RenderRoot2D` native 化；`Canvas`/`Camera`/`Widget`/`View` 不下沉，保持 JS；

- 退出标准：UI 场景级对照（节点几何、文本段、图片段、事件）。

### M6：终态欠项、资产、事件与硬化（原估 4~5 周，待重估）

> 候选 `8ee11b673e` 曾通过 11 月 24 日的 Windows 门禁。现行公开接口复验发现三项差异，整体验收待修复。[最新结论](./native-2d-m6-gate.md#2026-11-25-现行公开接口复验) · [构建及复验命令](./native-2d-build-and-acceptance.zh-CN.md)

- M6.0：API/parity、薄壳残留、历史遗留和工具链基线；
- M6.1：SpriteFrame UV/状态一致性，SpriteAtlas 依赖解析与 native 表同步，字体/图集资产、克隆/释放；
- M6.2：RichText HTML 解析、样式、分段和布局 native 化，保留 JS 事件桥接；
- M6.3：承接 M4.3，Graphics native 三角化/GPU buffer、描边语义、批量提交性能和 Mask 回归；
- M6.4：事件、RenderRoot2D 多 root/Camera、生命周期/线程、1000 次加载卸载与 Windows Debug/Release；macOS、iOS、Android、OHOS 暂缓；
- M6.5：CPU ≥50%、JSB ≥70%、JS 堆 ≥30% 改善目标，薄壳自动检查、CI/裁剪组合、回退演练和最终 Gate。

退出标准：所有终态阻断项及平台矩阵有候选版本证据，不能以阶段通过、mock 测试或 colored sanity 替代。Component 基类继续保留 JS 身份，完整迁移不进入 M6；见 [评估结论](./native-2d-m6-component-eval.md)。

**立项总估算（非剩余工期）：约 35~45 周（8~11 个月，不含 15~20% 风险缓冲）；只做 P0 组件（UITransform、Sprite、Label、Graphics 基础）约 6~7 个月。**

---

## 7. 基于 v4 现状的实现路径

> 本节所有落点都在当前 v4 worktree 内；不引用其他分支的代码、夹具或设计文档。

### 7.1 v4 内可直接复用的原生基础

1. **2D 渲染后端**：`native/cocos/2d/renderer/` 的 `Batcher2d`、`RenderEntity`、`RenderDrawInfo`、`UIMeshBuffer`、`UIModelProxy`、`StencilManager`。
2. **Node 共享内存**：`cocos/scene-graph/node.jsb.ts` 与 `native/cocos/core/scene-graph/Node.h` 的 shared buffer（opacity/colorDirty/skew/transform flags），C++ 读取不需要 JSB。
3. **原生文本绘制**：`native/cocos/platform/interfaces/modules/canvas/CanvasRenderingContext2D.*` 及平台 delegate（`win32`/`apple`/`java`/`linux`/`openharmony`/`empty`/`qnx`），提供 `measureText`/`fillText`/`strokeText`；JSB 绑定在 `native/cocos/bindings/manual/jsb_global.cpp`。Label 的 TTF 光栅化可直接复用这条路径。
4. **原生资产**：`Material`、`Texture2D`、`ImageAsset` 等已经是 native 资产，native 组件可以直接持有指针。
5. **构建与绑定**：`native/tools/swig-config/2d.i`、CMake 自动生成绑定、`cc.config.json` 的 NATIVE override、`native-binding/decorators.ts`。

### 7.2 必须新建的代码落点

| TS 侧 | native 落点 | 说明 |
|---|---|---|
| `2d/framework/` | `native/cocos/2d/framework/` | `UITransform`、`UIRenderer`、`RenderRoot2D`、`UIOpacity` |
| `2d/components/` | `native/cocos/2d/components/` | `Sprite`、`Label`、`LabelOutline`、`LabelShadow`、`Mask`、`Graphics`、`RichText` |
| `2d/renderer/` | `native/cocos/2d/renderer/` | Sprite 几何、文本布局、Graphics 路径、材质选择、命中测试辅助 |
| `2d/assets/` | `native/cocos/2d/assets/` | `SpriteFrame` 先行；`SpriteAtlas`/`TTFFont`/`LabelAtlas` 按阶段 |
| `2d/event/` | `native/cocos/2d/event/` | `UITransform.contains/hitTest` 的 native 版本 |
| `scene-graph/component` | `native/cocos/core/component/` | 最小 `Component` 基类 + Node 组件槽位（不含 registry/serializer） |

### 7.3 依赖顺序

`UITransform` → `UIRenderer`/`Sprite` → `Label`（复用 7.1 的第 3 条文本后端）→ `Mask` → `Graphics` → `RichText` → `RenderRoot2D`。

### 7.4 明确不做

- 不引入原生场景加载、原生反序列化、组件注册表/Scheduler（那是方案 B）。
- 不迁移 `cocos/ui` 控件，不改 `cocos/ui` 行为；只保持 `UITransform`/`UIOpacity` 公开 API 兼容。
- 不复制 3D 的 `Renderer`/`Model`/材质实例体系；2D 只实现 UI 需要的子集。
- 不为 native 修改 Web 实现的行为；native 差异只放在 `.jsb.ts`。

---

## 8. 风险与对策

| # | 风险 | 影响 | 对策 |
|---|---|---|---|
| 1 | `native-binding/decorators.ts` 生成器不在本仓库 | 新类无法获得 ccclass/序列化元数据，阻塞所有组件 | 已为六个 2D 资产补仓库内生成脚本和 CI，见 M6.0 元数据报告；历史外部模块保持原状 |
| 2 | 组件生命周期/引用计数/GC | 崩溃、泄漏、销毁后回调 | native 组件用 `IntrusivePtr` 明确所有权；JS 壳在 `onDestroy` 显式 detach；ASan/LeakSanitizer 回归 |
| 3 | 序列化/预制体/编辑器兼容 | 旧场景打不开、字段丢失 | 字段名/默认值/类型逐一对照；加载旧场景与 prefab 的回归用例；编辑器仍走 Web |
| 4 | 资产跨 JSB（SpriteFrame 等） | 每帧跨语言读字段，收益被吃掉 | 先 native 化 SpriteFrame；其余资产按需缓存 native 句柄 |
| 5 | 文字跨平台光栅化差异 | 无法做到整图像素一致 | 以布局/字形/事件一致 + 容差为验收；平台字体后端隔离；预留专项预算 |
| 6 | JSB 边界成本（Graphics 逐调用） | 原生反而更慢 | 路径 API 保留 JS 或批量提交；先 benchmark 再决定下沉粒度 |
| 7 | v4 Multithreading/新渲染管线 | 线程竞争、RenderEntity 生命周期 | M1 明确线程模型；native 组件只在主线程改数据；渲染线程只读快照 |
| 8 | 双实现漂移 | Web/native 行为分叉 | Web 为 golden；每组件 parity 测试进 CI；迁移后删除 JS 热路径 |
| 9 | 第三方扩展依赖 2D 内部实现（Spine 等） | 扩展失效 | 保持公开 API/静态字段（如 `Sprite.Assembler`）兼容；给扩展作者迁移说明 |
| 10 | 模块裁剪/构建组合 | 最小包编译失败 | 每个组件用 feature 宏/源文件列表隔离；CI 覆盖 2d/rich-text/mask/graphics/ui-skew 组合 |
| 11 | 周期长、收益不确定 | 投入浪费 | M0 设 Go/No-Go；每阶段有 KPI 和回退开关；优先高 ROI 组件 |

---

## 9. 验证与验收

### 9.1 分层测试

1. **单元测试（TS/Jest）**：`tests/ui/ui-transform.test.ts`、`sprite.test.ts`、`label.test.ts`、`graphics.test.ts`、`ui-mesh.test.ts` 等继续跑，保证公开 API 不变。
2. **native 单元测试**：`native/tests/module-tests` 增加 geometry/text/hit-test 的 C++ 用例；`native/tests/unit-test` 可加纯净算法测试。
3. **Web/原生对照**：v4 当前没有现成的 2D 场景级 Web/native 像素对照设施；M0 需新建最小 harness（固定测试场景 + Web 端 headless 截图 + native 端渲染截图 + 像素/事件序列比较）。在此之前，用 `tests/ui` 的 Jest 做 API/行为对照，用 `native/tests/module-tests` 做 C++ 算法对照。
4. **序列化回归**：旧场景/预制体加载、字段默认值、prefab 实例化、撤销重做（编辑器侧仍 Web）。
5. **平台矩阵**：Windows、macOS、iOS、Android、OpenHarmony，Debug/Release（至少 Debug + Release 各一轮）。
6. **性能基准**：1000 Sprite、200 Label、50 Mask、1 RichText、嵌套 Mask 场景；记录 CPU、JS 堆、GC、JSB 调用数。

### 9.2 建议 KPI（M0 定基线后确认）

- 2D 密集场景 `Batcher2d.update` + 组件 update 的 CPU 时间下降 ≥30%（M2）/ ≥50%（M6）。
- 每帧 JSB 调用次数下降 ≥70%；单组件 `prepare` 阶段稳态 0 次。
- 薄壳依赖：壳内不导入 assembler、文本或几何的热路径实现。
- native 构建 JS 热路径删除率：迁移完成的组件在 `.jsb.ts` 中 100% 不再执行几何/文本/材质选择代码。
- JS 堆峰值下降 ≥30%，GC 次数明显减少。
- 视觉：Sprite/Graphics 在通道容差 1 内；文字以布局/字形/基线为主，整图差异单独报告，不混入功能通过。
- 稳定性：ASan/LeakSanitizer 无新增；连续加载/卸载 1000 次无泄漏/崩溃。

### 9.3 CI

- Web 构建 + `tsc --noEmit` + Jest。
- `node scripts/compile-native-ts.js`（native TS 编译）。
- Windows native 构建 + CTest（含 2D 对照用例）。
- Android/iOS/OHOS 至少编译通过（按现有 CI 矩阵）。
- 每个 PR 检查：Web 构建未变、`cc.config.json` override 完整、无 JS 热路径残留、薄壳契约（4.6）通过。

---

## 10. 验收与维护决策

> 范围已冻结：仅 `cocos/2d`；以下事项须在 M6.0 复核现有结论、补证据和维护入口，不重新扩大范围。Windows 已接受的字体差异沿用 M5 Gate。

1. **文字验收口径**：是否接受平台字体差异？是否需要逐平台 golden 图？
2. **平台矩阵**：既有 Windows 先行记录保留；其余平台与 Debug/Release 的具体执行顺序在 M6.0 排期，终态仍要求完整矩阵。
3. **decorator 生成器**：由谁维护、是否进本仓库 CI。
4. **薄壳边界细则**：哪些内部 API 允许继续通过壳暴露、哪些可以合并/删除；建议在每个组件的 parity 矩阵里定稿，避免壳越写越厚。
5. **组件继承与身份兼容**：按当前实现补齐 UIRenderer/Renderer/Component 的 instanceof 与用户脚本兼容证据；不把资产 prototype 模式直接套用到组件，不迁移完整 JS Component 运行时。

---

## 11. 当前执行顺序

1. M6.0：以当前 v4 代码完成逐类 API/parity、薄壳与历史遗留审计，固定测试/性能基线。
2. M6.1：优先闭环 SpriteFrame/SpriteAtlas prototype 资产的真实原生加载、依赖解析、状态同步、克隆和销毁。
3. M6.2/M6.3：补 RichText 解析/布局和 Graphics 三角化等终态功能；开发时同步补 Web/native 对照。
4. M6.4：完成事件、混合场景、生命周期/线程/泄漏和平台矩阵。
5. M6.5：在同一候选版本上采集完整性能、执行回退并形成 M6 Gate；未验证项保持待验证。

不再从 M0 PoC 重新起步；既有验证作为历史证据保留，新的 prototype 改造及终态实现仍需对应原生回归。详细验收与产物要求见 [M6 计划](./native-2d-m6-plan.md)。

---

## 附：关键文件索引

- 构建替换：`cc.config.json`（`moduleOverrides` 的 NATIVE 条件）
- 2D 绑定：`native/tools/swig-config/2d.i`
- native 2D 渲染：`native/cocos/2d/renderer/`
- JS 2D 组件：`cocos/2d/framework/`、`cocos/2d/components/`、`cocos/2d/assembler/`
- native 构建：`native/CMakeLists.txt`（`##### 2d`）
- 原生类元数据：`cocos/native-binding/decorators.ts`
- 原生文本后端：`native/cocos/platform/interfaces/modules/canvas/`、各平台 `CanvasRenderingContext2DDelegate.*`、`native/cocos/bindings/manual/jsb_global.cpp`
- Node 共享内存：`native/cocos/core/scene-graph/Node.h`、`cocos/scene-graph/node.jsb.ts`
- 现有测试：`tests/ui/`（Jest）、`native/tests/module-tests/`（C++）
