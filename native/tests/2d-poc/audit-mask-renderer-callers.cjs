// Audit typed dot and literal-key access in engine TypeScript. Run from the repository root.
const path = require('path');
const ts = require('typescript');

const root = process.cwd();
const config = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
const { options } = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
const files = ts.sys.readDirectory(path.join(root, 'cocos'), ['.ts']).filter(file => !file.endsWith('.d.ts'));
const control = path.join(root, '__mask_renderer_audit__.ts');
const host = ts.createCompilerHost(options);
const readFile = host.readFile.bind(host);
host.readFile = file => path.resolve(file) === control ? [
    "import { Mask } from './cocos/2d/components/mask';",
    "import { Mask as NativeMask } from './cocos/2d/components/mask.jsb';",
    'declare const mask: Mask;',
    'declare const nativeMask: NativeMask;',
    'mask.color;',
    "mask['getRenderMaterial'](0);",
    'nativeMask.materials;',
    'mask.subComp?.color;',
].join('\n') : readFile(file);
const program = ts.createProgram([...files, control], options, host);
const checker = program.getTypeChecker();
const declaration = program.getSourceFile(path.join(root, 'cocos/2d/components/mask.ts'));
const mask = declaration.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === 'Mask');
const nativeDeclaration = program.getSourceFile(path.join(root, 'cocos/2d/components/mask.jsb.ts'));
const nativeMask = nativeDeclaration.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === 'Mask');
const members = new Set(mask.members.filter(member => ts.getJSDocTags(member).some(tag =>
    tag.tagName.text === 'deprecated') && member.name && member.name.getText() !== 'spriteFrame'
).map(member => member.name.getText()));
if (members.size !== 19) throw new Error('Review changed Mask renderer API list: ' + [...members]);

function inspect(source) {
    const hits = [];
    function visit(node) {
        const key = ts.isPropertyAccessExpression(node) ? node.name.text :
            ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression) ? node.argumentExpression.text : null;
        if (members.has(key)) {
            const type = checker.getNonNullableType(checker.getTypeAtLocation(node.expression));
            const alternatives = type.isUnion() ? type.types : [type];
            if (alternatives.some(t => t.symbol?.declarations?.includes(nativeMask)
                || t.getProperty(key)?.declarations?.some(d => d.parent === mask))) {
                const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
                hits.push({ file: path.relative(root, source.fileName), line: line + 1, key });
            }
        }
        ts.forEachChild(node, visit);
    }
    visit(source);
    return hits;
}

const controls = inspect(program.getSourceFile(control)).map(hit => hit.key);
if (controls.join(',') !== 'color,getRenderMaterial,materials') throw new Error('Mask receiver controls failed: ' + controls);
const hits = files.flatMap(file => inspect(program.getSourceFile(file)));
console.log(JSON.stringify({ engineFiles: files.length, rendererMembers: members.size, controls, hits }, null, 2));
if (hits.length) process.exitCode = 1;
