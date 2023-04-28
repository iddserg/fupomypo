const fs = require("fs");
const { refactor } = require("shift-refactor");
const { Interpreter } = require("shift-interpreter");
const Shift = require("shift-ast");
const { parseScript } = require("shift-parser");
const { commonMethods } = require("refactor-plugin-common");

const src = fs.readFileSync(`${__dirname}/../snippets/sf.js`, "utf-8");
const ast = parseScript(src);

const interpreter = new Interpreter();
interpreter.load(ast, {
  parseInt: parseInt,
});

interpreter.run(ast.statements[0]);
interpreter.run(ast.statements[1]);
interpreter.run(ast.statements[2].expression.left);

const mainDecoderFunction = interpreter.getRuntimeValue(ast.statements[1].name);

const mainScript = refactor(ast.statements[2].expression.right, commonMethods);

const decoderFunctionNames = ['_0x1453']

mainScript('VariableDeclaration').forEach((node) => {
  node.declarators.forEach(declarator => {
    if (decoderFunctionNames.includes(declarator.init?.name)) {
      decoderFunctionNames.push(declarator.binding.name)
    }
  })
})

mainScript("CallExpression").replace((node) => {
  if (decoderFunctionNames.includes(node.callee.name)) {
    return new Shift.LiteralStringExpression({
      value: mainDecoderFunction(node.arguments[0].value),
    });
  }

  return node;
});

decoderFunctionNames.forEach(name => {
  mainScript(`[binding.name="${name}"]`).delete()
})

mainScript.convertComputedToStatic();

fs.writeFileSync(`${__dirname}/../result/sf.js`, mainScript.print())