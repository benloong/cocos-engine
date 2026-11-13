# Native 2D M5.1 RenderRoot2D

> 结论：Windows native RenderRoot2D 下沉通过；Canvas 的 Camera/Widget/适配仍保留 JS。

## 1. 实现

### native Batcher2d

新增：

```cpp
void addRootNode(Node* node);
void removeRootNode(Node* node);
```

维护 `_rootNodeArr`，去重，供 `fillBuffersAndMergeBatches()` 遍历。

### native RenderRoot2D

- `setNode`；
- `setEnabled(true)` → `Batcher2d::addRootNode`；
- `setEnabled(false)` → `removeRootNode`；
- 析构自动注销。

### JS 薄壳

`render-root-2d.jsb.ts`：

- 继承 `Component`；
- `onLoad` 创建 `n2d.RenderRoot2D`；
- `onEnable/onDisable/onDestroy` 转发；
- Canvas 仍继承它，并保留 JS Camera/Widget/适配。

## 2. 验证

M2/M3 渲染路径未变：

```text
M2 pixel probe: PASS
M3 Label probe: PASS
M0 checks passed
Jest: 20 passed
```

M2 五种 Sprite 模式仍为 7936 red pixels。

## 3. 边界

- RenderRoot2D 节点注册已 native；
- Canvas 的 Camera 绑定、设计分辨率适配、Widget 联动仍在 JS；
- 未做多 Canvas/多 Camera 场景级对照。

## 4. 后续与冻结范围

Canvas/Camera/Widget/View 明确保持 JS，不新增 native Canvas，也不迁移设计分辨率适配和 Widget/view 行为。

M6 仅补现有边界的回归：多 RenderRoot2D/Canvas/Camera 的渲染顺序、启停、去重、销毁注销和场景切换，验证 JS Canvas 与 native root 注册兼容。见 [M6.4](./native-2d-m6-plan.md)。
