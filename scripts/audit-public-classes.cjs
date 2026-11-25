/* Inventory the class API reachable from exports/*.ts without emitting code. */
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const rel = (p) => path.relative(root, p).replace(/\\/g, '/');
const configPath = path.join(root, 'tsconfig.json');
const config = ts.readConfigFile(configPath, ts.sys.readFile);
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
const entries = fs.readdirSync(path.join(root, 'exports')).filter((p) => p.endsWith('.ts')).sort()
    .map((p) => path.join(root, 'exports', p));
const program = ts.createProgram(entries, { ...parsed.options, skipLibCheck: true, noEmit: true });
const checker = program.getTypeChecker();
const engineConfig = JSON.parse(fs.readFileSync(path.join(root, 'cc.config.json'), 'utf8'));
const nativeOverrides = engineConfig.moduleOverrides.filter((o) => o.test === 'context.buildTimeConstants.NATIVE')
    .flatMap((o) => Object.entries(o.overrides));
const records = new Map();
const unresolved = [];
const entrySummary = [];
const legacyExposures = [];

function resolve(symbol) {
    const seen = new Set();
    while (symbol && (symbol.flags & ts.SymbolFlags.Alias) && !seen.has(symbol)) {
        seen.add(symbol);
        symbol = checker.getAliasedSymbol(symbol);
    }
    return symbol;
}

function tagsOf(symbol) {
    // Symbols may merge a public class with an internal namespace (Camera).
    // Keep declaration tags separate rather than hiding the whole merged class.
    return symbol ? [...new Set((symbol.declarations || []).filter((d) => !ts.isModuleDeclaration(d))
        .flatMap((d) => ts.getJSDocTags(d).map((tag) => tag.tagName.text)))] : [];
}

function typeOnly(symbol) {
    return (symbol.declarations || []).some((d) => {
        if (ts.isExportSpecifier(d)) return d.isTypeOnly || d.parent.parent.isTypeOnly;
        if (ts.isImportSpecifier(d)) return d.isTypeOnly || d.parent.parent.isTypeOnly;
        return false;
    });
}

function classDeclarations(symbol) {
    const direct = (symbol.declarations || []).filter((d) => ts.isClassDeclaration(d) || ts.isClassExpression(d));
    if (direct.length) return direct;
    const loc = symbol.valueDeclaration || (symbol.declarations || [])[0];
    if (!loc) return [];
    // Includes exported constructor aliases, e.g. const Alias = OriginalClass.
    const signatures = checker.getTypeOfSymbolAtLocation(symbol, loc).getConstructSignatures();
    const result = new Set();
    for (const sig of signatures) {
        const resultSymbol = sig.getReturnType().getSymbol();
        for (const d of (resultSymbol && resultSymbol.declarations) || []) {
            if (ts.isClassDeclaration(d) || ts.isClassExpression(d)) result.add(d);
        }
    }
    return [...result];
}

function registerClass(symbol, declaration, exposure, tags) {
    const source = rel(declaration.getSourceFile().fileName);
    const key = `${source}:${declaration.pos}`;
    let record = records.get(key);
    if (!record) {
        const jsbPath = source.replace(/\.ts$/, '.jsb.ts');
        record = {
            className: declaration.name ? declaration.name.text : symbol.name,
            source, line: declaration.getSourceFile().getLineAndCharacterOfPosition(declaration.getStart()).line + 1,
            abstract: !!(ts.getCombinedModifierFlags(declaration) & ts.ModifierFlags.Abstract),
            ambient: declaration.getSourceFile().isDeclarationFile,
            external: source.startsWith('node_modules/') || source.startsWith('native/external/') || source.startsWith('vendor/') || source.startsWith('cocos/spine/lib/'),
            tags: [], exposures: [],
            siblingJsb: fs.existsSync(path.join(root, jsbPath)) ? jsbPath : null,
            nativeOverrideCandidates: nativeOverrides.filter(([from]) => from === source ||
                (path.posix.dirname(from) === path.posix.dirname(source) && path.posix.basename(from) === 'index.ts'))
                .map(([from, to]) => ({ from, to, exists: fs.existsSync(path.join(root, to)) })),
        };
        records.set(key, record);
    }
    record.tags = [...new Set([...record.tags, ...tags])];
    record.exposures.push({ ...exposure, internal: tags.some((t) => ['internal', 'engineInternal', 'private'].includes(t)) });
    return record;
}

function visit(moduleSymbol, entry, prefix = '', stack = new Set(), inheritedTags = []) {
    if (stack.has(moduleSymbol)) return;
    const nextStack = new Set(stack).add(moduleSymbol);
    for (const exported of checker.getExportsOfModule(moduleSymbol)) {
        const symbol = resolve(exported);
        if (!symbol || symbol.name === 'unknown') {
            unresolved.push({ entry, name: prefix + exported.name });
            continue;
        }
        const exportedName = prefix + exported.name;
        const tags = [...new Set([...inheritedTags, ...tagsOf(exported), ...tagsOf(symbol)])];
        const onlyType = typeOnly(exported);
        for (const declaration of classDeclarations(symbol)) {
            registerClass(symbol, declaration, { entry, name: exportedName, typeOnly: onlyType }, tags);
        }
        if (!onlyType && (symbol.flags & ts.SymbolFlags.Module)) {
            const moduleTags = (symbol.declarations || []).filter(ts.isModuleDeclaration)
                .flatMap((d) => ts.getJSDocTags(d).map((tag) => tag.tagName.text));
            visit(symbol, entry, exportedName + '.', nextStack, [...tags, ...moduleTags]);
        }
    }
}

for (const entryPath of entries) {
    const source = program.getSourceFile(entryPath);
    const symbol = source && checker.getSymbolAtLocation(source);
    if (!symbol) throw new Error(`No module symbol: ${rel(entryPath)}`);
    visit(symbol, rel(entryPath));
}

// Class constructors additionally assigned to the legacy global API.
for (const source of program.getSourceFiles()) {
    if (source.isDeclarationFile || source.fileName.endsWith('.jsb.ts') || !rel(source.fileName).startsWith('cocos/')) continue;
    function scan(node) {
        if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isPropertyAccessExpression(node.left)) {
            const exposedName = node.left.getText(source);
            if (/^(legacyCC|cclegacy)\./.test(exposedName)) {
                const symbol = resolve(checker.getSymbolAtLocation(node.right));
                if (symbol && classDeclarations(symbol).length) {
                    for (const decl of classDeclarations(symbol)) {
                        const record = registerClass(symbol, decl, { entry: 'legacy-global',
                            name: exposedName.replace(/^cclegacy\./, 'legacyCC.'), typeOnly: false }, tagsOf(symbol));
                        legacyExposures.push({ name: exposedName, source: rel(source.fileName),
                            line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1, classSource: record.source, className: record.className });
                    }
                }
            }
        }
        ts.forEachChild(node, scan);
    }
    scan(source);
}

const classes = [...records.values()].map((r) => {
    r.exposures = [...new Map(r.exposures.map((e) => [JSON.stringify(e), e])).values()]
        .sort((a, b) => a.entry.localeCompare(b.entry) || a.name.localeCompare(b.name));
    r.publicRuntime = r.exposures.some((e) => !e.typeOnly && !e.internal);
    r.category = r.external ? '外部依赖' : !r.publicRuntime ? '内部或仅类型导出' :
        r.siblingJsb ? '已有同源薄壳文件' : '缺少同源薄壳文件';
    return r;
}).sort((a, b) => a.source.localeCompare(b.source) || a.line - b.line);

for (const entry of entries.map(rel)) {
    const exposed = classes.filter((r) => r.exposures.some((e) => e.entry === entry));
    entrySummary.push({ entry, classes: exposed.length,
        publicRuntime: exposed.filter((r) => r.publicRuntime && !r.external && r.exposures.some((e) => e.entry === entry && !e.typeOnly && !e.internal)).length });
}

const ownPublic = classes.filter((r) => r.publicRuntime && !r.external);
const withShell = ownPublic.filter((r) => r.siblingJsb);
const stats = {
    entries: entries.length, reachableClasses: classes.length,
    enginePublicRuntimeClasses: ownPublic.length, withSiblingJsb: withShell.length,
    exportedPublicRuntimeClasses: ownPublic.filter((r) => r.exposures.some((e) => e.entry !== 'legacy-global' && !e.typeOnly && !e.internal)).length,
    legacyOnlyPublicCandidates: ownPublic.filter((r) => !r.exposures.some((e) => e.entry !== 'legacy-global' && !e.typeOnly && !e.internal)).length,
    withoutSiblingJsb: ownPublic.length - withShell.length,
    internalOrTypeOnlyEngineClasses: classes.filter((r) => !r.external && !r.publicRuntime).length,
    externalClasses: classes.filter((r) => r.external).length,
    externalPublicRuntimeClasses: classes.filter((r) => r.external && r.publicRuntime).length,
    legacyClassAssignments: legacyExposures.length,
    unresolvedExports: unresolved.length,
};
const statLabels = {
    entries: '扫描特性入口', reachableClasses: '全部可达类（含内部、仅类型、第三方）',
    enginePublicRuntimeClasses: '引擎自有公开运行时类候选（含 legacy 补充）',
    withSiblingJsb: '公开候选中已有同源 JSB 文件',
    exportedPublicRuntimeClasses: '其中由特性入口导出的公开类候选',
    legacyOnlyPublicCandidates: '其中仅由 legacy 全局赋值补充的候选',
    withoutSiblingJsb: '公开候选中缺少同源 JSB 文件',
    internalOrTypeOnlyEngineClasses: '引擎自有内部或仅类型类',
    externalClasses: '第三方与 vendor 集成可达类',
    externalPublicRuntimeClasses: '其中公开运行时类候选',
    legacyClassAssignments: '显式 legacy 类赋值位置（含重复）',
    unresolvedExports: '未解析导出',
};
const json = { schemaVersion: 1, method: 'TypeScript compiler export-symbol traversal; baseline TS graph; no Native override execution',
    stats, entrySummary, unresolved, legacyExposures, classes };
fs.writeFileSync(path.join(root, 'docs/native-public-class-inventory.json'), JSON.stringify(json, null, 2) + '\n');

const md = [
    '# Cocos Engine 对外类与 JSB 薄壳盘点', '',
    '日期：2026-11-19', '',
    '## 范围与判断方式', '',
    '- 从仓库 `exports/*.ts` 的全部特性入口出发，用 TypeScript 编译器解析重导出、别名及命名空间，按类声明位置去重。结果是所有可选特性的并集，不是单次构建的类数量。',
    '- 运行时可达且该导出路径没有 `@internal`、`@engineInternal`、`@private` 的类列入公开候选；导出可达不等于全部获得稳定公共 API 承诺，需要结合模块和文档标签确认。',
    '- 抽象类、废弃别名、命名空间下的类和具有构造签名的类别名保留；接口、普通类型别名、枚举、函数和单例变量不按类计数。',
    '- 另外扫描导出图所加载的 cocos TS 文件中 `legacyCC.X = Class` / `cclegacy.X = Class` 的显式类赋值，补充全局 API；这类条件赋值只标记为静态候选，实际运行受构建条件控制。',
    '- 第三方与 vendor 集成 API 单列，包含 Spine 库声明、DragonBones 依赖和 Google 平台绑定；这些类型仍是脚本可见 API，不能因单列就忽略其适配，但不应冒充全部为引擎自有类。Editor 扩展入口、任意深路径导入、动态计算属性、对象装配、工厂返回值隐式暴露的类不属于本次静态扫描范围。',
    '- 使用当前 TS 图，未执行 Native 构建替换、特性裁剪或声明生成；所有计数是本工作区源码的静态盘点。无法解析的导出在 JSON 中记录，不将其当作已经完整审计。',
    '- “已有同源薄壳文件”仅指类所在源文件有同路径 `.jsb.ts`；不代表已按目标设计改造、每个类各有独立薄壳或全部绑定可用。聚合 index.jsb.ts 覆盖也不等于拥有独立薄壳。',
    '- 本表是通用 API 索引，不是全部类的薄壳任务清单。目标薄壳范围已限定为 Asset、Node、Component 及其公开子类，详见 [2D 对象范围](native-2d-class-scope.md)。其余类缺少同源文件不构成待办。',
    '', '复现：`node scripts/audit-public-classes.cjs`。机器清单见 [native-public-class-inventory.json](native-public-class-inventory.json)。', '',
    '## 统计', '', '| 项目 | 数量 |', '| --- | ---: |',
    ...Object.entries(stats).map(([k, v]) => `| ${statLabels[k]} | ${v} |`), '',
    '## 按源码模块汇总', '',
    '| 模块 | 公开类候选 | 已有同源 JSB 文件 | 缺少同源 JSB 文件 |', '| --- | ---: | ---: | ---: |',
    ...[...new Set(ownPublic.map((r) => r.source.split('/').slice(0, 2).join('/')))].sort().map((group) => {
        const rows = ownPublic.filter((r) => r.source.split('/').slice(0, 2).join('/') === group);
        const existing = rows.filter((r) => r.siblingJsb).length;
        return `| ${group} | ${rows.length} | ${existing} | ${rows.length - existing} |`;
    }), '',
    '## 按入口统计', '', '同一类可由多个入口暴露，此表不能直接相加。', '',
    '| 入口 | 可达类 | 本入口公开运行时类（引擎自有） |', '| --- | ---: | ---: |',
    ...entrySummary.map((e) => `| ${e.entry} | ${e.classes} | ${e.publicRuntime} |`), '',
    '## 引擎自有公开运行时类清单', '',
];
const groups = new Map();
for (const r of ownPublic) {
    const group = r.source.startsWith('cocos/') ? r.source.split('/').slice(0, 2).join('/') : r.source.split('/')[0];
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(r);
}
for (const [group, rows] of groups) {
    md.push(`### ${group}（${rows.length}）`, '', '| 类 | 对外名称 | 源文件 | 同源 JSB 文件 |', '| --- | --- | --- | --- |');
    for (const r of rows) {
        const names = [...new Set(r.exposures.filter((e) => !e.typeOnly && !e.internal).map((e) => e.name))];
        md.push(`| ${r.className}${r.abstract ? '（抽象）' : ''}${r.tags.includes('deprecated') ? '（废弃）' : ''} | ${names.join(', ')} | [${r.source}:${r.line}](../${r.source}#L${r.line}) | ${r.siblingJsb ? `[已有文件](../${r.siblingJsb})` : '缺少'} |`);
    }
    md.push('');
}
md.push('## 内部、仅类型和外部依赖', '',
    '以下不直接进入引擎自有公开类的薄壳数量；保留在机器清单中供人工确认。', '',
    '| 类 | 分类 | 对外名称 | 源文件 |', '| --- | --- | --- | --- |');
for (const r of classes.filter((r) => r.external || !r.publicRuntime)) {
    md.push(`| ${r.className} | ${r.category}${r.publicRuntime ? '（公开候选）' : '（内部/仅类型）'} | ${[...new Set(r.exposures.map((e) => e.name))].join(', ')} | ${r.source}:${r.line} |`);
}
md.push('', '## 目标薄壳规则与迁移建议', '',
    '1. 仅对确认需要公开的 Asset、Node、Component 及其子类建立对应 `XXX.jsb.ts`；有 C++ 实现时直接导出绑定类型，适配原型、幂等 `_ctor` 和序列化元数据，不创建第二个 Native 实例。',
    '2. 上述范围内仍为 TS 实现的引擎类可在过渡薄壳中显式复用 TS 实现；用户脚本统一通过 Component/ScriptComponent 桥接，不为每个用户类生成引擎薄壳。',
    '3. 优先 Node/Scene/Component、2D 渲染组件和依赖的 Asset 子类；布局与交互组件属于扩展范围。数学、几何、事件、管理器、gfx 等不要求独立薄壳。',
    '4. Component 体系遵循 [生命周期设计](native-component-lifecycle-design.md)：Native 组件直接继承 C++ Component，脚本类对应 ScriptComponent，Node 持有统一数组；Native 组件脚本不可继承。其他公开类是否可脚本继承需按该类型契约单独定义。',
    '5. gfx、renderer、rendering、sp、dragonBones 等现有聚合绑定可以保留；只有其中属于 Asset/Node/Component 体系的目标公开类需要逐类薄壳适配。不要因为缺少同源文件就认定没有 Native 绑定。',
    '6. 继续审计 legacyCC 动态 API、工厂返回对象及公开实例属性中的类型，再结合生成声明/API 文档进行人工确认。检查 Native 替换目标存在、特性条件、导出身份、序列化、生命周期和 GC，才能将候选标记为完成。',
    '', '此盘点仅新增审计脚本与文档，不自动生成薄壳或修改引擎实现。', '');
fs.writeFileSync(path.join(root, 'docs/native-public-class-inventory.md'), md.join('\n'));
console.log(JSON.stringify(stats, null, 2));
