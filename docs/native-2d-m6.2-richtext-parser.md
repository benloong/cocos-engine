# M6.2 RichText 原生解析实现与对照

更新：2026-11-16。原生 HTML 解析与样式继承已加入引擎构建，现已由 [native RichText 运行时](./native-2d-m6.2-richtext-runtime.md)直接消费并接入 JSB override。原先“尚未接入”的准备阶段状态已更新；完整构建、视觉/场景与终态门禁仍待验收，不认定 M6.2 完成。

## 原生输入模型

`RichTextParser::parse` 返回 C++ `RichTextSpan` 数组，每段包含 UTF-8 文本与可选样式。样式持有 color/size、b/i/u、outline、br、图片 src/尺寸/对齐/offset 和 click/param。结果可直接供 native 布局消费；JSON 仅用于测试输出，没有设计逐段 JSB 传输。

继承按当前 Web parser 的实际语义实现：不存在的样式、零值、NaN 和空 event 对象分别保留；子属性为 falsy 且父属性存在时继承父值。图片及换行的样式边界、未知/大小写标签、未闭合标签尾部退栈、实体替换顺序均通过当前 Web 源码对照。整数前缀保留 parseInt 的十进制/十六进制、负零和 double 舍入语义。

属性扫描带有不前进时退出的保护，避免畸形输入在 native 循环中卡住。没有借此修改 Web parser。Unicode 空白覆盖 ECMAScript trim/标签属性所需字符；已验证的 imageAlign 值为 ASCII 对齐名，未扩展通用 Unicode 大小写转换。

## 验证与复现

Windows 使用生产 MSVC 工具链构建 Debug/Release：

```powershell
cmake --build native/tests/2d-poc/native/out --target cc2d_native_poc cc2d_richtext_parser
cmake --build native/tests/2d-poc/native/out-release2 --target cc2d_native_poc cc2d_richtext_parser
& native/tests/2d-poc/run-m6-richtext-parser-parity.ps1 -NativeExecutables @(
    'native/tests/2d-poc/native/out/cc2d_richtext_parser.exe',
    'native/tests/2d-poc/native/out-release2/cc2d_richtext_parser.exe'
)
```

3871 组输入分别由 g++ 独立编译、MSVC Debug、MSVC Release 三个产物解析。Jest 调用实际 `html-text-parser.ts`，逐段比较完整文本、样式字段、事件和顺序；通过 JSON 的统一表达比较 NaN/负零。测试含 65 组历史 QUnit 输入，以及嵌套/错配/未知标签、字体尺寸零值与非法数值、超过 2^53 的整数前缀、图片及带空格名称、事件有效/无效引号、实体、中文/emoji、16 种 Unicode/ASCII 空白、空内容和重复调用。

历史 QUnit 的 6 处旧预期已不同于当前 Web，例如 `<x hello world` 的处理。本测试保留这些历史输入和原始预期作来源记录，以当前实际 Web 输出作为 parity 标准；没有改变 Web 来迎合旧断言。

生产引擎 harness 的 Debug/Release 均通过：样式继承、事件、图片属性、不完整标签、实体替换及 1000 次交替解析空/非空内容的独立状态检查。此处 1000 次是解析状态检查，不代表场景加载卸载、泄漏或性能门禁。

`run-m0-checks.ps1` 已接入；native-ts-build CI 在下载 external 后执行独立 g++/Web 对照。CI 配置已更新，远端运行尚未验证。机器可读审计包含新 native 文件指纹及测试入口。

## 接下来必须完成

组件/JSB、原生测量与段管理、图片变更、基础命中/事件与销毁已完成定向接入，见 [运行时报告与未通过项](./native-2d-m6.2-richtext-runtime.md)。继续完成 native TS 类型/导入边界、真实场景 Web/native 对照和 shadow。GPU、字体平台矩阵、混合负载 KPI 及整个 M6.2 验收仍待完成。
