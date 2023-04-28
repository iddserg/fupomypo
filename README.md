# Деобфускация скрипта

## Исходные данные
- [Исходный файл]( c c.fupomypo.com - в файле sf.js)

## Инструментарий
- node.js
- shift-ast
- shift-interpreter
- shift-parser
- shift-refactor
- https://astexplorer.net (shift parser)
- https://jsoverson.github.io/shift-query-demo

## Анализ

Начнем с внешнего анализа обфусцированного скрипта. Его можно разбить на 4 части:
- Массив строк
- Функция выбора строки из массива по смещению (функция-расшифровщик)
- Shuffle-function (перемешивает массив перед запуском основной функции)
- Основная функция

Посмотрим на основную функцию. В начале создается локальная переменная, которой присваивается функция-расшифровщик
```js
(function() {
    var _0x4a45df = _0x1453;	
```

При этом в каждой вложенной функции этот процесс повторяется, только присваивается не глобальная функция, а локальная от "родителя"
```js
_0xfc6108[_0x4a45df(0x2c9)] = function() {
            var _0x18d4bd = _0x4a45df;
```

Обфускатор заменил часть строк в коде на вызов функции
```js
if (!history[_0x18d4bd(0x693)])
    return 0x0;
    window['history'][_0x18d4bd(0x693)]({}, '', location['pathname']);
```

Получается, чтобы получить оригинальный скрипт, нужно вместо вызова этой функции подставить строку, которую возвращает данная функция

## Деобфускация

Для начала преобразуем код в абстрактное синтаксическое дерево (AST)

```js
const src = fs.readFileSync(`${__dirname}/../snippets/sf.js`, "utf-8");
const ast = parseScript(src);
```

Создадим сессию Interpreter. Эта штука позволяет запускать код внутри контекста, что-то типа eval(). Передадим в контекст функцию parseInt (она используется в коде, а в дефолтном контексте его нет)
```js
const interpreter = new Interpreter();
interpreter.load(ast, {
  parseInt: parseInt,
});
```

Теперь нужно сделать так, чтобы этой сессии был массив со строками, который прошел через шафл-функцию. Для этого посмотрим на код в формате AST через AST explorer

![AST explorer](http://i.imgur.com/JjlQtxO.png)

Видим 3 стейтмента:
- VariableDeclarationStatement - массив строк
- FunctionDeclaration - функция-расшифровщик
- ExpressionStatement.left - shuffle-function
- ExpressionStatement.right - основная функция

Запускаем поочередно
```js
interpreter.run(ast.statements[0]);
interpreter.run(ast.statements[1]);
interpreter.run(ast.statements[2].expression.left);
```

Ок, теперь в interpreter сессии лежит массив строк в нужной нам очередности. Interpreter позволяет из вне выполнять внутренние функции и отдавать результат. Так и поступим с расшифровщиком
```js
const decodeFunction = interpreter.getRuntimeValue(ast.statements[1].name);
```

Осталось заменить вызовы функции выбора строки из массива по смещению на строки. Создаем рефакторинг сессию только с основной функцией (остальной код нам больше не нужен)
```js
const mainScript = refactor(ast.statements[2].expression.right, commonMethods);
```

И заменяем все вызовы функции по условию: один аргумент и это число. Да, тут повезло, что под такое условие подходят только вызовы расшифровщика
```js
mainScript("CallExpression").replace((node) => {
  if (
    node.arguments.length === 1 &&
    node.arguments[0].type === "LiteralNumericExpression"
  ) {
    return new Shift.LiteralStringExpression({
      value: decodeFunction(node.arguments[0].value),
    });
  }

  return node;
});
```

Сохраняем результат в файл
```js
fs.writeFileSync(`${__dirname}/../result/sf.js`, mainScript.print())
```

Машина не сможет самостоятельно восстановить названия функций и переменных, поэтому это придется сделать человеку (+ChatGPT)
