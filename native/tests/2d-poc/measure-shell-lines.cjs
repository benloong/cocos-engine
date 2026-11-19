'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function pureType(node) {
    if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) return true;
    if (node.modifiers?.some(m => m.kind === ts.SyntaxKind.DeclareKeyword)) return true;
    if (ts.isImportDeclaration(node)) {
        const clause = node.importClause;
        if (clause?.isTypeOnly) return true;
        const names = clause?.namedBindings;
        return !clause?.name && names && ts.isNamedImports(names)
            && names.elements.length > 0 && names.elements.every(e => e.isTypeOnly);
    }
    if (ts.isExportDeclaration(node)) {
        const names = node.exportClause;
        return node.isTypeOnly || (names && ts.isNamedExports(names)
            && names.elements.length > 0 && names.elements.every(e => e.isTypeOnly));
    }
    return false;
}

// Only discard a direct, undecorated alias. Deprecated fields, validation,
// layout work and forwarding with transformed arguments still count.
function deprecatedForward(node) {
    if (!(ts.isGetAccessor(node) || ts.isSetAccessor(node) || ts.isMethodDeclaration(node))) return false;
    if (!ts.getJSDocDeprecatedTag(node) || ts.getDecorators(node)?.length || node.body?.statements.length !== 1) return false;
    if (ts.isComputedPropertyName(node.name)) return false;
    if (node.parameters.some(p => ts.getDecorators(p)?.length || p.initializer || !ts.isIdentifier(p.name) || p.dotDotDotToken)) return false;
    const statement = node.body.statements[0];
    const direct = expr => expr && ts.isPropertyAccessExpression(expr) && expr.expression.kind === ts.SyntaxKind.ThisKeyword;
    const expr = statement.expression;
    if (ts.isGetAccessor(node)) return ts.isReturnStatement(statement) && direct(expr);
    if (ts.isSetAccessor(node)) return ts.isExpressionStatement(statement) && ts.isBinaryExpression(expr)
        && expr.operatorToken.kind === ts.SyntaxKind.EqualsToken && direct(expr.left)
        && ts.isIdentifier(expr.right) && expr.right.text === node.parameters[0]?.name.text;
    return (ts.isReturnStatement(statement) || ts.isExpressionStatement(statement)) && expr && ts.isCallExpression(expr)
        && direct(expr.expression) && expr.arguments.length === node.parameters.length
        && expr.arguments.every((arg, i) => ts.isIdentifier(arg) && arg.text === node.parameters[i].name.text);
}

function measure(file, input) {
    const text = input.replace(/\r\n/g, '\n');
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    if (source.parseDiagnostics.length) throw Error('Invalid TypeScript: ' + file);
    const ranges = [];
    const header = /^\/\*[\s\S]*?\*\//.exec(text);
    if (header && /copyright/i.test(header[0])) ranges.push([0, header[0].length]);
    function visit(node) {
        if (pureType(node) || deprecatedForward(node)) {
            ranges.push([node.getStart(source, true), node.end]);
        } else {
            ts.forEachChild(node, visit);
        }
    }
    visit(source);
    const lines = text.split('\n');
    if (lines[lines.length - 1] === '') lines.pop();
    let start = 0;
    let excluded = 0;
    for (const line of lines) {
        const end = start + line.length;
        let remaining = '';
        let cursor = start;
        let touched = false;
        for (const [left, right] of ranges) {
            if (right <= start || left > end) continue;
            touched = true;
            remaining += text.slice(cursor, Math.max(cursor, Math.min(left, end)));
            cursor = Math.max(cursor, Math.min(right, end));
        }
        if (touched && !(remaining + text.slice(cursor, end)).trim()) excluded++;
        start = end + 1;
    }
    return { physical: lines.length, excluded, counted: lines.length - excluded };
}

function shellSizes(report) {
    const root = path.resolve(__dirname, '../../..');
    return report.classes.filter(c => c.overridden).map(c => ({
        name: c.name, file: c.runtime, limit: ['Label', 'RichText'].includes(c.name) ? 500 : 300,
        ...measure(c.runtime, fs.readFileSync(path.join(root, c.runtime), 'utf8')),
    }));
}

module.exports = { measure, shellSizes };
