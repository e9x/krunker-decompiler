import escodegen from "@javascript-obfuscator/escodegen";
import { parse } from "acorn";
import { namedTypes as n, builders as b, visit } from "ast-types";

interface DecompiledSource {
  id: number;
  code: string;
}

export default async function unpackWebpack(code: string) {
  const program = parse(code, { ecmaVersion: "latest" });

  if (!n.Program.check(program)) return;

  // older builds
  if (
    n.ExpressionStatement.check(program.body[0]) &&
    n.UnaryExpression.check(program.body[0].expression)
  )
    program.body[0] = b.expressionStatement(
      program.body[0].expression.argument
    );

  const webpackLoader = program.body.find(
    (e) =>
      n.ExpressionStatement.check(e) &&
      n.CallExpression.check(e.expression) &&
      n.FunctionExpression.check(e.expression.callee)
  );

  if (!webpackLoader) throw new TypeError("No loader");

  if (!n.ExpressionStatement.assert(webpackLoader)) return;
  if (!n.CallExpression.assert(webpackLoader.expression)) return;
  if (!n.FunctionExpression.assert(webpackLoader.expression.callee)) return;

  const modules = webpackLoader.expression.arguments[0];

  if (!n.ArrayExpression.assert(modules)) return;

  return modules.elements
    .map((element, i) => {
      if (!n.FunctionExpression.check(element)) {
        // sometimes modules are omitted from the bundle...
        return;
        /*console.log(generate(element));*/
      }

      const [module, exports, __webpack_require__] = (
        element.params.filter((p) => n.Identifier.check(p)) as n.Identifier[]
      ).map((i) => i.name);

      visit(element, {
        visitIdentifier(path) {
          switch (path.node.name) {
            case module:
              path.node.name = "module";
              break;
            case exports:
              path.node.name = "exports";
              break;
            case __webpack_require__:
              path.node.name = "__webpack_require__";
              break;
          }

          this.traverse(path);
        },
      });

      return {
        id: i,
        code: escodegen.generate(b.program(element.body.body)),
      } as DecompiledSource;
    })
    .filter(Boolean) as DecompiledSource[];
}
