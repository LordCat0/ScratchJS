//Wrapper over acorn.js
//Basically this entire thing can be boiled down to a big switch case statement lmao
//Lordcat

import * as acorn from 'acorn';
import * as escodegen from 'escodegen';

function getMemberPath(expr) {
  return expr.type === 'Identifier'
    ? [expr.name]
    : expr.type === 'MemberExpression'
      ? [...getMemberPath(expr.object), expr.property.name || expr.property.value]
      : [];
}

export function parse(code){
    const outputArray = []
    const ast = acorn.parse(code, { ecmaVersion: 2020, sourceType: "module" })
    const parseBody = (node) => {
        if (!node) return [];

        if (node.type === 'BlockStatement') {
            return node.body.flatMap(n => parseNode(n)).filter(Boolean);
        } else {
            const parsed = parseNode(node);
            return Array.isArray(parsed) ? parsed : [parsed];
        }
    }
    const parseInit = function(init){
        if (!init || typeof init.type !== 'string') {
        console.warn('⚠️ Invalid init passed to parseInit:', init);
        return { type: 'invalid', value: init };
    }
        switch(init.type){
            case 'Literal': return init.regex?{type: 'regex', pattern: init.regex.pattern, flags: init.regex.flags}:{type: 'literal', value: init.value}
            case 'ObjectExpression': return {type: 'object', properties: init.properties.map(prop => {return {
                    key: prop.key.type === 'Identifier' ? prop.key.name : prop.key.value,
                    computed: prop.computed,
                    kind: prop.kind,
                    method: prop.method || false,
                    shorthand: prop.shorthand || false,
                    value: parseInit(prop.value)}
                })}
            case 'ArrayExpression': return {type: 'array', value: init.elements.map(elem => parseInit(elem))}
            case 'FunctionExpression': return {type: 'function', async: init.async, params: init.params.map(p => p.name), body: init.body.body.map(node => parseNode(node))}
            case 'ArrowFunctionExpression': return {type: 'function', async: init.async, params: init.params.map(p => p.name), body: init.body.type==='BlockStatement'?parseBody(init.body):[{type: 'return', value: parseInit(init.body)}]}
            case 'CallExpression': return {type: 'functionCall', path: getMemberPath(init.callee), args: init.arguments.map(arg => parseInit(arg))}
            case 'NewExpression': return {type: 'newInstance', path: getMemberPath(init.callee), args: init.arguments.map(arg => parseInit(arg))}
            case 'Identifier': return {type: 'identifier', name: init.name}
            case 'BinaryExpression': return {type: 'binary', operator: init.operator, left: parseInit(init.left), right: parseInit(init.right)}
            case 'ConditionalExpression': return {type: 'ternary', test: parseInit(init.test), consequent: parseInit(init.consequent), alternate: parseInit(init.alternate)}
            case 'AwaitExpression': return {type: 'await', argument: parseInit(init.argument)}
            case 'ClassExpression': return {
                type: 'class',
                name: init.id ? init.id.name : null,
                superClass: init.superClass ? parseInit(init.superClass) : null,
                body: init.body.body.map(method => {
                return {
                    kind: method.kind,
                    static: method.static,
                    key: method.key.type === 'Identifier' ? method.key.name : escodegen.generate(method.key),
                    params: method.value.params.map(p => p.name),
                    body: method.value.body.body.map(node => parseNode(node)).flat().filter(Boolean)
                };
                })
            }
            case 'ImportExpression': return {type: 'dynamicImport', source: parseInit(init.source)}
            case 'TemplateLiteral': return {type: 'templateLiteral', quasis: init.quasis.map(q => q.value.cooked), expressions: init.expressions.map(expr => parseInit(expr))}
            case 'LogicalExpression': return {type: 'logical', operator: init.operator, left: parseInit(init.left), right: parseInit(init.right)}
            case 'UpdateExpression': return {type: 'update', operator: init.operator, argument: parseInit(init.argument), prefix: init.prefix}
            case 'UnaryExpression': return {type: 'unary', operator: init.operator, argument: parseInit(init.argument)}
            case 'AssignmentExpression': return {type: 'assignment', operator: init.operator,left: parseInit(init.left), right: parseInit(init.right)}
            case 'SequenceExpression': return {type: 'sequence', expressions: init.expressions.map(expr => parseInit(expr))}
            case 'ThisExpression': return { type: 'this' };
            case 'MemberExpression': return {type: 'member', path: getMemberPath(init)}
            case 'SpreadElement': return {type: 'spread', argument: parseInit(init.argument)}
            default:
                console.warn(`Unknown init type: ${init.type}`)
                return { type: 'unknown', nodeType: init.type };
    }
}
    const parseNode = function(node){
        switch(node.type){
            case 'VariableDeclaration': return node.declarations.map(decl => ({
                type: "setVar", kind: node.kind, name: decl.id.name, value: parseInit(decl.init)}))
            case 'ExpressionStatement': return parseInit(node.expression)
            case 'ReturnStatement': return {type: 'return', value: node.argument?parseInit(node.argument):undefined}
            case 'IfStatement': return {type: 'if',test: parseInit(node.test),consequent: parseBody(node.consequent),alternate: node.alternate?parseBody(node.alternate):null}
            case 'FunctionDeclaration': return {type: 'defineFunction', name: node.id.name, async: node.async, params: node.params.map(p => p.name), body: parseBody(node.body)}
            case 'WhileStatement': return {type: 'while', test: parseInit(node.test), body: parseBody(node.body), do: false}
            case 'ForStatement':
                return {
                    type: 'for',
                    init: node.init ? (
                    node.init.type === 'VariableDeclaration'
                        ? node.init.declarations.map(decl => ({
                            type: 'setVar',
                            kind: node.init.kind,
                            name: decl.id.name,
                            value: parseInit(decl.init)
                        }))
                        : parseInit(node.init)
                    ) : null,
                    test: node.test ? parseInit(node.test) : null,
                    update: node.update ? parseInit(node.update) : null,
                    body: parseBody(node.body)}
            case 'BreakStatement': return {type: 'break'}
            case 'ContinueStatement': return {type: 'continue'}
            case 'BlockStatement': return parseBody(node)
            case 'DoWhileStatement': return {type: 'while', test: parseInit(node.test), body: parseBody(node.body), do: true}
            case 'ForInStatement': return {
                    type: 'forIn',
                    left: node.left.type === 'VariableDeclaration'
                        ?{
                            kind: node.left.kind,
                            name: node.left.declarations[0].id.name}
                        :{name: node.left.name},
                    right: parseInit(node.right),
                    body: parseBody(node.body)}
            case 'ForOfStatement': return {
                    type: 'forOf',
                    left: node.left.type === 'VariableDeclaration'
                        ?{
                            kind: node.left.kind,
                            name: node.left.declarations[0].id.name}
                        :{name: node.left.name},
                    right: parseInit(node.right),
                    body: parseBody(node.body)}
            case 'SwitchStatement': return {type: 'switch', discriminant: parseInit(node.discriminant),
                cases: node.cases.map(c => ({
                    test: c.test?parseInit(c.test):null,
                    consequent: c.consequent.map(stmt => parseNode(stmt)).filter(Boolean)
                }))}
            case 'TryStatement': return {type: 'try', block: parseBody(node.block),
                handler: node.handler?{param: node.handler.param?node.handler.name:null, body: parseBody(node.handler.body)}:null,
                finalizer: node.finalizer?parseBody(node.finalizer):null}
            case 'ThrowStatement': return {type: 'throw', argument: parseInit(node.argument)}
            case 'DebuggerStatement': return {type: 'debugger'}
            case 'LabeledStatement': return {type: 'labeled', label: node.label.name, body: parseNode(node.body)}
            case 'WithStatement': return {type: 'with', object: parseInit(node.object), body: parseBody(node.body)}
            default:
                console.warn(`Unknown node type: ${node.type}`)
                return null
        }
    }
ast.body.forEach(node => {
  const result = parseNode(node);
  if (result) {
    Array.isArray(result)
      ? outputArray.push(...result)
      : outputArray.push(result);
  }
});

    return outputArray
}