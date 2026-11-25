# Native Component 生命周期统一管理设计与实施计划

日期：2026-11-16

状态：设计方案，尚未实现

最近更新：2026-11-20（明确 Native 平台的最终运行边界与 2D 迁移阶段）

适用范围：Native 平台运行时；Web 与编辑器保留现有 TS 生命周期实现。

## 1. 设计结论与约束

**最终目标。** 在原生平台，C++ 持有运行中的 Scene、Node 和组件，执行场景切换、节点树激活与销毁，以及所有受支持内置组件的生命周期和业务逻辑。用户脚本实例的业务代码在 JS 虚拟机执行，回调时机由 C++ 决定。Scene、Prefab 和 Asset 的数据读写继续由 TS 序列化器及 JSB 薄壳完成，恢复就绪的对象图交给 C++ 激活。本期以第 11 节的组件批次验收。

Native 运行时由 C++ 统一管理所有组件的生命周期。Node 持有统一的 Component 数组；Sprite 等 Native 组件和 ScriptComponent 直接继承 Component，共享激活规则、执行顺序、帧调度和销毁流程。不增加 NativeComponent 中间基类。

确定的约束：

1. Component 生命周期状态以 C++ 为唯一权威。
2. Native 组件的生命周期逻辑由 C++ 实现，脚本层只能访问，不能继承或覆盖。每个 Native 组件类型具有一一对应的 JSB 薄壳模块，直接适配原生绑定类型的原型，不再定义一个继承 JS Component 的包装类。
3. 用户脚本继续继承 JSB Component 薄壳，每个实例对应一个 C++ ScriptComponent。
4. ScriptComponent 由 C++ 决定调用时机，通过 JSB 执行 JS 回调；不要求将用户脚本编译成 C++。
5. Node 的 C++ Component 数组是运行时组件集合的唯一权威，JS 不维护独立可写副本。
6. 同一个组件不能同时被 TS 与 C++ 两套生命周期系统调度。
7. Native 平台的序列化和反序列化由对应的 JSB 薄壳接入现有 TS 序列化系统。保留类 ID、装饰器、用户属性和数据格式。C++ 类只提供运行时属性、对象引用和生命周期接口，不实现 `serialize` 或 `deserialize`。
8. 按类提供 JSB 薄壳的范围限定为需要公开给脚本的 Asset、Node、Component 及其子类。不要求数学、几何、事件、渲染后端和管理器等全部公开类各自提供薄壳；同一类的兼容别名复用同一个薄壳。

本文将已讨论方案展开为工程设计。接口名和新增文件路径属于建议，实际落地需遵循绑定生成器和现有模块约定。

## 2. 现有实现与差距

| 模块 | 当前行为 | 目标变化 |
| --- | --- | --- |
| `native/cocos/core/component/Component.h/.cpp` | 普通 C++ 基类；维护 Node、enabled、attach/detach/enable/disable | Native 组件与 ScriptComponent 的共同基类，统一对象状态和生命周期接口 |
| `native/cocos/core/scene-graph/Node.h/.cpp` | 非 owning UI 组件列表；激活事件仍转交 TS | 强引用持有所有 Component；激活交给 C++ |
| `cocos/scene-graph/component.ts` | CCObject 派生；enabled、destroy、定时器及生命周期接口 | Native 构建替换为 JSB 薄壳 |
| `cocos/scene-graph/node-activator.ts` | 递归激活、分批回调、嵌套任务取消 | Native 构建由 C++ NodeActivator 接管 |
| `cocos/scene-graph/component-scheduler.ts` | start/update/lateUpdate、排序、延迟入队 | Native 构建由 C++ ComponentScheduler 接管 |
| `cocos/scene-graph/node.jsb.ts` | JS 创建实例、维护 `_components`、激活及销毁组件 | 类型解析和包装保留；存储及生命周期转发 C++ |
| `cocos/game/director.ts` | 决定生命周期阶段与系统更新的相对顺序 | 保留阶段位置，调用 Native 阶段入口 |
| `native/cocos/core/data/Object.h/.cpp` | 已有标志、引用计数、延迟销毁，兼容 TS 先置销毁标志 | 复用基础能力，明确 Component 销毁入口和队列责任 |
| `cocos/2d/components/sprite.jsb.ts` 等 | TS onLoad 创建 Native 对象，启停回调转发 | 提前创建绑定实例；C++ 生命周期直接执行 |

当前 Native Component 的 `setNode()` 会在 enabled 时直接调用 onEnable，没有节点层级激活和 onLoad 前置保证；不能原样作为新系统的挂载入口。

`onNodeDestroyed()` 当前先清空 Node 再 onDetach，也不能替代需要访问 Node 的组件 onDestroy。

已有 [M6 评估](native-2d-m6-component-eval.md) 是此前保持 JS 生命周期方案的背景记录。本文针对独立生命周期重构提出新目标，不表示 M6 原有实现已经完成切换，也不沿用原文工期估计。

## 3. 架构与职责

```text
C++ CCObject
└── Component
    ├── Sprite / Label / Mask / Graphics / ...
    ├── 其他已迁移的 Native 内置组件
    └── ScriptComponent
        ├── 用户脚本实例的桥接
        └── 过渡期仍由 TS 实现的内置组件实例的桥接

C++ Node
└── components: 强引用 Component 数组

JS Component 薄壳 ← 用户脚本继承
        ↕ 一对一关联 ScriptComponent

sprite.jsb.ts / label.jsb.ts / ... ← 禁止脚本继承
        └── 适配 n2d.Sprite / n2d.Label / ... 的原型与序列化元数据
                ↕ 原生绑定实例，一对一关联相应 C++ 组件

C++ NodeActivator + ComponentScheduler
└── 统一调度 Component，调用 Native 实现或 Script 桥接
```

迁移期间，未完成 C++ 实现的内置组件可以临时经 ScriptComponent 执行 TS 回调。原生平台达到最终目标时，ScriptComponent 只承载用户脚本。可通过组件工厂注册和帧回调轨迹核对：所有已启用的内置组件均构造为对应的 C++ 类型，其启停与逐帧更新直接进入 C++ 实现。

这里有两种不同的对应关系：Native 类型按 `sprite.jsb.ts ↔ Sprite.h/.cpp` 一一对应，实例使用已有绑定身份映射；脚本类型无需生成对应 C++ 类，多个用户脚本类型共用 ScriptComponent。两条路径都不创建“JS 包装对象再持有另一个 Sprite 对象”的双实例结构。

| 对象 | 主要职责 | 不承担的职责 |
| --- | --- | --- |
| Component | Node 关联、enabled、有效性、一次性标志、实例 ID、执行元数据 | JS 字段、脚本类型反射 |
| Sprite 等 Native 组件 | 直接继承 Component；C++ 生命周期、业务逻辑和类型信息 | NativeComponent 中间基类、JS 生命周期覆盖 |
| ScriptComponent | JS 实例关联、回调检测和调用、异常桥接、引用清理 | 独立的生命周期状态机 |
| Node | 组件所有权、增删和查询、挂载入口 | 自行决定 start/update 顺序 |
| NodeActivator | 节点层级激活、批次初始化、嵌套激活/停用 | 每帧更新队列 |
| ComponentScheduler | 启停登记、一次性与持续回调队列、排序、帧内延迟入队 | JS 类构造和反序列化 |
| Native 组件 JSB 薄壳 | 直接导出绑定类型，适配原型与属性，接入 TS 序列化器并补齐类特有的读写逻辑 | 单独继承 JS Component、额外 Native 实例、生命周期调度 |
| 脚本 Component 薄壳 | 用户继承入口、公共 API、ScriptComponent 实例桥接 | Native 组件的包装基类、另一套调度器 |

所有生命周期操作在引擎脚本/场景主线程执行。其他线程必须提交命令到该线程；不得直接修改组件数组或调用脚本。

## 4. C++ 对象模型

### 4.1 Component 基类

建议 Component 继承现有 CCObject，复用引用计数和对象状态。迁移中需审查现有派生类、绑定 finalizer 和创建方式，避免重复引用计数基类或改变所有权后泄漏。

概念接口如下，不是可直接编译的头文件：

```cpp
enum class ComponentKind { Native, Script };

class Component : public CCObject {
public:
    Node* getNode() const;
    bool isEnabled() const;
    void setEnabled(bool value);
    bool isEnabledInHierarchy() const;
    ComponentKind getKind() const;
    bool destroy() override;

protected:
    // 仅生命周期管理器可分发；不导出为脚本可调用 API。
    virtual void invokePreload();
    virtual void invokeOnLoad();
    virtual void invokeOnEnable();
    virtual void invokeStart();
    virtual void invokeUpdate(float dt);
    virtual void invokeLateUpdate(float dt);
    virtual void invokeOnDisable();
    virtual void invokeOnDestroy();

    Node* _node{nullptr};                 // 非 owning
    bool _enabled{true};
    // 生命周期标志使用 CCObject 的同一份存储。
    // 执行顺序、回调能力、调度登记信息由 Native 管理。
};
```

分发接口与业务实现入口分离，具体可使用 protected 虚函数和 friend 管理器。派生类只实现回调，不能自行维护 load/start/enable 完成状态或登记队列。

生命周期能力使用位掩码表达，至少包含 Preload、OnLoad、OnEnable、Start、Update、LateUpdate、OnDisable、OnDestroy。没有 update 的组件不进入 update 队列；不能因基类有空虚函数就把全部组件逐帧调度。

Sprite 等 C++ 组件显式声明能力；ScriptComponent 检测 JS 实例及原型链上的实际方法。初次检测在用户构造完成后、激活之前进行。可保留 ComponentKind 作为元数据或诊断信息，但不以它替代虚函数分发，也不引入 NativeComponent 类。

### 4.2 身份与类型

区分三类信息，不能共用一个整数：

- 实例身份：稳定 Component ID；映射现有 `_id/uuid` 和序列化引用。
- Native 类型：注册表分配的类型 ID、基类关系、工厂与能力元数据。
- Script 类型：JS 构造函数/类 ID 及继承关系；多个脚本类型可以共用一个 C++ ScriptComponent 类。

执行顺序在实例登记时从类型元数据读取。持续调度队列的同序比较需保留旧 `_id` 字符串比较语义，不能未经验证改为数值递增序号。

## 5. Node 组件数组与 API

### 5.1 所有权

Node 采用项目已有强引用指针容器持有 `Component`，例如 `ccstd::vector<IntrusivePtr<Component>>`；实际类型以 RefCounted 约定为准。Component 到 Node 为非 owning 引用。

激活任务、更新遍历和延迟销毁任务必须保证待调用对象在使用期间存活。移出队列不等于立即析构；回调栈和 JS 引用仍可能持有对象。

原 `_uiComponents` 不再作为第二份 owning 集合。迁移期可保留按类型访问的非 owning 索引，添加/移除统一从 Component 数组入口维护；纯 Native 组件也必须进入主数组。

### 5.2 创建与挂载

统一流程：

1. 解析类型，校验已注册的 jsb 原生绑定类型或 JS Component 派生类。
2. 按现有规则处理 requireComponent、重复组件限制及错误报告。
3. Native 路径通过注册工厂创建实际 C++ 类型，并返回其唯一 jsb 绑定实例；脚本路径创建 JS 实例并关联一个 ScriptComponent。
4. 完成构造、默认属性和必要绑定；反序列化走批量恢复流程。
5. 设置 Node 关联，加入 C++ 数组，建立查询与包装映射。
6. 按兼容顺序发出 COMPONENT_ADDED；若节点已激活且组件已就绪，进入 C++ 激活流程。

构造或绑定失败必须回滚，不能留下半挂载组件。公开 API 不支持将同一个组件实例直接改挂另一 Node；跨 Node 的组件迁移不属于本设计。

挂载不自动等价于 onEnable。attach/detach 是内部关联动作，不作为公开生命周期回调，不能触发另一条启停路径。

### 5.3 查询与脚本视图

| 调用 | 目标行为 |
| --- | --- |
| `addComponent(Sprite)` | Native 工厂创建 C++ Sprite，返回对应的 n2d.Sprite 绑定实例 |
| `addComponent(PlayerController)` | 创建 JS 用户实例和 ScriptComponent，返回原用户实例 |
| `getComponent(Sprite)` | 依 Native 类型及继承关系查询 |
| `getComponent(PlayerController)` | 依 JS 类型及继承关系查询 ScriptComponent |
| `getComponent(Component)` | 按统一数组顺序查询两种组件 |
| `getComponents(...)` | 保留统一挂载顺序，映射为 JS 对象 |
| `node.components` | 只读视图或版本化快照，不暴露可写 Native 容器 |

数组包装可按组件集合版本缓存；不能每帧为调度构造 JS 数组。`getWritableComponents()` 等内部入口需逐项迁移，不能让调用方继续通过 push/splice 改变旁路集合。

## 6. 生命周期状态与语义

### 6.1 状态存储

复用 CCObject 的 IsPreloadStarted、IsOnLoadStarted、IsOnLoadCalled、IsOnEnableCalled、IsStartCalled、ToDestroy、Destroying、Destroyed 等标志，保持与现有 JS 位值的兼容映射。

JS 的 `_objFlags`、`_enabled`、`_isOnLoadCalled` 兼容接口必须读写同一权威状态。普通调用方只能通过 enabled/destroy 改变生命周期；反序列化及复制使用专门的恢复入口，避免恢复字段时提前启用。公共标志兼容 setter 必须隔离生命周期位，不能允许 JS 意外覆盖 Native 调度状态。

区分：

- `enabled`：组件自身配置。
- `enabledInHierarchy`：按现有 API 由自身 enabled 和节点层级 active 计算。
- 已启用调度状态：以 IsOnEnableCalled 及队列登记信息判断。
- 待销毁：ToDestroy；普通 isValid 与严格 isValid 的结果不同。

这些概念不可合并成一个 bool。例如调用 destroy 后，enabled 属性不必变为 false，但组件已退出调度。

### 6.2 激活

节点第一次激活时，即使组件 enabled 为 false，仍按现有语义处理 preload/onLoad；onEnable、start 和持续更新受启用条件约束。

一次子树激活任务先递归收集，随后分阶段执行 preload、onLoad、onEnable。不能改成逐组件执行全部回调。动态 addComponent 在活动节点上的立即激活继续保留其现有行为，不能将批次屏障解释为跨所有重入操作的绝对屏障。

维护激活任务栈。回调停用节点时，取消各层未执行且失活的任务，并按旧实现清理相应 started 标志。保留 Deactivating 防护、原始组件数量边界、子树遍历和事件通知顺序。

### 6.3 启停与回调重入

enable/disable 由管理器统一操作，联动生命周期回调、定时器 pause/resume 和调度队列。启停回调返回后重新核对对象、节点和待执行任务，不继续使用回调前的状态假设。

现有 enable 代码在 onEnable 返回后设置完成标志，部分自禁用、异常和嵌套启停行为存在细节。P0 必须先记录行为；迁移保持已验证语义。若要修正现有缺陷，应单列行为变更与测试，不在移植时静默更改。尤其不能直接用一个“更合理”的新状态机替代当前规则而声称完全兼容。

### 6.4 执行顺序与队列修改

- preload 使用原遍历顺序，不引入执行顺序排序。
- onLoad/onEnable/start 使用负、零、正执行顺序分组；非零组按现有规则排序。
- update/lateUpdate 的非零组保留执行顺序与实例 ID 比较规则。
- 零顺序组保留原登记及快速移除行为，不额外承诺稳定顺序。
- Native 与 Script 必须在同一顺序体系中交错执行，不能按组件种类分两批。
- 回调新增、禁用、销毁组件时，迭代位置和待执行任务随之调整；使用可变迭代器或等价安全机制。
- 延迟入队去重，并可在停用/销毁时取消；不能留下旧任务导致再次启用后重复执行。

### 6.5 帧阶段

保持 Director 当前相对顺序：

```text
BEFORE_UPDATE
  Native ComponentScheduler.startPhase()
  Native ComponentScheduler.updatePhase(dt)
  systems.update(dt)
  Native ComponentScheduler.lateUpdatePhase(dt)
AFTER_UPDATE
  组件/对象延迟销毁提交
  systems.postUpdate(dt)
BEFORE_DRAW → 渲染
```

startPhase 保留当前补调新组件 start 的处理边界；不能随意改为无限排空新增任务。update/lateUpdate 中新启用的组件在 lateUpdate 结束后登记并执行对应 start，其 update/lateUpdate 从后续帧开始。更深层嵌套新增情况以 P0 trace 和现有实现为准。

迁移期间由 TS Director 在现有阶段调用 C++ 调度器，保留暂停、reset、场景切换和 purge 的行为。最终由 C++ 推进场景切换、激活及组件帧阶段，脚本通过 Director API 发起操作、订阅事件。切换驱动方时须同时替换旧入口，保持每帧只推进一次，并维持系统更新、脚本事件与绘制的相对顺序。

### 6.6 异常

ScriptComponent 桥接必须区分调用失败与脚本异常，按现有路径上报、清理异常状态，保证后续允许执行的回调继续运行。现有批量 onLoad/start 的异常补写完成标志与直接调用路径可能不同，必须分别对齐，不能一律重试或一律吞掉。

C++ 回调遵守引擎现有异常策略，不依赖跨 JSB 栈展开 C++ 异常。任何异常路径都必须恢复激活任务栈、迭代状态及临时引用。

## 7. 销毁与跨语言引用

### 7.1 逻辑销毁和内存释放分离

组件 destroy 请求由 C++ 接收：去重、设置待销毁、按现有时机 disable 并退出调度，再进入权威延迟队列。普通和严格 isValid 保持现有差异。

提交销毁时：

1. 幂等防护，确保已退出激活/更新/延迟登记任务。
2. 取消该组件定时器。
3. 按现有规则保证 onDisable；仅在 IsOnLoadCalled 时执行 onDestroy。
4. 回调执行期间保留 Node 关联、JS 实例和所需 Native 资源。
5. 从 Node 数组及索引移除，解除关联，完成对象标志和 JS 字段清理。
6. 释放桥接保活及任务引用；最终析构由剩余引用决定。

节点销毁继续保留当前 children/components 的处理相对顺序以及 Node 事件顺序。内部销毁遍历应有稳定引用，不能因回调移除元素而跳过下一个组件。

onDestroy 中再次 destroy 其他对象时，遵守延迟队列本次提交边界；不因为容器增长而自动处理所有新对象。Node 内部立即销毁是显式路径，需要与普通延迟队列区分并保证去重。

### 7.2 与现有 CCObject 的集成

Native CCObject 已有延迟队列，但 `destroy()` 当前包含“TS 已设置 ToDestroy 时直接返回”的兼容逻辑。不能仅将 Component 改为继承 CCObject 后沿用旧 JS destroy 流程。

新 Component 的 JS destroy 直接委托 Native，由 Native 完成置位和入队；不再进入 TS `objectsToDestroy`。非组件对象在过渡期仍可使用原 TS 流程，提交入口必须明确各自负责的对象集合和相对顺序。

P0 对组件与 Node、其他 CCObject 混合销毁记录 trace；P5 实现统一协调提交顺序。若分队列不能满足原顺序，应由共同序号/统一提交器协调，不能简单先排空一类再排空另一类。

`node.jsb.ts` 中原组件 `_destroyImmediate()` 循环必须移除或变为唯一 Native 入口的适配，禁止双重提交。析构函数不调用脚本生命周期；VM 关闭之后不得回调 JS。

### 7.3 引用与 GC

- ScriptComponent 在组件有效挂载、等待回调或待销毁期间保活 JS 实例；不可只保存无保护的裸 `se::Object*`。
- JS 包装关联 Native 对象时遵循现有私有对象和引用计数约定；全程维持一对一身份映射。
- 明确 JS→Native 与 Native→JS 可能形成的引用环，在逻辑销毁时断开，而非等待 GC 自动打破。
- 创建失败、反序列化回滚、场景切换、引擎 reset 和 VM shutdown 均必须释放保活和回调缓存。
- 有 JS 引用的已销毁包装可以继续存在，但保持无效状态；不得访问已经释放的 Node 或恢复调度。
- Native 包装可按绑定系统规则惰性创建；同一时刻仍有 JS 引用时，重复查询返回同一对象。

## 8. JSB 薄壳与禁止 Native 继承

### 8.1 脚本入口

Native 构建新增 `component.jsb.ts` 并配置替换，作为公共组件 API 与用户脚本继承入口。保留 `cc.Component` 的类身份、装饰器入口、脚本继承链和现有常用 API；生命周期属性读取 Native 状态，用户方法由 ScriptComponent 桥接。Native 组件各自的 `.jsb.ts` 直接导出并适配绑定构造器，例如 `n2d.Sprite`。

```ts
class PlayerController extends Component {
    update (dt: number) { /* 用户逻辑 */ }
}

const sprite = node.addComponent(Sprite);
sprite.color = color;

// Native 目标禁止：
class CustomSprite extends Sprite {}
```

用户构造函数执行期间只分配未就绪的 Native 代理；不能调用用户生命周期。构造后再检测能力并挂载。若支持直接 `new Component()`，也必须保持未挂载状态，不得自动进入更新。

### 8.2 Native 组件薄壳：沿用 Asset/Material 绑定适配模式

参考当前实现：

- `cocos/asset/assets/asset.jsb.ts` 直接操作 `jsb.Asset.prototype`，通过 `_ctor`、属性描述符和 mixin 适配 JS 行为，导出 `Asset = jsb.Asset`，调用 `patch_cc_Asset` 注入元数据。
- `cocos/asset/assets/material.jsb.ts` 直接操作 `jsb.Material.prototype`，导出 `Material = jsb.Material`，在 `_ctor` 中调用 Asset 的 JS 初始化并通过 `patch_cc_Material` 注入元数据。
- `native/cocos/core/assets/Asset.h` 的 Asset 继承 CCObject；`Material.h` 的 Material 继承 Asset。对象和继承由 Native 实现，JS 文件不重新声明一套对应类。

组件沿用这种“绑定类型即导出类型”的模式。上述 Asset/Material 文件使用的是原型增补和元数据 patch，并非直接提供现成的 Component 原型重接代码；组件继承链适配需要按实际生成绑定单独实现。

`sprite.jsb.ts` 的概念结构如下。`patch_cc_Sprite` 由组件元数据生成器提供，所需参数以实际生成结果为准。

```ts
import type { Sprite as TSSprite } from './sprite';
// 导入公共 Component 适配，保证原型及元数据初始化顺序。
import '../../scene-graph/component';

const spriteProto = n2d.Sprite.prototype;
// 在现有绑定原型链上适配公共 API、属性描述符、JS 缓存和序列化。
// 不声明 class Sprite extends Component，不持有另一个 _native Sprite。
// 原型重接保留所有实际 Native 基类的绑定方法与类型信息。

export type Sprite = TSSprite;
export const Sprite: typeof TSSprite = n2d.Sprite;
// patch_cc_Sprite({ Sprite, ...序列化依赖类型 });
```

原型适配要求：

1. 保留绑定对象的 private native 指针、finalizer 和类型转换信息；不能通过替换原型丢失原生基类方法。
2. 将公共 Component API、类 ID、属性装饰器及序列化元数据接入绑定原型链；若绑定已建立正确链，只增补所需成员，不重复重接。
3. JS `_ctor` 只初始化序列化辅助字段、事件/资源适配和缓存，按继承链恰好执行一次；不创建第二个 C++ 实例，不维护第二份 enabled/node/flags。
4. 从 C++ 创建后首次暴露给 JS 的组件同样完成幂等的薄壳初始化，不能假定一定经过 JS 构造入口。
5. 元数据 patch 绑定到实际导出的 jsb 类型。不得将完整 TS Component 原型整体复制进来，以免重新引入 TS 调度和销毁。
6. `node.getComponent(Sprite)` 返回的对象与序列化引用、事件参数及先前查询返回的对象保持一致。

公共 API/元数据的原型适配与允许脚本派生是两件事：Native 组件可具备 Component 的实例关系，但它仍不是合法的用户脚本基类。`instanceof Component`、`instanceof Sprite`、`Constructor<T>` 声明及类注册应在 P0/P2 结合绑定验证。公共 Component 类型的构造入口根据实际脚本派生类型创建 ScriptComponent，不能因为重接原型而为 n2d.Sprite 分配 ScriptComponent。

脚本 API 不公开 Native 生命周期执行入口，也不读取绑定实例上的同名 JS 方法来分发生命周期；修改原型不能改变 C++ 生命周期分发。

禁止继承采用多层校验：

1. Native 绑定类型在注册表标记为禁止脚本继承；实际 C++ 类型元数据作为依据，不依赖可篡改的 JS 字段。
2. JSB 构造入口拒绝派生构造，Node 工厂只接受精确注册的绑定类型。反序列化允许构建未挂载绑定实例，但不能绕过派生检查。
3. JS 类注册、装饰器和 addComponent 检查构造/原型链，拒绝将 Native 类型的脚本派生类登记为 ScriptComponent。
4. 反序列化按受控注册表创建，校验类 ID 与绑定类型一致。
5. 类型声明和构建检查尽早诊断非法 extends；TS 不能可靠表达所有 final class 约束时，以构建检查和运行时拒绝兜底，不为此引入另一套 Native 类型令牌对象。
6. 错误包含 Native 类型名、用户类名和“改用组合访问”的迁移建议。

JavaScript 可能允许执行一条 class 声明而未实例化；要求是在可检测的注册/构造/挂载边界确定拒绝，不能仅依赖 TS 的编译期限制。

### 8.3 动态脚本方法

不在 Native 每帧遍历中查找全部 JS 属性。回调能力在构造完成及必要的类型变更时刷新；实际调用须保留当前 this 与方法替换语义。

现有测试会在实例创建后赋值生命周期方法。P0 明确原型/实例方法替换的支持边界；支持范围内通过变更通知、能力刷新或等价机制更新登记。不能直接永久缓存初始函数而静默破坏已有行为。未迁移测试框架前不得以关闭这些测试作为完成条件。

### 8.4 薄壳覆盖范围：Asset、Node、Component 体系

2D 渲染及相关依赖清单见 [2D 渲染对象与依赖范围](native-2d-class-scope.md)。原 [对外类盘点](native-public-class-inventory.md) 及 [inventory JSON](native-public-class-inventory.json) 保留作通用 API 索引，不再作为所有类都要补薄壳的任务清单；可通过 `node scripts/audit-public-classes.cjs` 重新生成。

需要薄壳的对象按继承体系识别，而非仅看是否从 exports 导出：Asset 及资源子类、Node 及 Scene 等子类、Component 及渲染/布局/用户脚本组件。脚本组件仍通过公共 Component 薄壳与 ScriptComponent 桥接，不为每个用户脚本生成引擎 `.jsb.ts` 文件。

上述体系中纳入本期的公开引擎类提供对应薄壳模块。已废弃组件、兼容组件及别名、实验性组件均排除在迁移和验收范围之外。M0 的 `NativeUITransformPoc` 和 `NativeSpritePoc` 属于实验性组件，正式的 UITransform 和 Sprite 仍按第 11 节迁移。已有聚合 `index.jsb.ts` 可以保留为重导出入口；同一类的多个导出名不重复分配 Native 类型或实例。内部渲染类、gfx 对象、数学与事件类型继续使用现有绑定或 TS 实现，不因是依赖对象就强制增加独立薄壳。EventHandler 等参与序列化但不属于上述继承体系的辅助对象保留现有适配即可。

有 C++ 实现的类沿用 Asset/Material 的绑定原型适配方式。仍由 TS 实现的类可以在过渡薄壳中显式复用 TS 实现，不虚构 `jsb.XXX` 或宣称已 Native 化。薄壳存在、Native 替换配置已接入、Native 实现存在和符合目标设计，是四个不同的验收项。Native 组件禁止脚本继承；其他类的继承能力按各自 API 契约定义。

## 9. 序列化、Prefab、定时器和平台边界

### 9.1 序列化与复制

**保存。** 对公开的 Native Asset、Node、Component 及其子类，各自的 `.jsb.ts` 在绑定类型上注册现有类 ID、属性名和序列化元数据。TS 序列化器按这些元数据读取薄壳暴露的属性。Node 薄壳按 C++ 组件数组的顺序提供组件引用，组件与资源沿用现有实例 ID 和资源引用格式。普通字段复用通用读写逻辑。类有自定义格式时，在薄壳原型补齐 `_serialize`、`_deserialize`，可参照 [SpriteFrame 薄壳](../cocos/2d/assets/sprite-frame.jsb.ts)。用户脚本的装饰字段仍由 TS 序列化器读写。

**恢复。** TS 反序列化器按类 ID 分配绑定实例或用户脚本实例，借助薄壳恢复字段、解析跨对象引用并应用 Prefab 覆盖。薄壳通过绑定 setter 写入已解码的值和对象引用，按记录顺序挂载到 C++ Node。C++ 只接收运行时值和挂载操作。恢复期间写入 `enabled` 不触发 `onEnable`。对象图、组件数组与依赖装配全部就绪后，才允许 C++ 按节点的实际激活状态统一调度。实例化或克隆时重新建立生命周期状态、队列登记和脚本句柄。

**Camera 与 Canvas。** Camera 薄壳负责相机配置及 `targetTexture` 资源引用的读写，Canvas 薄壳负责 `cameraComponent` 的可空组件引用。先恢复引用，再允许 Canvas 的 preload 使用相机。仅因 Canvas 依赖而自动补齐的 RenderRoot2D 不生成独立记录，由加载流程重建。显式添加的 RenderRoot2D 正常保存并在加载时复用。

未知类型、缺失脚本、恢复异常必须沿用缺失组件处理策略并回滚 Native 引用，不能部分激活场景。

### 9.2 定时器

首期 `schedule/scheduleOnce/unschedule` 可以保留现有 JS Scheduler，C++ 对 ScriptComponent 启停和销毁通过窄桥接执行 resume/pause/unschedule。Native 组件的 jsb 绑定实例使用同样的目标身份适配，防止公共定时器 API 出现两种行为。

本期“完整生命周期下沉”包括定时器启停和销毁责任，不要求将通用定时器容器迁移到 C++。Native Scheduler 已存在但不能替代 ComponentScheduler 的阶段和排序规则。未来迁移通用定时器时需另行处理 JS 回调身份、取消和引用管理。

### 9.3 平台与继承兼容性

Web 和编辑器继续使用 TS 存储及调度；Native 构建替换入口不得污染 Web 路径。编辑器到 Native 的构建校验应提前报告继承目标 Native 类型的脚本，而非只在真机加载时失败。

Native 类型清单必须显式维护，并用于工厂、声明和构建诊断。首期只将 Sprite 加入直接绑定清单。后续按第 10 节逐项加入剩余 9 个目标组件，仍由 TS 实现生命周期的内置组件继续经 ScriptComponent 执行。若某 TS 内置组件在脚本继承链上依赖已 Native 化基类，则必须一并 Native 化或改为组合；不能借“引擎内置”豁免脚本不可继承约束。

禁止继承属于明确的兼容性变更：已有 `extends Sprite/Label/...` 用户代码改为独立 Component，在 onLoad 中获取被访问组件。组合组件需要的初始化先后关系通过执行顺序或业务就绪接口表达。

## 10. 组件分类与文件改动清单

### 10.1 直接导出原生绑定

本期暂缓 SpriteRenderer 和 ModelRenderer。Sprite 使用的纹理、图集和材质随 Sprite 试点验证，字体随 Label 验证。资源由 Asset 体系管理引用和释放，Node 的组件数组只登记 Component。资源的类元数据和必要的自定义读写由 JSB 薄壳提供。[资源逐类清单](native-2d-implementation-matrix.md#纹理图集字体与材质)

首期迁移 Sprite。P6 迁移 UITransform、UIOpacity、Label、Graphics、Mask、RichText、RenderRoot2D，并新增 Camera、Canvas 两个组件的 C++ 实现。前八个 2D 类型已有 `n2d` 绑定。Camera 组件拟新增 `jsb.CameraComponent` 绑定，供 `cc.Camera` 使用。 Canvas 拟绑定到 `n2d.Canvas`，以 `cc.Canvas` 公开。

| 组件 | Native 直接导出 | TS 薄壳文件 | C++ 文件及迁移重点 |
| --- | --- | --- | --- |
| Sprite | `n2d.Sprite` | `cocos/2d/components/sprite.jsb.ts` | `native/cocos/2d/components/Sprite.h/.cpp`。用统一工厂创建，迁移节点、材质、SpriteFrame 和渲染登记逻辑 |
| UITransform | `n2d.UITransform` | `cocos/2d/framework/ui-transform.jsb.ts` | `native/cocos/2d/framework/UITransform.h/.cpp`。接通尺寸、锚点、变更事件及 Node UI 属性查询 |
| UIOpacity | `n2d.UIOpacity` | `cocos/2d/components/ui-opacity.jsb.ts` | `native/cocos/2d/framework/UIOpacity.h/.cpp`。将应用和清除透明度状态纳入启停与销毁 |
| Label | `n2d.Label` | `cocos/2d/components/label.jsb.ts` | `native/cocos/2d/components/Label.h/.cpp`。在激活前恢复字体及材质状态，销毁时释放渲染资源 |
| Graphics | `n2d.Graphics` | `cocos/2d/components/graphics.jsb.ts` | `native/cocos/2d/components/Graphics.h/.cpp`。组件实例在属性恢复前创建，几何数据仍可按需分配 |
| Mask | `n2d.Mask` | `cocos/2d/components/mask.jsb.ts` | `native/cocos/2d/components/Mask.h/.cpp`。通过统一查询关联 UITransform 与 Graphics，清理 stencil 状态及内部渲染数据 |
| RichText | `n2d.RichText` | `cocos/2d/components/rich-text.jsb.ts` | `native/cocos/2d/components/RichText.h/.cpp`。接通布局、字体及图片资源，审计内部 Label/Sprite 对象池的所有权与复用 |
| RenderRoot2D | `n2d.RenderRoot2D` | `cocos/2d/framework/render-root-2d.jsb.ts` | `native/cocos/2d/framework/RenderRoot2D.h/.cpp`。由 C++ 生命周期管理 Batcher2d 根节点注册，与 Canvas 组合改造同批落地 |
| Camera | `jsb.CameraComponent`（拟新增） | `cocos/misc/camera-component.jsb.ts`（新增） | 新增 `cc::CameraComponent : public Component` 及工厂注册。组件持有 `cc::scene::Camera`，供 Node 挂载并接受统一生命周期调度 |
| Canvas | `n2d.Canvas`（拟新增） | `cocos/2d/framework/canvas.jsb.ts`（新增） | 新增 `native/cocos/2d/framework/Canvas.h/.cpp`，实现 `cc::Canvas : public Component`。相机对齐、依赖装配和生命周期在 C++ 执行 |

每个目标组件直接继承 C++ Component，并登记工厂、回调能力与类型元数据。TS 薄壳复用绑定构造器并补齐原型、幂等 `_ctor` 和序列化元数据。移除旧包装类的 `_native` 或 `_nativeRoot`、TS 生命周期转发及旁路挂载。资源恢复在 onLoad 前完成，依赖 JS 的资源操作经明确的服务入口执行。`getUIComponent(typeId)` 由统一组件查询或其维护的索引提供。

首期 Sprite 依赖尚未直接迁移的 UITransform，应经统一查询及过渡适配取得其原生数据。P0 同时审计 `Mask.h` 内嵌的 Sprite 和 `RichText.cpp` 内部池化的 Label/Sprite。内部渲染对象由所属组件管理，需随 Component 所有权迁移调整存储方式。只有作为真实 Node 组件挂载的对象才进入统一组件数组和调度，避免内部渲染对象因复用组件实现重复登记。

### 10.2 通过 ScriptComponent 接入

Native 目标下，用户脚本及仍在 TS 实现生命周期的内置组件，每个 JS 实例关联一个 C++ ScriptComponent。原 JS 实例保留类名、类 ID、装饰器和业务字段，C++ 在统一阶段调用其回调。`component.jsb.ts` 提供公共 `cc.Component` 继承与桥接入口。

| 类型 | 接入方式及需要检查的文件 |
| --- | --- |
| 用户脚本 | 通过新增的 `cocos/scene-graph/component.jsb.ts` 接入，核对 `cocos/scene-graph/index.jsb.ts` 的出口。直接或间接继承已 Native 化组件的脚本应改为继承 Component，并通过查询访问目标组件 |
| 保留 TS 实现的内置组件 | 包括 `Layout`、`Widget`、`Button`、`Toggle` 及仍由 TS 实现的动画、音频、物理组件。经公共入口统一桥接，逐项审计直接读取旧生命周期标志、写入 Node 组件数组或手动调度的调用点。 |
| TS UIRenderer 及派生类 | `MotionStreak`、`ParticleSystem2D`、Spine `Skeleton`、DragonBones `ArmatureDisplay`、`TiledLayer` 经 TS UIRenderer 进入 ScriptComponent。共享渲染能力及查询兼容按第 10.4 节处理 |
| 缺失脚本 | `cocos/misc/missing-script.ts` 接入缺失类型恢复规则。 |

P5 期间仍采用旧 JSB 包装的组件，也按脚本路径登记。其内部 `n2d` 对象通过过渡适配提供渲染和数据能力，每个逻辑组件只由其 ScriptComponent 登记和调度。对应类型完成直接导出后，移除该类型的过渡适配。

### 10.3 C++ Canvas 对 Camera 和 RenderRoot2D 的依赖

Web 侧 `Canvas extends RenderRoot2D`。Native 侧沿用同节点组合约定，新增 `cc::Canvas`，在组件工厂和 `native/tools/swig-config/2d.i` 注册。`canvas.jsb.ts` 直接导出 `n2d.Canvas`，通过原型与元数据适配保留 `cc.Canvas`、`cameraComponent`、`alignCanvasWithScreen`、执行顺序 100、单实例约束及旧场景字段。`cc.config.json` 的 Native 替换与 RenderRoot2D 切换一起启用。

- Canvas 通过统一依赖装配入口取得同节点的 RenderRoot2D。动态添加和旧场景、Prefab 恢复使用同一装配规则，在激活前复用已有显式组件或补齐一个运行时依赖。补齐的依赖进入 Node 的 C++ 组件数组，可由组件查询取得。保存时沿用 Canvas 的序列化记录，加载时据此重建运行时依赖。显式 RenderRoot2D 按原格式保存。
- RenderRoot2D 负责 Batcher2d 的根登记。Canvas 的 C++ 启停和销毁只联动由它补齐的根。显式根保留自身 enabled 和所有权。切换前验证根登记按 Node 去重。
- CameraComponent 是可空的序列化引用，允许位于其他节点。恢复该引用后，Canvas 在 preload 按需触发幂等的相机创建。替换或释放引用时解除旧相机订阅。销毁 Canvas 后，相机仍按其自身生命周期运行。
- 将对齐逻辑移至 C++。当相机存在且启用屏幕对齐时，屏幕输出使用 `screen.windowSize.height / view.getScaleY() / 2` 计算正交半高，RenderTexture 输出使用 `visibleRect.height / 2`。相机节点的世界坐标取 Canvas 的 x、y 和当前约定的 z=1000。保留 renderMode 对 Camera.priority 的兼容行为。
- 通过窄接口读取 view/screen 的度量并接收窗口、设计分辨率变化。已有 Widget 时，preload 调用其 updateAlignment。目标纹理变化复用 Camera 的通知，订阅从 preload 到 enable 须幂等，停用、换相机和销毁均按订阅所有权清理。Canvas 薄壳负责类型及序列化适配。
- 验证旧场景仅有 Canvas、Canvas 与显式根共存、空相机、跨节点相机以及 Prefab 克隆。原 Canvas 引用仍指向 Canvas，`getComponent(RenderRoot2D)` 返回组合中的根组件。

### 10.4 UIRenderer 的共享实现与查询

保留 `cocos/2d/framework/ui-renderer.ts` 和 `cocos/misc/renderer.ts` 中可派生的 TS 基类。`n2d.UIRenderer` 作为现有 Native 绑定的过渡依赖。C++ Sprite、Label、Graphics 在各自迁移时直接继承 Component，将颜色、材质、priority、混合参数等共享实现从 `native/cocos/2d/framework/UIRenderer.h/.cpp` 提取为可组合的渲染逻辑。共享逻辑由具体组件持有，生命周期登记由具体组件负责。先为 Sprite 接通，再用于 Label、Graphics。

- 为已迁移 Native 渲染组件适配公开渲染 API 和 Node UI 属性。重点检查 `cocos/2d/framework/native-ui-materials.ts`、`cocos/scene-graph/node-ui-properties.ts`、2D assembler 和渲染数据调用点。
- 在统一组件类型匹配中维护 TS UIRenderer 对这些 Native 具体类型的查询兼容，覆盖按构造器或类名查询与 `requireComponent(UIRenderer)`。用 `cocos/ui/button.ts`、`cocos/sorting/sorting-2d.ts` 及 TS UIRenderer 的子节点查询验证。P0 确认 `instanceof UIRenderer`、声明类型和构建诊断的兼容边界。

### 10.5 公共改动清单

| 范围 | 文件和改动 |
| --- | --- |
| 对象、所有权与脚本桥 | 改 `native/cocos/core/component/Component.h/.cpp`、`native/cocos/core/data/Object.h/.cpp` 和 `native/cocos/core/scene-graph/Node.h/.cpp`。新增 `native/cocos/core/component/ScriptComponent.h/.cpp`，接入 JS 实例保活与释放、回调检测、工厂、统一数组和延迟销毁 |
| JSB 入口和类型 | 新增 `cocos/scene-graph/component.jsb.ts`，改 `cocos/scene-graph/node.jsb.ts`、`cocos/scene-graph/index.jsb.ts`、`cc.config.json` 和 `@types/jsb.d.ts`。将组件创建、查询、移除、数组写入和销毁收口到 Native。保留类 ID 与装饰器 API |
| 自动及手写绑定 | 改 `native/tools/swig-config/2d.i`、`native/tools/swig-config/scene.i` 和 `native/cocos/bindings/manual/jsb_scene_manual.cpp`。核对 `native/cocos/bindings/manual/jsb_module_register.cpp` 中 Scene 和 2D 模块的注册顺序，确保 Node 组件 API 能取得正确的绑定及基类原型。由 `native/CMakeLists.txt` 接入新 C++ 文件并重新生成绑定 |
| 激活和帧阶段 | 在 `native/cocos/core/component/` 加入 NodeActivator、ComponentScheduler，将 Node、Scene 的启停和销毁接入统一管理器。以 `cocos/scene-graph/node-activator.ts` 和 `cocos/scene-graph/component-scheduler.ts` 为行为基线，改 `cocos/scene-graph/scene.jsb.ts` 及 `cocos/game/director.ts` 的 Native 调用入口，保留阶段顺序 |
| 元数据、序列化和 Prefab | 扩展 `scripts/generate-native-2d-decorators.cjs` 并更新其生成的 `cocos/native-binding/decorators-2d.generated.ts`。检查 `cocos/core/data/class.ts` 和 `cocos/core/data/decorators/ccclass.ts` 的注册校验，改 `cocos/serialization/deserialize.ts`、`cocos/serialization/deserialize-dynamic.ts`、`cocos/serialization/instantiate.ts`、`cocos/serialization/instantiate-jit.ts` 及 `cocos/scene-graph/prefab/utils.ts` 的相关恢复和写入入口。完成属性、跨组件引用和依赖装配后再激活 |
| 定时器与旧调用点 | 由公共 Component 薄壳和 Native 阶段入口适配现有 JS Scheduler 的 pause/resume/unschedule。审计 `getWritableComponents()`、`_components`、`getUIComponent()`、`_uiComponents` 及生命周期标志的调用方，按统一数组或过渡索引迁移 |

## 11. 分阶段实施计划

阶段按依赖推进，不给出未经验证的周数承诺。每阶段独立可审查；运行模式在启动时选择，不能在活动场景内切换。开关名 `NATIVE_COMPONENT_LIFECYCLE` 为建议名称。

| 阶段 | 前置 | 主要交付 | 验收门槛 |
| --- | --- | --- | --- |
| P0 行为基线与边界确认 | 无 | 生命周期 trace、类型/继承依赖清单、API 与绑定验证 | 已知语义及差异均可复现；关闭开关无行为变化 |
| P1 C++ 对象与 Node 存储 | P0 | Component/ScriptComponent、Sprite 直接继承 Component、强引用数组、工厂及查询 | 纯 C++ 创建/挂载/移除/失败回滚和引用测试通过 |
| P2 JSB 实例与 API | P1 | Component 薄壳、Sprite 原型适配、稳定绑定身份、禁止继承、属性恢复 | 两类组件 API、脚本继承、序列化身份及拒绝路径通过 |
| P3 C++ 激活与启停 | P2 | NodeActivator、激活栈、事件及定时器桥接 | preload/load/enable/disable trace 对齐，无重复回调 |
| P4 C++ 帧调度 | P3 | 排序队列、延迟登记、Director 适配 | 混合组件顺序、start 边界、暂停/reset 和异常行为通过 |
| P5 销毁与首期验收 | P4 | 销毁协调、GC 清理、同节点 Sprite 与普通脚本集成 | Sprite 直接绑定和普通脚本经 ScriptComponent 进入同一 C++ 生命周期，从创建到销毁验证通过 |
| P6 迁移剩余 9 个组件与平台验证 | P5 | 直接绑定清单扩展、Canvas 组合、UIRenderer 兼容、平台及性能报告 | 10 个目标组件全部通过，Web/编辑器回归通过 |
| P7 默认启用与收尾 | P6 | 默认配置、迁移说明、旧路径清理 | 验收签收；发布回退可执行；无双重状态和调度 |

### P0：基线和最小验证

- 复用 `tests/core/test-component-scheduler.js`、`test-component.js` 和 requireComponent 测试，形成可在 JS/Native 两端运行的场景描述与回调日志。
- 日志至少包含帧号、阶段、稳定组件 ID、节点 ID、回调、关键 flags、启用/有效状态与事件。
- 覆盖直接调用和批量调用的异常差异、自禁用、嵌套激活、动态方法替换及混合销毁顺序。
- 对照 Asset/Material 验证 JSB 脚本派生代理、n2d.Sprite 原型适配、元数据 patch 和稳定身份。确认公共 API 声明与不可继承检查的实现方式。
- 列出原 `_components/getWritableComponents/_uiComponents` 的所有写入口与目标组件的脚本派生链。记录 Sprite 对 UITransform 的依赖、Mask/RichText 的内部渲染对象、Canvas 的继承依赖以及 UIRenderer 的兼容查询。
- 记录性能基线，指定项目代表场景和可接受阈值，之后不以“应该更快”替代测量。

### P1：对象与存储

- 改造 `native/cocos/core/component/Component.h/.cpp`，新增 ScriptComponent 定义及模块构建配置，让 Sprite 直接进入 Component 继承体系。
- 为 Node 增加权威数组、内部 attach/remove/query、集合版本和安全销毁遍历。
- 准备 CCObject 标志映射及生命周期元数据，验证旧 2D 对象的所有权过渡。
- 本阶段不开启产品运行时替换；通过独立 Native 测试验证新对象模型。

### P2：薄壳和实例身份

- 新增 `cocos/scene-graph/component.jsb.ts`，在 `cc.config.json` 中按功能开关配置替换。
- 按 Asset/Material 模式建立 Sprite 薄壳，适配原型、直接导出 n2d.Sprite、接入幂等 `_ctor` 和装饰器/序列化 patch。验证 Sprite 工厂和 Node 查询返回同一个 JS 绑定实例。
- 修改 `node.jsb.ts`，通过 Native 数组读取组件；实现工厂、JS 实例登记和失败回滚。
- 完成 Native 不可继承校验、类型声明、错误信息和序列化/复制的就绪屏障。
- 为未迁移 TS 内置组件接入 ScriptComponent，保证其 JS 字段和方法仍在原实例上。
- 开关关闭时，现有类型导出和构建结果保持原行为。

### P3/P4：生命周期执行

- 新增 C++ NodeActivator 和 ComponentScheduler；按基线移植队列和状态更新时机。
- Node 的 ActiveNode 事件适配改为新管理器入口，关闭原 TS 激活回路，保留业务通知。
- Director 在原阶段位置调用 Native 阶段接口；通用系统更新仍保持现有位置。
- P3/P4 只在受控测试配置开启；在 P5 销毁接通前不得用于默认产品运行。
- 每次运行只启用一套执行器；可对两次独立运行的日志做差分，不能让两套执行器对同一实例真实回调。

### P5 销毁与 Sprite 加普通脚本首期验收

- 完成 Component destroy、CCObject 协调提交和 Node 递归销毁，移除旧 JS 组件销毁循环。
- 完成 ScriptComponent 保活、销毁解绑、异常退出和 VM shutdown 清理。
- 使用两个 Sprite 引用同一 SpriteFrame，并从 SpriteAtlas 按名称取帧。场景或 Prefab 重载后，三处应指向同一资源实例；销毁其中一个 Sprite 后，另一个仍应正确绘制。
- 在真实 Native JSB 运行时，同一 Node 挂载直接导出的 Sprite 和一个普通 `extends Component` 的测试脚本。脚本具备 onLoad、start、update、lateUpdate、启停和销毁回调，使用现有 UITransform 兼容路径提供 Sprite 的渲染依赖。
- 对照 C++ 与 JS 回调日志，验证同一组件集合和调度器、符合基线的激活及执行顺序、每次转换的回调次数。验证直接绑定与脚本实例均保持查询和 Prefab 引用身份，序列化恢复先于激活。
- 覆盖暂停、启停切换、组件和节点销毁、场景切换及 GC。验证渲染与资源恢复，以及销毁后的调度、引用和资源清理。P5 验收通过后再启动 P6。

### P6 迁移剩余 9 个组件

1. 先迁移 UITransform、UIOpacity，接通节点尺寸、事件与透明度状态，收口 Sprite 使用的 UITransform 过渡入口。
2. 再迁移 Label、Graphics，复用 Sprite 已验证的 C++ 共享渲染逻辑和 UIRenderer 查询适配。Label 用 TTFFont、BitmapFont、LabelAtlas 分别恢复场景，验证具体资源类型、位图字体帧引用和字形度量。
3. 迁移 Mask、RichText。Mask 依赖 UITransform、Graphics 和 Sprite 渲染能力，RichText 依赖 UITransform、Label 和 Sprite 渲染能力。验证内部渲染对象和池化对象释放。
4. 新增 Camera 组件与直接绑定。按 `camera-component.ts` 移植投影、视口、角度转换、裁剪面、清屏、可见层、优先级、曝光、后处理、RenderTexture 切换及坐标转换 API。C++ 在 onLoad 创建后端，在启停时挂入或移出 RenderScene，在销毁时解除纹理订阅并释放后端。Canvas 可能提前调用 `_createCamera()`，该入口与 onLoad 复用同一个后端实例。
5. 在 `cc.config.json` 登记 Native 替换。薄壳直接导出新增绑定，注册 `cc.Camera` 元数据、静态枚举和 `CameraEvent`，保留 `camera` getter 对既有 `jsb.Camera` 后端的访问。验证 Prefab 恢复和 `getComponent(Camera)` 的实例身份，以及禁止脚本继承。
6. 完成 RenderRoot2D 的直接绑定、同节点根装配及去重验证。它和 CameraComponent 可分别验收。两项通过后新增 C++ Canvas 和直接绑定，并在同一构建切换 Canvas 与 RenderRoot2D。对照第 10.3 节验证屏幕/离屏对齐、引用替换、连续启停及场景切换。

每组迁移复用 P5 的混合场景验收，加入对应资源和依赖回归，并移除已迁移组件的旧包装路径。
- 在项目支持的桌面及移动 Native 平台上执行正确性、GC、泄漏、性能和构建验证；实际平台集合记录在报告中。
- 检查 Web/编辑器未被 Native 替换规则和声明变更破坏。
### P7 默认启用与发布

达到门槛后默认开启，保留发布级构建回退，稳定后再移除过渡兼容代码。

## 12. 测试矩阵与完成标准

| 分类 | 必测案例 |
| --- | --- |
| 首次激活 | 活动/失活节点添加；disabled 组件首次 load；子树分批阶段；无回调组件 |
| 启停重入 | onLoad 禁用自身/节点；onEnable 修改 enabled；onDisable 改父子关系；嵌套激活取消 |
| 更新 | start 一次；无 start 组件正常 update；start/update/lateUpdate 新增和删除；混合顺序 |
| 排序 | 负/零/正执行顺序；同序 ID 比较；零组移除；Native/Script 交错 |
| JS 桥接 | this、异常续跑、方法替换、用户脚本多层继承、绑定身份、无回调能力 |
| Native 薄壳 | 导出类型等于 jsb 类型；Component 原型关系；元数据 patch；C++ 创建后首次包装；`_ctor` 幂等；无额外 Native/ScriptComponent 实例 |
| 禁止继承 | 直接/间接 extends Native；绕过装饰器；Reflect.construct；伪造绑定类型；反序列化非法类 |
| 序列化往返与恢复 | 用旧场景及 Prefab 验证加载、保存、重载后的字段、组件顺序及引用身份。覆盖脚本字段、克隆、enabled 恢复、缺失脚本、失败回滚和 requireComponent，并检查首次生命周期回调看到完整对象图 |
| 销毁 | load 前销毁；重复 destroy；回调内销毁；组件与节点混合队列；onDestroy 访问 Node |
| 内存 | GC 压力；Node 唯一所有者；持有已销毁包装；场景反复切换；VM 退出 |
| 定时器 | 启停 pause/resume、onEnable 内 schedule、scheduleOnce、按回调取消、销毁清理 |
| 生命周期集成 | P5 同节点 Sprite 和普通脚本全链路，Director 暂停、reset/purge、场景切换、节点事件、渲染前资源释放 |
| 内置组件兼容 | P6 目标 9 个组件资源恢复与启停，UIRenderer 查询和 requireComponent，Canvas 旧场景与 Prefab 恢复、根登记去重 |
| 平台 | Web/编辑器原路径；Native 新路径和回退构建；目标绑定后端 |

现有 `native/tests/unit-test/src/component_test.cpp` 中示例测试处于注释块，不能作为已有可运行覆盖；需要新增实际可执行的 Native 测试。纯 C++ 测试之外必须有真实 JSB 集成测试，才能覆盖 GC 和跨语言回调。

完成标准：

1. 除已明确批准的禁止 Native 脚本继承等变更外，生命周期与事件 trace 对齐；差异逐项说明。
2. 生命周期标志、Node 组件集合、调度登记和延迟销毁均无双重权威。
3. Native 生命周期没有 JS 包装转发；脚本生命周期不被重复调用。
4. 有效挂载的脚本组件不被 GC，销毁后引用可释放，无悬挂 Node 和循环保活泄漏。
5. 目标 Native 组件无需 JS 用户对象也能完成 C++ 生命周期；需要资源服务的依赖有明确接口。
6. Web、编辑器和 Native 构建/运行验证通过，兼容性迁移提示可提前发现非法继承。
7. 性能报告分别覆盖纯 Native、纯脚本和混合场景，记录 CPU、跨语言调用次数、分配及内存；满足 P0 约定阈值。

## 13. 风险与回退

| 风险 | 应对 |
| --- | --- |
| 激活/重入语义变化 | P0 trace 基线，按阶段差分，修复与移植分开 |
| 双重回调或销毁 | 单执行器模式、调试断言、迁移后删除原入口 |
| JS/Native 引用环 | 逻辑销毁显式解绑，GC/退出测试，统计未释放实例 |
| Native 禁止继承破坏旧代码 | 类型清单、构建诊断、组合访问迁移示例 |
| TS 内置组件继承已 Native 化基类 | 迁移前扫描依赖闭包，一并迁移或改为组合 |
| flags/数组旁路写入 | Native 权威、写入口收口、调用点审计 |
| 脚本 update 桥接成本 | 无回调不登记，减少额外 getter/桥接，按场景测量 |
| 平台替换影响编辑器 | 构建范围隔离，分别验证导出、声明和数据格式 |

回退以构建/启动模式为单位，重新加载场景；不迁移正在运行的 Component 实例。新旧构建都读取同一序列化格式。

禁止继承规则属于 Native 目标的产品约束。回退不得静默放宽该规则；原生访问包装及必要的组合迁移可保留。旧调度回退只用于仍可运行的兼容实现，若某组件已删除旧实现则需回退对应发布版本，不能宣称仅翻转开关即可恢复。

## 14. 非目标与待验证事项

非目标：用户脚本 C++ 编译、Web 生命周期下沉、完整编辑器重写、通用 Scheduler 全量下沉、活动场景热切换执行器，以及 Native 组件的脚本继承支持。

不影响架构方向、但 P0/P2 必须验证的事项：

- jsb 原生类型直接导出、原型适配与 Constructor<T>、instanceof、元数据生成器的兼容表达；不引入额外类型令牌或继承式包装类。
- 现有 CCObject 标志暴露方式、JS 清理流程及混合销毁提交次序。
- 动态生命周期方法替换的能力刷新机制。
- Sprite 首期及后续 9 个目标组件的完整继承依赖和序列化入口清单，特别是 Canvas 组合装配和 UIRenderer 类型兼容。
- 支持平台、性能阈值和过渡开关的实际构建配置。

上述事项应产生可审查的验证结果；不能在未验证时将接口草图标记为已实现能力。
