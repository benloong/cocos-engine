# Native 2D M6 剩余任务与终态验收

> 更新：2026-11-13。范围沿用[总计划](./native-2d-module-sinking-plan.zh-CN.md)，仅 `cocos/2d` 及必要的 native/绑定/构建支持。
> 状态：**未收口**。M2、M3、M4、M5 的阶段通过记录不代表整个模块满足终态薄壳契约。本文按当前代码和既有报告整理，未新增原生运行、跨平台或性能通过结论。
> 本文是 M6 剩余任务与终态门禁的统一清单；历史数据保留在各阶段 report/gate 中。

## 1. 已有基础与验收边界

| 阶段 | 已有记录 | 留给 M6 的边界 |
|---|---|---|
| M0/M1 | PoC、UITransform/UIOpacity、Node 槽位、生命周期和场景/prefab 验证 | 扩展稳定性、线程与平台覆盖，复核稳态调用数 |
| M2 | Sprite 五模式、材质实例、Web/native golden、阶段性能 KPI | 全量 API/资产行为、终态薄壳、跨平台和混合负载 |
| M3 | Windows Label TTF/BMFont、缓存、布局、Outline/Shadow | 平台字体矩阵、复杂文本、字体资产生命周期 |
| M4 | Windows Mask 与 Graphics 基础功能 | Graphics 三角化/GPU buffer、完整描边语义、Web 对照、性能 |
| M5 | Windows RichText 场景对照、RenderRoot2D | RichText 解析/布局仍在 JS；多 root/Camera 兼容回归 |

资产绑定已调整为：`SpriteFrame = jsb.SpriteFrame`、`SpriteAtlas = jsb.SpriteAtlas`，直接修改原生 prototype；`_ctor` 调用 Asset 初始化。SpriteAtlas 已移除 `ensureNative/_nativeAtlas` 包装，原生方法在覆盖前保存。该改造已有 JS mock 验证，仍需原生资产加载、克隆和销毁回归。

## 2. 剩余任务

任务按 M6.0 → M6.1/M6.2/M6.3 → M6.4 → M6.5 推进。测试夹具与指标采集可随实现补齐；最终证据必须来自同一候选版本。所有未勾选项均待完成或待提供证据。

### M6.0 范围、API 与证据基线

- [ ] 为每个迁移类建立 Web/native parity 矩阵：公开/兼容 API、枚举与静态字段、序列化字段/默认值、生命周期、可变值对象、资产依赖、测试入口。
- [ ] 逐项复核 M0–M5 遗留项；已关闭项链接实际报告，未关闭项归入下列任务，不能靠阶段标题自动关闭。
- [ ] 审计 `.jsb.ts`、native override 和间接 import，记录算法残留、材质选择、状态镜像、稳态 JSB 调用及壳体积。
- [ ] 关闭已观察到的壳残留：Label `lateUpdate` 在 RESIZE_HEIGHT 模式逐帧读取 native 高度并更新 UITransform；Label/Graphics 的 JS 壳仍获取内置材质。将尺寸联动与材质解析迁入 native，或以实测和契约逐项证明仅为允许的低频桥接。
- [ ] 明确 decorator 生成器的维护入口；补齐新类元数据生成/校验和 CI。生成器未确认前保留可复现的显式注册，不手工改生成文件冒充生成流程。

交付：组件矩阵、残留清单、基线版本/环境/命令和原始数据。

### M6.1 资产与状态一致性

- [ ] SpriteFrame：将 `_calculateUV/_calculateSlicedUV` 的计算迁入 native；核对 rotated、flip、insets、pivot、meshType、packable、clone/reset 及静态 API，补缺失行为与用例。
- [ ] SpriteFrame：明确 rect/offset/originalSize 等可变对象的读写契约。setter、直接修改返回值、反序列化、克隆、动态合图与 native 回读保持一致；JS 镜像不能成为第二份权威状态。
- [ ] SpriteAtlas：依赖反序列化完成后，JS `spriteFrames` 与 native 命名 frame 表一致。覆盖 map 直接赋值/修改、同名替换、null、remove/clear、getTexture、加载与释放；当前 `_deserialize` 仅登记 JS map 依赖，不能视为 native 表已同步。
- [ ] 验证两个 prototype 资产的构造身份、Asset 初始化、ccclass/属性元数据、实例间独立状态与原生回调；保存的原生方法必须在同一实例上调用且无递归。
- [ ] TTFFont/LabelAtlas/BitmapFont：逐类确认 native 所需数据、所有权和释放边界；需要时补 native 字体字节/句柄/图集支持。允许 JS 保留序列化壳，但不能保留 native 渲染需要的逐帧资产处理。
- [ ] 动态合图：确认迁移范围、纹理/UV 更新和回退策略，验证 Sprite/Label/Mask 联动。按需迁移项须有范围结论与证据，不能默认为完成。
- [ ] 补旧资产/场景/prefab 加载、instantiate/clone、延迟依赖解析、重复加载释放的原生回归。

交付：资产 parity 报告和真实资源回归日志。prototype 改造本身不等于资产下沉验收完成。

### M6.2 RichText 达到终态薄壳

- [ ] HTML 解析、样式继承、分段、测量、换行/对齐和布局迁入 native；新增 native RichText 实现及 `.jsb.ts` override，JS 只保留元数据、序列化、生命周期和 API/事件桥接。
- [ ] 段对象创建、复用、布局与销毁由 native 编排，避免 JS 逐段/逐字驱动；保持 JS 用户事件回调与公开 API 行为。
- [ ] 将现有 color/b/i/u、size/br/outline、img/imageAtlas、contentSize、hit/miss 用例迁为固定 Web/native 回归；补 shadow、嵌套样式、复杂对齐/最大宽度、动态更新、点击事件分发与销毁后解绑。
- [ ] 保留 Windows GDI italic 宽度的已接受差异；平台、字体、用例、布局容差分别记录。现有 colored ±20% 只作 sanity，不能替代布局、字形、事件验收。

交付：native 解析/布局测试、场景对照、壳审计。M5 的文本/图片渲染闭环继续有效，不能用它替代本项。

### M6.3 Graphics/Mask 完整性（承接 M4.3）

- [ ] 用 native 路径三角化、顶点/索引及 GPU buffer 提交替换固定 256×256 CPU RGBA + 内部 Sprite 的兼容路径；覆盖缩放、大尺寸、复杂/多子路径。
- [ ] 补 lineJoin/lineCap/miterLimit；为 roundRect、ellipse、arc、曲线、填充/描边、clear 建立独立 Web/native 用例。
- [ ] 对比逐 API JSB 与命令批量提交的 CPU、调用次数、分配和绘制成本；用数据选择接口。JS 允许纯命令收集，不允许路径算法/三角化。
- [ ] 验证 Mask 四类形状、inverted、嵌套与 stencil 恢复、alphaThreshold、segments、尺寸和资产动态切换，补混合 Sprite/Label/Graphics 场景。
- [ ] 复核 Graphics/Mask 的材质选择归属、stencil material 和所有权；补 draw call、合批、纹理上传量与性能报告。

交付：M4.3 补充报告、像素对照与性能结论。兼容光栅化基础通过不等于本项完成。

### M6.4 事件、生命周期与硬化

- [ ] hit test：覆盖 Camera/坐标转换、旋转缩放、层级、多个 root、嵌套 Mask、启停与销毁；JS 可分发事件，几何命中使用 native。
- [ ] RenderRoot2D：补多 root/多 Canvas/多 Camera、顺序、启停、重复注册、销毁/场景切换回归；Canvas/Camera/Widget/View 继续保留 JS，不迁移其功能。
- [ ] 所有 native 组件/资产核对 attach/detach、Node 非 owning 槽位、RenderEntity/DrawInfo、纹理、字体缓存及回调所有权。
- [ ] 主线程修改与渲染线程读取的快照/同步边界明确；覆盖场景切换、异步资源完成、禁用后销毁。
- [ ] 连续加载/卸载 1000 次，无新增泄漏/崩溃；采集 native/JS 堆、引用数和 GC，支持的平台执行 ASan/LeakSanitizer 或等价工具并记录覆盖限制。
- [ ] Win/macOS/iOS/Android/OHOS 的 Debug/Release 构建和关键渲染/字体/事件场景逐格验收；没有运行证据的格子标“待验证”。
- [ ] 验证模块裁剪/构建组合，覆盖 2d、rich-text、mask、graphics 及现有相关开关；不扩大不下沉模块的范围。

交付：平台矩阵、生命周期/泄漏/线程报告和可定位的失败项。

### M6.5 性能、回退与最终 Gate

- [ ] 固定候选版本、场景、硬件、构建模式、预热/采样方法，与 Web/迁移前基线同口径对照；覆盖 1000 Sprite、200 Label、50 Mask、RichText 及混合负载。
- [ ] 达成总计划 KPI：2D 组件准备/更新与合批 CPU 时间下降 ≥50%，每帧 JSB 调用下降 ≥70%，JS 堆峰值下降 ≥30%，GC 改善；native `Batcher2d` 成本必须纳入，不能以 JS update 直接返回作为收益。
- [ ] 迁移组件稳态每帧 JSB 调用 0；属性变更、生命周期和用户显式 API 调用单独统计。常规壳 ≤300 行，Label/RichText ≤500 行（按总计划排除版权、纯类型、deprecated 转发）；超限先移除算法，不能仅压缩排版。
- [ ] 扩展现有 `check-thin-shell.js` 等检查，覆盖全部迁移类和间接热路径；CI 执行 Web TS/Jest、native TS、native 构建与组件/场景回归。
- [ ] 按组件/模块演练回退，验证 override、依赖资产、材质与旧场景可用；回退后记录行为与性能。
- [ ] 汇总 `native-2d-m6-gate.md`：每个任务、平台、指标均链接候选版本的日志/产物；失败和未验证项不能记作通过。

交付：性能报告、回退记录、M6 Gate。原计划 4–5 周是早期估算，未包含当前列出的全部 M4/M5 终态欠项；完成 M6.0 后重新排期。

## 3. 终态验收标准

| 门禁 | 必须满足 | 不足以判定通过的证据 |
|---|---|---|
| 范围与 API | 冻结范围内逐类 parity，旧场景/prefab/资产、公开 API 与用户脚本兼容 | 仅 smoke 或方法存在 |
| 薄壳 | 元数据/序列化、生命周期、API/事件桥接；无 UV/几何、文本/HTML、材质选择算法或第二份权威状态 | 只改 prototype 或只满足行数 |
| 原生热路径 | native 准备、几何/文本/材质与提交闭环，稳态每帧 JSB 0 次 | JS 调用 native，但仍在 JS 逐段布局 |
| 视觉与事件 | Sprite/Graphics 通道容差 1；文本按记录的布局/字形/基线容差；事件序列一致 | colored 非零、面积或 ±20% sanity 单项 |
| 图形完整性 | Graphics 三角化/GPU 提交和描边语义，Mask 混合/嵌套/恢复正确 | 256×256 兼容光栅化探针 |
| 性能 | 上述 ≥50% CPU、≥70% JSB、≥30% JS 堆目标及 GC 数据 | M2 ≥30% 阶段 KPI 或单一空闲场景 |
| 稳定性与平台 | 1000 次加载卸载、无新增泄漏/崩溃、线程边界、全平台 Debug/Release 矩阵 | 仅 Windows 功能通过 |
| 工具链与回退 | 绑定/元数据可复现、CI/裁剪组合通过、组件/模块回退演练 | 手工补元数据后本机可运行 |

全部阻断项通过后才能将 M6 和整个 Native 2D 下沉标为终态完成。任何新增容差或范围豁免必须明确记录用例、影响和决策；尚未确认的差异继续列为待处理。

## 4. 范围保持不变

- JS Component 身份、生命周期调度、注册和序列化保留；完整 Component 下沉不进入 M6，参见[评估结论](./native-2d-m6-component-eval.md)。
- `cocos/ui` 不迁移；Canvas/Camera/Widget/View、UIMeshRenderer/UIMesh/UISkew 保持 JS；弃用的 UIStaticBatch 不实现。
- Web 实现保留完整功能；native 差异通过 override 接入。历史实现中为 parity 修改过的 Web 行为仍需回归，不能据此放宽 Web 兼容要求。
