import * as acorn from 'acorn';
import * as walk from 'acorn-walk'; 
import * as escodegen from 'escodegen';

import { inspect } from 'util';

function getMemberPath(expr) {
  return expr.type === 'Identifier'
    ? [expr.name]
    : expr.type === 'MemberExpression'
      ? [...getMemberPath(expr.object), expr.property.name || expr.property.value]
      : [];
}

export function parse(code){
    const outputArray = []
    const ast = acorn.parse(code, { ecmaVersion: 2020 })
    const parseInit = function(init){
        switch(init.type){
            case 'Literal': return init.regex?{type: 'regex', pattern: init.regex.pattern, flags: init.regex.flags}:{type: 'literal', value: init.value}
            case 'ObjectExpression': return {type: 'object', value: escodegen.generate(init, {format: {compact: true}})}
            case 'ArrayExpression': return {type: 'array', value: escodegen.generate(init, {format: {compact: true}})}
            case 'FunctionExpression': return {type: 'function', async: init.async, params: init.params.map(p => p.name), body: init.body.body.map(node => parseNode(node))}
            case 'ArrowFunctionExpression': return {type: 'function', async: init.async, params: init.params.map(p => p.name), body: init.body.type==='BlockStatement'? init.body.body.map(node => parseNode(node)):[{type: 'return', value: parseInit(init.body)}]}
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
            default: return { type: 'unknown', nodeType: init.type };
    }
}
    const parseNode = function(node){
        switch(node.type){
            case 'VariableDeclaration':
                return node.declarations.map(decl => ({
                    type: "setVar",
                    kind: node.kind,
                    name: decl.id.name,
                    value: parseInit(decl.init)
                }))
            default:
                return null
        }
    }
    walk.fullAncestor(ast, (node, state, ancestors) => {
        const parentFunc = ancestors.find(a => 
            a.type === 'FunctionDeclaration' || 
            a.type === 'FunctionExpression' || 
            a.type === 'ArrowFunctionExpression'
        )
        if(!parentFunc){
            const result = parseNode(node)
            if(result) Array.isArray(result)?result.forEach(i => outputArray.push(i)):outputArray.push(result)
        }
    })
    console.log(inspect(outputArray, {depth: null, colors: true}))
}