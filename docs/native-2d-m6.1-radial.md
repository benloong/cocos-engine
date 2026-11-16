# M6.1 Sprite radial 几何与 fillCenter

更新：2026-11-16。修复 native radial 的中心坐标、角度方向、三角边界及 UV，使 CPU 几何与实际 Web assembler 对照一致。本节点不替代 GPU 像素、动态合图、完整场景或跨平台验收。

## 实现

- native 使用归一化 fillCenter，按内容尺寸和 anchor 转换到本地坐标；正范围从 +X 逆时针展开，负范围移动起点后生成同一区间。
- 用矩形边与起止射线的交点生成三角形，替换固定采样扇形。保留 Web 在边界上的退化三角形及输出顺序，确保拓扑对照有明确基准。
- rotated UV 按帧矩形换算；radial 与 Web 一致，不额外应用 quad flip 标志。
- JS fillCenter 保持 Vec2 身份与方法，通过分量 accessor 读取和写入 native。加载前暂存初值，加载后 native 为权威状态；instantiate 获得独立 Vec2；销毁时将 accessor 还原为普通值，释放外部持有视图对组件的闭包引用，包括尚未创建 native 对象的组件。
- 未引入共享内存或每帧 JS 同步。

## 验证

`native/tests/2d-poc/run-m6-radial-parity.ps1` 生成真实 C++ SpriteGeometry 输出，Jest 调用实际 `radial-filled.ts` 对照，不复制 Web 算法作为预期值。

共 3024 组：3 种尺寸/anchor、9 个中心（含边角及越界）、7 个起点、8 个范围（含零、正负及完整圆）、2 种旋转状态。逐项验证顶点数、三角形索引、坐标与 UV，数值容差 0.0001。动态合图打包在此测试中隔离。

其他入口：

- `run-poc-tests.ps1`：150 项数学/几何检查。
- `run-m6-sprite-api-tests.ps1`：Windows Debug/Release 原生测试与实际 JSB 壳、Sprite/Frame/MaterialInstance 接口回归。覆盖 fillCenter 分量写入、native 回读、加载初值、克隆和销毁解绑。
- native 组件测试额外覆盖 rotated/flip 组合，验证提交的 radial UV 不被二次翻转。
- 常规 TypeScript 配置显式加入 Sprite JSB 后无诊断。

剩余 Sprite 继承材质数组、完整资源/Prefab、GPU 和全平台门禁继续由 M6 计划跟踪。
