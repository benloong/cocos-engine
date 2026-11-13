# M6 Component 基类下沉评估

> 结论：**技术上可行，但不建议现在做**。native `cc::Component` 只有 55 行；JS `Component` 有 728 行，并承担生命周期、调度、注册、序列化和编辑器语义。直接做薄壳会破坏组件系统。

## 1. 现状

### native

```text
native/cocos/core/component/Component.h   55 行
```

只有：

- `Node* _node`；
- `bool _enabled`；
- `onAttach/onDetach/onEnable/onDisable`；
- `getTypeId`。

Node 侧只有 **非 owning 的 UI component 槽位**：

```cpp
getUIComponent(typeId)
addUIComponent()
removeUIComponent()
```

没有完整组件注册表、组件数组或生命周期调度。

### JS

```text
cocos/scene-graph/component.ts  728 行
```

负责：

- `_isOnLoadCalled`；
- `enabled/enabledInHierarchy`；
- `onLoad/start/update/lateUpdate/onEnable/onDisable/onDestroy`；
- 执行顺序；
- `ComponentScheduler`；
- `Node` 的组件挂载/移除；
- `destroy/isValid`；
- 序列化/编辑器；
- 事件与 `_objFlags`。

## 2. 下沉需要补齐

| 模块 | 现状 | 下沉工作量 |
|---|---|---|
| Component 身份/类型 | JS ccclass | 高 |
| 组件注册表 | JS Node._components | 高 |
| 生命周期调度 | JS ComponentScheduler | 高 |
| enabledInHierarchy | JS | 中 |
| destroy/isValid | JS | 中 |
| 执行顺序 | JS | 中 |
| 序列化/编辑器 | JS | 高 |
| 事件/组件 API | JS | 中 |

## 3. 方案

### A. 保持 JS Component 身份（推荐）

- JS 继续负责生命周期/注册/序列化；
- native 组件继承 `cc::Component`；
- native 只维护 node/enabled 和渲染状态；
- 现有 Sprite/Label/Mask/Graphics/RenderRoot2D 已经这样做。

收益：零破坏，继续做 M6 其他硬化。

### B. native Component 适配层

- native Component 增加 `setEnabled` 回调；
- JS Component 在 onEnable/onDisable 转发；
- 不下沉注册表/调度。

收益：有限；当前 native 组件壳已经手动转发，收益主要是统一。

### C. 真正 Component 基类下沉

需要：

1. native 组件注册表；
2. native 生命周期调度；
3. Node 组件数组；
4. enabledInHierarchy；
5. destroy/isValid；
6. 执行顺序；
7. 序列化入口；
8. JS `component.jsb.ts` 薄壳。

风险：

- 组件生命周期错序；
- 编辑器/预览不兼容；
- 序列化丢失；
- 脚本组件（用户脚本）无法 native 化；
- 与 `cocos/ui` 的 Component 混用。

## 4. 工作量估算

```text
A：0
B：1~2 周
C：6~10 周（不含跨平台和编辑器）
```

C 还会阻塞：

- M6 平台矩阵；
- 内存/GC 检查；
- 用户脚本兼容性。

## 5. 建议

```text
采用 A
不采用 C
B 只在出现重复转发痛点时做
```

M6 优先做：

1. 跨平台构建/渲染矩阵；
2. 内存/泄漏；
3. 性能 KPI；
4. 回退开关。

Component 基类下沉作为 **M7/独立重构**，不要混入 2D 下沉收口。

## 6. 决策

- native Component 已有，2D 组件已继承；
- JS Component 薄壳暂不做；
- 保留 JS Component 身份；
- 本文作为 M6 评估结论。
