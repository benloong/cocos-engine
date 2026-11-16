# M6.2 RichText 原生布局规则

更新：2026-11-16。新增 `RichTextLayout`，直接消费 native parser 的 span，输出文本/图片段、行宽、内容尺寸、anchor 与位置。已加入引擎构建，**尚未由 RichText 运行时消费；原生组件、段对象管理和 JSB override 仍待接入**。本节点不关闭 M6.2 薄壳门禁。

## 数据与规则

布局以原生测量回调和图片尺寸查询回调为边界，未包含 JS 对象、字体平台选择或逐段 JSB 传输。一次布局内，同一 span/文本的测量结果缓存复用，返回后释放缓存。

按实际 Web RichText 和 text-utils 规则实现：

- 按 span 拼接、br/换行、连续/末尾空行、maxWidth 与各行宽度。
- 英文词段和中日韩字符处理、标点避行首、极窄宽度至少保留字符、UTF-16 surrogate/ZWJ 安全截取。
- 大于约 2048 的文本拆分，以及其后的普通换行；保留 Web 的检查次数上限和游标语义。
- 左/中/右对齐与父 anchor、统一行高和 0.26 baseline 比例；图片的尺寸缩放、top/center/bottom anchor、整数 offset；outline 的位置偏移。

图片 placement 的 spanIndex 是 native 样式索引。Web 图片段的内部 styleIndex 初值不用于图片样式；测试给图片段附加输入索引，只用于对应输入，不改变其布局方法。

## 验证

```powershell
cmake --build native/tests/2d-poc/native/out --target cc2d_native_poc cc2d_richtext_layout
cmake --build native/tests/2d-poc/native/out-release2 --target cc2d_native_poc cc2d_richtext_layout
& native/tests/2d-poc/run-m6-richtext-layout-parity.ps1 -NativeExecutables @(
    'native/tests/2d-poc/native/out/cc2d_richtext_layout.exe',
    'native/tests/2d-poc/native/out-release2/cc2d_richtext_layout.exe'
)
```

1440 组输入分别由 g++、MSVC Debug、MSVC Release 产物布局，对照实际 Web RichText 的解析、段规则、长文本拆分、换行与位置方法。测试只替换字体测量和段容器，保留实际布局实现；逐段比较文本/输入索引/行号/anchor/位置/尺寸，以及总尺寸和行宽，数值容差 0.0001。

输入组合为 32 种内容、5 种 maxWidth（0/1/35/95/220）、3 种对齐、3 种 anchor，默认字号 20、行高 24。覆盖样式、outline、中日韩/西里尔/希腊/越南文、emoji/ZWJ、空行、图片/缺失图片/偏移、长 ASCII 与混合中英文段。生产 harness 另检查两行内容、实际布局模型的图片基线与单次测量缓存。

测试与 native-ts-build CI、run-m0-checks 已接入。远端 CI 尚未运行；本机三个编译产物和引擎 harness 均通过。

## 仍需完成

相同测量值的规则对照不代表真实字体、GPU 或整个 Unicode 文本矩阵通过。长 emoji、超过循环上限的极端长文本、非有限/负尺寸及更多组合仍随运行时接入扩展。后续直接将此布局连接到 native Label/Sprite 段的创建/复用、字体/图集 revision、点击命中、启停与销毁；然后完成 JSB 薄壳、旧场景/Prefab、复杂文本和 Web/native 场景回归。当前 RichText 仍使用 Web 实现，M6 继续保持未收口。
