# M6.1 BMFont 配置源字号与元数据分离

> 2026-11-17。继续完成 BitmapFont/LabelAtlas 资产与 Label 的状态一致性，完整 M6 仍未收口。

## 差异与修复

Web 的 BMFont TextProcessing 使用 fntConfig.fontSize 计算字形 scale，公共 fontSize 是独立的序列化元数据。原生 Label 此前从 BitmapFontAsset.getFontSize 取源字号，公共元数据与配置不同或配置源字号重载时会错误缩放。

BitmapFontAsset 现以值成员保存配置源字号和存在标志；getFontSize 的默认值、零值、小数及序列化行为保持原有语义。配置显式提供源字号时，Label 的布局与测量使用该值；缺少该字段的旧配置保留公共字号/既有行高回退。配置解析先校验源字号及全部 glyph/kerning，成功后一起提交；非数值、非有限或超出 float 范围的配置源字号被拒绝且不改变数据与 revision。配置删除或 clearNativeData 同步清除源字号存在状态。

原生 Label 继续检测字体 revision；配置重载不需要重设 Label.font 或逐字形 JSB 传输。配置源字号是字体资产拥有的值，Label 只读取并用于原生布局，没有引入共享指针或新的 JS 权威镜像。

## 验收

原生 PoC 覆盖公共元数据 -1/0/64 与配置源字号 4 的独立性、源字号改为 8 后既有 Label 的尺寸更新、非法配置的原子回滚、删除配置字段后的旧数据回退，以及清空资产后源字号状态释放。另验证显式零/负源字号时渲染与测量均为空，旧 GPU 提交清除后可通过有效配置重载恢复。

真实 BitmapGpuProbe 沿用 76 组布局矩阵，将公共 fontSize 固定为 64，配置源字号默认 16，并在行距/SHRINK 换行用例中分别重载为 32/8；四种字体/旋转组合全部覆盖。Web 显式刷新 assembler，native 依靠资产 revision 更新；比较内容尺寸、actualFontSize、字形数、配置源字号与公共元数据字号，以及实际 RGBA。保留 12 组字体合图和 12 组 Sprite/Mask 对照、70000 字形 GPU 提交与清空检查，M5 预算仍为 45 秒。

构建与完整门禁按[统一文档](./native-2d-build-and-acceptance.zh-CN.md)执行，最终证据见[验收数据](./native-2d-m6.1-bitmap-source-size-results.json)。

最终候选完整串行门禁通过：M0（末尾 8 suite/33 tests）、独立 M2/M3/M4/M4 extra/M5、UV 和定向 Jest（6 suite/32 tests）。76 组布局（源字号 16/32/8 分别 68/4/4 组）、12 组字体合图及 12 组 Sprite/Mask 图像均与 Web 字节一致；M5 保持原 45 秒预算。原有六份测试入口 cwd 改动未纳入本节点，输入哈希保存于结果。

## 边界

该节点不替代任意旧资产/Prefab/bundle 管线、异步/延迟释放、复杂 Unicode、trim/offset/mesh、自动合图/回退、长期内存、性能及跨平台验收。显式非正配置源字号不会用于除法或生成非有限几何；其非法字体内容不认定为完整 Web 视觉兼容。缺少源字号的旧配置回退属于已有兼容路径，不能用于证明合法 BMFont 配置在 Web 中可省略源字号。未在本节点运行 Release 或 ASAN。

## 已绑定 Label 的配置重载

Web 的 `BitmapFont.onLoaded()` 替换资产此前加载的字形，再通知正在使用该字体的 Label 重新排版。调用方提供的 FontAtlas 保留自己写入的字形。Label 停用、换字体或销毁时解除订阅。JSB 的 `onLoaded()` 在提交配置后也发布通知，供 Windows 的 TS Label 回退路径使用。

使用旧 Open Sans XML FNT 和序列化 Label Prefab，先替换 `AV` 字距与 `2` 的步进，再原地移除 `V` 并重载，最后停用 Label、恢复原配置并重新启用。旧 Chrome 在第一步仍显示 40 像素宽。修复后 Windows Debug、Release 和 Chrome 均得到 40、42、37、40 像素，恢复图与初始图逐字节一致。163 张图三端一致，160 张既有图的哈希与上一候选相同。[逐配置记录](./native-2d-m6-bitmap-config-reload.json)
