# M6.1 Sprite 公共 API、材质与状态同步

更新：2026-11-16。补齐 M6.0 初版发现的六个 Sprite 壳声明缺口，修复材质、引用和几何状态更新问题。字段/接口出现不等于完整视觉 parity；本节点不关闭下方列明的图形、资源与平台门禁。

## 实现

- 补 SpriteType、FillType、SizeMode 的 ccenum 注册、Sprite.EventType / SpriteEventType，以及 cclegacy.Sprite 身份；恢复 spriteAtlas、trim、grayscale、changeSpriteFrameFromAtlas 和 deprecated changeMaterialForDefine。
- fillRange 默认值与 Web 一致为 0；fillStart / fillRange 的公开 setter 按 Web 范围校验，原生 setter 也做边界校验。正负横/纵向条形填充归一化到同一个端点区间；路径/UV 生成仍在 native。
- 字体无关的 SpriteFrame 绑定不再要求 JS 先读到 texture。原生保留未完成加载的 frame，后续 revision/纹理变化在 prepare 中读取。Editor 的 spriteframe-changed 只在真正换帧时分发。
- trim / grayscale 在 onLoad 初始化和属性变更时转发。native 根据纹理格式与灰度选择普通、灰度、分离 alpha、灰度+分离 alpha 四类内置材质；RenderTexture 的内置变体复制时设置 SAMPLE_FROM_RT。自定义材质优先，清空后回到当前内置变体。
- UIRenderer 材质槽持有强引用；父材质更换时清理对应实例。Sprite 的材质实例由真正的 cc::MaterialInstance 创建，支持 slot 0 和其他已存在材质槽、显式 setMaterialInstance/getRenderMaterial。
- MaterialInstance JSB 允许 native 包装器无参调用 _ctor，parent 从保存的原生 Material.parent getter 读取。Sprite 将 owner 作为用户显式 API 桥接设置，并在销毁时解绑，避免销毁后的 PSO 回调继续访问该组件。
- 不改变材质变体的几何更新及 deprecated 刷新保留已有实例。将实例提升为共享材质时，先持有新引用再清理缓存，防止别名指针被提前释放。
- Sprite 同时持有 frame 与 texture；标量旧 API 替换 frame 时释放旧 frame，并清除遗留 insets/flip。赋帧和 prepare 都尊重 disabled 状态。
- 原生 prepare 检查 UITransform 尺寸/锚点及 Node 世界矩阵快照，变化时刷新顶点，不依赖 JS 帧事件；无变化继续使用现有缓存。无效/零填充几何清除旧 DrawInfo，避免旧画面残留。

## 验证

| 入口 | 当前证据 |
|---|---|
| run-m6-sprite-api-tests.ps1 | Windows Debug/Release 构建、实际 Sprite/MaterialInstance JSB 壳 + SWIG 对象、3 个 Jest suite 共 12 项通过 |
| C++ cc2d_native_poc | 四类内置材质、RT 宏、自定义/共享/多槽实例、原生父引用、实例提升/释放、frame/texture 持有释放、禁用状态、尺寸/位置/锚点改变、填充归零/恢复 |
| Jest Sprite 壳 | Web 序列化字段/默认值/枚举对照、trim/grayscale/atlas/事件、标量边界、材质清空、旧记录 Details 回填及 instantiate |
| Jest MaterialInstance | native 无参包装初始化、parent 与 owner、PSO 通知及 owner 解绑 |
| 实际 JSB 探针 | 未加载 frame、后续纹理、atlas 切换、材质与实例、disabled、1000 次属性/帧/材质切换、销毁 |
| run-poc-tests.ps1 | 133 个纯逻辑检查通过，包含负条形填充与正区间的位置/UV 对照 |
| 布局回归 | Debug 的实际 Label/UITransform 探针及 3 组 Jest 共 6 项通过 |
| TypeScript | 常规项目以及显式包含 Sprite/MaterialInstance JSB 的检查通过 |

复现（先构建最新 harness）：

```powershell
& native/tests/2d-poc/run-m6-sprite-api-tests.ps1 -NativeExecutables @(
    'native/tests/2d-poc/native/out/cc2d_native_poc.exe',
    'native/tests/2d-poc/native/out-release2/cc2d_native_poc.exe'
)
& native/tests/2d-poc/run-poc-tests.ps1
```

harness 已按 production 的 assets → scene 顺序注册绑定，确保 MaterialInstance 继承 Material；Windows 断言输出到 stderr 并终止测试，不弹出等待交互的断言窗口。旧的五模式帧测试显式设置非零 fillRange，避免把旧默认值和旧几何残留误当作 Filled 通过。

## 仍待验收

- 格式驱动的材质检查使用真实原生 Material/Texture 对象，但未解码压缩纹理；RT 检查验证宏与材质归属，不能替代 GPU 渲染对照。
- 既有 radial 的中心坐标、正负方向和三角边界需要精确 Web/native 对照；fillCenter 可变值写入语义、完整继承 API/材质数组行为、动态合图与 mesh 继续按 M6.1/M6.5 验收。
- UIRenderer 的 JS 基类仍在范围内审计；本节点没有用叶子壳方法补齐来宣称整个继承链已满足终态薄壳。
- 1000 次属性切换和引用计数回归不等于 1000 次真实场景加载或泄漏工具结论。真实旧场景/Prefab、跨平台与性能 KPI 保持待办。
