# M6.3/M6.4 Mask 圆角状态与原生命中

更新：2026-11-16。本节点补齐 native Mask 的 radius 渲染与世界坐标命中，并把现代 UITransform.hitTest 的 Camera 筛选和祖先 Mask 判断放到原生执行。没有关闭完整 M6.4 事件/平台门禁。

## 数据与行为

- JS radius setter 保留非负约束，加载时与变更时转发到原生。原生拥有 radius，值变化标记 shape dirty；rect 按 `min(radius,width/2,height/2)` 生成 roundRect。尺寸、anchor 和类型变化继续由原生 prepare 检测/重建。
- segments getter/setter 与 Web 一样限制到 3–10000；原生保留自身约束。
- `Mask.isHit(Vec2)` 只转发两个世界坐标标量。原生从当前 Node 的 UITransform 槽位读取尺寸和 anchor，以逆世界矩阵转换坐标，计算圆角矩形或椭圆，再应用 inverted。矩形边界包含、椭圆边界排除，与 Web 保持一致。
- custom/Sprite stencil 的**输入命中采用 UITransform 矩形**，与 Web 现有 isHit 语义一致；不通过路径三角形或纹理 alpha 判断输入命中。渲染仍使用真实 stencil 路径/资产纹理。
- `UITransform.hitTestXY(x,y,windowId=0)` 筛选相同 windowId、可见 layer 和非离屏 Camera。Camera 的 screenToWorld 保持使用既有原生 Camera API；随后检测自身 UI bounds 和全部有效祖先 Mask。JS 不再丢弃 windowId。
- 原生 hitTestWorldXY 可用于已转换到世界坐标的查询。每次查询当前祖先和 Component 槽位；不保存跨事件的父节点/Mask/Transform 指针，因此 reparent、disable、detach 和销毁立即生效。直接 Mask.isHit 不因 enabled 而改变几何结果；UITransform 组合查询会忽略 disabled Mask，保持 Web 语义。
- 原生矩阵不能求逆时返回 false，避免零 scale 使用旧/非逆矩阵产生误命中。极小但非零 scale 的 native inverse 容差与 Web 的完整数值边界仍需专门矩阵验证，不宣告所有浮点输入完全一致。

## 所有权

没有新增 shared_ptr，也没有新增长期借用。radius 为 Mask 值成员，矩阵/点为栈上值；Node/祖先/UITransform/Mask 仅在同步查询期间通过既有非 owning 槽位借用。Node 销毁通知先解除 Component 的 Node 关联；查询缺失 Node/UITransform 时安全返回 false。既有 Mask renderer、材质、帧和源几何所有权保持原约定。

## 验证

- MSVC Debug/Release 真实 C++ harness：圆角中心/角落/边界、半边长限制、圆角网格、尺寸和 anchor 在 prepare 前变化、椭圆边界、自定义/Sprite 矩形命中、非均匀缩放/旋转/位移、嵌套/反向/disable、reparent、零 scale、detach 和 Node 先销毁。
- 两种构建的实际 JSB probe：圆角 Mask 命中、UITransform 祖先查询、默认与显式 windowId 的真实 SWIG 绑定通过。没有只依赖 any 类型检查认定绑定存在。
- 5 个定向 Jest suite 共 13 项通过，验证 shell 加载/更新半径、segments 约束、isHit 委托、销毁后返回 false、UITransform 的 windowId 转发，并回归 Graphics 与空嵌套 stencil。元数据/审计/适配器 Node 测试 10 项通过。
- 常规 tsc、完整 native TS 编译通过。CI 已增加 UITransform shell 入口；远端运行未验证。

既有 GPU 夹具扩展为 **48 个捕获和 19 个命中检查**。在同一源码/夹具快照 `d1109dddc8248cfa133e7a13ff5a6400d812e0eef48b592ad6c9969c22681d91` 上，48/48 图像逐通道最大差值均为 **0**；19/19 命中检查在 Web/native 均符合预期。覆盖新增 radius 设置/更新/限幅、size/anchor 更新、rect→ellipse 切换，以及世界变换、Camera layer、离屏、windowId、嵌套/反向/disable/reparent/销毁后的实际 scene hitTest。见 [完整结果与 RGBA 摘要](./native-2d-m6.4-mask-state-hit-results.json)。

使用 [GPU 复现流程](./native-2d-m6.3-graphics-gpu.md#复现)构建当前夹具；当前比较器要求 48 个图像和 19 个命中结果。raw RGBA、manifest、日志位于忽略目录 `native/tests/2d-poc/build`。Windows native Debug GLES3/PVRVFrame（host RTX 4080）与 Chrome ANGLE/NVIDIA；不是移动设备或所有平台的验收。

本快照仍包含已有未提交 SpriteFrame.native getter 改动，该文件未纳入本节点。此前已定位的“SpriteFrame 无 native 属性”测试失败仍单列，不能把本轮结果认定为完整最终候选版本通过。

## 剩余验收

多 Camera 的互相遮挡/优先级、多个 root、透视 Camera/3D 倾斜与浮点边界、真实触摸/鼠标事件派发、完整组件 API（含 Sprite subComp）、动态资产/材质、线程边界、平台矩阵及 1000 次真实加载卸载仍按 M6 计划推进。本轮只证明上述已执行场景和生命周期用例。
