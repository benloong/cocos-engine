# SpriteAtlas 重载期间的延迟依赖

在候选 ff228d8200 的 Windows Debug 和 Release 上分别运行扩展后的 build-sprite-atlas-probe.cjs。探针使用真实 JSB 薄壳、原生图集表和延迟销毁入口，以受控顺序执行现行格式反序列化登记的依赖写回。

每个配置在同一图集上执行 1000 轮重载。先登记旧表，再登记带同名槽位的新表，按新 icon、旧 hero、新 hero、旧 obsolete 的顺序交付。逐轮核对待加载槽仍为空、原生纹理、帧身份、键顺序及序列化结果。第二个图集共享同一帧，在排队销毁后及完成销毁后分别交付回调；存活图集仍保有原帧与纹理。

两个配置均退出 0，输出 sprite atlas delayed dependencies: PASS、jsb shell integration: OK 和 native 2D PoC: PASS。日志分别保存在 native/tests/2d-poc/native/out 与 out-release2 下的 m6-atlas-overlap.log。此结果覆盖回调乱序、过期写回和共享资源所有权。资源管理器真实异步取消和跨场景释放继续待验。
