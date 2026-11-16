# M6.0 Native 2D 资产元数据生成入口

更新：2026-11-16。

历史 native-binding/decorators.ts 的外部生成器没有在本仓库找到；本节点不推断其归属，也不重写历史 3D/光照等补丁。新增仓库内入口 scripts/generate-native-2d-decorators.cjs，负责 Font、TTFFont、BitmapFont、LabelAtlas、SpriteAtlas、SpriteFrame 六个迁移资产。组件壳继续由源码上的 TypeScript 装饰器注册，无需另一个 patch 生成器。

## 维护方式

1. 元数据源是 cocos/2d/assets 中对应 Web 类的声明、装饰器和字段初值。修改序列化契约时先修改这些声明。
2. 执行 `node scripts/generate-native-2d-decorators.cjs`，生成 cocos/native-binding/decorators-2d.generated.ts，并将源码和产物一起提交。
3. 各 JSB 资产仍从 native-binding/decorators 导入 patch_cc_*；该文件只重导出生成后的 2D 补丁。历史六个手写补丁已移除，避免双份注册。
4. 执行 `node scripts/generate-native-2d-decorators.cjs --check` 验证产物没有过时。native-ts-build CI 和本地 run-m0-checks.ps1 均执行检查及生成器测试。

生成器按 TypeScript 的实际逆序装饰器调用顺序输出。字段使用初值工厂，保持 native prototype 访问器的序列化字段身份；真正的 accessor 使用 descriptor。依赖类型通过 ctx 注入，不 import Web 资产构造器，以免绕过 native override 或引入运行时循环。

当前支持 ccclass、serializable、editable、type、string、override；支持字面量、正负数字和 js.createMap() 默认值。新增不支持的装饰器、类型表达式或初值会明确失败，必须扩展生成器并补测试后才能生成，不会静默忽略新字段。未来增加迁移资产时扩展 ASSETS 清单。

## 验证

- Node 原生测试 4 项通过：产物确定性/一致性、初值工厂与类型注入、访问器与顺序、未知元数据拒绝。
- 现有真实 core 元数据 Jest：字体资产、SpriteAtlas 和 SpriteFrame 壳 17 项通过，覆盖 ccclass、序列化字段、实例独立状态、构造和依赖回填等行为。
- 常规 TypeScript 检查通过。此节点无 C++ 改动，不重跑已通过的原生构建来代替元数据语义验证。

本节点关闭新增 2D 资产的生成/校验入口欠项。其他历史模块的生成器归属不在本次 2D 范围内；完整资产/旧场景加载仍按 M6.1 验收。
