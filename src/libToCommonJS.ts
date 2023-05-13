import { parse } from "acorn";
import {
  namedTypes as n,
  builders as b,
  visit,
  astNodesAreEquivalent,
} from "ast-types";

const setESModule = parse(
  `if (typeof Symbol !== 'undefined' && Symbol.toStringTag) {
  Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
}
Object.defineProperty(exports, '__esModule', { value: true });`,
  { ecmaVersion: "latest" }
) as n.Node as n.Program;

const webpackDefaultImporter = parse(
  `function webpackDefaultImporter(module) {
  (function (get) {
    return Object.defineProperty(get, "a", { get: get });
  })(
    module && module.__esModule
      ? function getDefault() {
          return module["default"];
        }
      : function getModuleExports() {
          return module;
        }
  );
}`,
  { ecmaVersion: "latest" }
) as n.Node as n.Program;

export default function toCommonJS(program: n.Program) {
  let insertedWebpackDefaultImporter = false;

  visit(program, {
    visitCallExpression(path) {
      if (
        astNodesAreEquivalent(
          path.node.callee,
          b.identifier("__webpack_require__")
        ) &&
        n.Literal.check(path.node.arguments[0])
      ) {
        path.replace(
          b.callExpression(b.identifier("require"), [
            b.literal(`./${path.node.arguments[0].value}.js`),
          ])
        );

        return false;
      } else if (
        // getDefaultExport function for compatibility with non-harmony modules
        astNodesAreEquivalent(
          path.node.callee,
          b.memberExpression(
            b.identifier("__webpack_require__"),
            b.identifier("n")
          )
        )
      ) {
        /*var getter = module && module.__esModule ?
function getDefault() { return module['default']; } :
function getModuleExports() { return module; };
__webpack_require__.d(getter, 'a', getter);
return getter;*/

        if (!insertedWebpackDefaultImporter) {
          insertedWebpackDefaultImporter = true;
          program.body.unshift(...webpackDefaultImporter.body);
        }

        path.replace(
          b.callExpression(b.identifier("webpackDefaultImporter"), [
            path.node.arguments[0],
          ])
        );

        return false;
      }

      this.traverse(path);
    },
    visitExpressionStatement(path) {
      if (
        astNodesAreEquivalent(
          path.node,
          b.expressionStatement(
            b.callExpression(
              b.memberExpression(
                b.identifier("__webpack_require__"),
                b.identifier("r")
              ),
              [b.identifier("exports")]
            )
          )
        )
      ) {
        path.replace(...setESModule.body);
        return false;
      } else if (
        n.ExpressionStatement.check(path.node) &&
        n.CallExpression.check(path.node.expression) &&
        astNodesAreEquivalent(
          path.node.expression.callee,
          b.memberExpression(
            b.identifier("__webpack_require__"),
            b.identifier("d")
          )
        ) &&
        astNodesAreEquivalent(
          path.node.expression.arguments[0],
          b.identifier("exports")
        ) &&
        n.Literal.check(path.node.expression.arguments[1]) &&
        n.FunctionExpression.check(path.node.expression.arguments[2])
      ) {
        path.replace(
          b.ifStatement(
            b.unaryExpression(
              "!",
              b.callExpression(
                b.memberExpression(
                  b.memberExpression(
                    b.memberExpression(
                      b.identifier("Object"),
                      b.identifier("prototype")
                    ),
                    b.identifier("hasOwnProperty")
                  ),
                  b.identifier("call")
                ),
                [b.identifier("exports"), path.node.expression.arguments[1]]
              )
            ),
            b.expressionStatement(
              b.callExpression(
                b.memberExpression(
                  b.identifier("Object"),
                  b.identifier("defineProperty")
                ),
                [
                  b.identifier("exports"),
                  path.node.expression.arguments[1],
                  b.objectExpression([
                    b.property(
                      "init",
                      b.identifier("get"),
                      path.node.expression.arguments[2]
                    ),
                  ]),
                ]
              )
            )
          )
        );
      }

      this.traverse(path);
    },
  });
}
