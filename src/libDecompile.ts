import { isIdentifierName } from "@babel/helper-validator-identifier";
import escodegen from "@javascript-obfuscator/escodegen";
import {
  namedTypes as n,
  builders as b,
  visit,
  astNodesAreEquivalent,
} from "ast-types";

// Expressions when the binary expression is doing the opposite
const oppositeExpressions = {
  "==": "!=",
  "!=": "==",
  "===": "!==",
  "!==": "===",
  "<": ">=",
  ">": "<=",
  "<=": ">",
  ">=": "<",
};

// Expressions when the binary expression is reversed
const flippedExpressions = {
  "==": "!=",
  "!=": "==",
  "===": "!==",
  "!==": "===",
  "<": ">",
  ">": "<",
  "<=": ">=",
  ">=": "<=",
};

export default function decompile(program: n.Program) {
  // return unminify.unminifySource(code, { safety: unminify.safetyLevels.SAFE });

  /*
    RULE:

    replace(...body) will require doing

    this.visit(path.parentPath);
    this.traverse(path.parentPath);

    to catch everything

    otherwise replace(e)

    this.visit(path);
    this.traverse(path);

  */

  visit(program, {
    // String.fromCharCode(1, 2, 3, 4).toLowerCase()
    visitCallExpression(path) {
      if (
        n.MemberExpression.check(path.node.callee) &&
        n.CallExpression.check(path.node.callee.object) &&
        astNodesAreEquivalent(
          path.node.callee.object.callee,
          b.memberExpression(
            b.identifier("String"),
            b.identifier("fromCharCode")
          )
        ) &&
        path.node.callee.object.arguments.every(
          (arg) => n.Literal.check(arg) && typeof arg.value === "number"
        ) &&
        astNodesAreEquivalent(
          b.identifier("toLowerCase"),
          path.node.callee.property
        )
      ) {
        path.replace(
          b.literal(
            String.fromCharCode(
              ...path.node.callee.object.arguments.map(
                (arg) => (arg as n.Literal).value as number
              )
            ).toLowerCase()
          )
        );

        return false;
      } else this.traverse(path);
    },
    visitVariableDeclaration(path) {
      if (
        path.node.declarations.length !== 1 &&
        !n.ForStatement.check(path.parent?.value)
      ) {
        path.replace(
          ...path.node.declarations.map((declaration) =>
            b.variableDeclaration(path.node.kind, [declaration])
          )
        );

        this.visit(path.parentPath);
        this.traverse(path.parentPath);
        return;
      }

      this.traverse(path);
    },
    visitReturnStatement(path) {
      if (n.SequenceExpression.check(path.node.argument)) {
        const [realReturn] = path.node.argument.expressions.slice(-1);
        const exps = path.node.argument.expressions.slice(0, -1);

        const body = [
          ...exps.map((e) => b.expressionStatement(e)),
          b.returnStatement(realReturn),
        ];

        if (path.parent.node?.type === "IfStatement")
          path.replace(b.blockStatement(body));
        else if (
          ["Program", "BlockStatement", "SwitchCase"].includes(
            path.parent.node?.type
          )
        ) {
          path.replace(...body);
          this.visit(path.parentPath);
          this.traverse(path.parentPath);
          return;
        } else throw new Error(`Unsupported parent ${path.parent.node?.type}`);
      }

      this.traverse(path);
    },
    visitEmptyStatement(path) {
      if (
        (!n.ForStatement.check(path.parent?.value) || path.name !== "body") &&
        !n.IfStatement.check(path.parent?.value) &&
        !n.SwitchStatement.check(path.parent?.value) &&
        !n.WhileStatement.check(path.parent?.value)
      ) {
        path.replace();
      }
      return false;
    },
    visitExpressionStatement(path) {
      // condition (?) expression as an expression is usually a substitude for if(){}else{}
      if (n.ConditionalExpression.check(path.node.expression)) {
        path.replace(
          b.ifStatement(
            path.node.expression.test,
            b.expressionStatement(path.node.expression.consequent),
            b.expressionStatement(path.node.expression.alternate)
          )
        );

        this.visit(path);
        this.traverse(path);

        return false;
      }

      if (n.SequenceExpression.check(path.node.expression)) {
        const body = path.node.expression.expressions.map((e) =>
          b.expressionStatement(e)
        );

        // global or in block
        if (
          !path.parent?.node.type ||
          ["Program", "BlockStatement", "SwitchCase"].includes(
            path.parent.node.type
          )
        ) {
          path.replace(...body);
          this.visit(path.parentPath);
          this.traverse(path.parentPath);
          return;
        } else path.replace(b.blockStatement(body));

        return this.traverse(path);
      }

      if (n.LogicalExpression.check(path.node.expression)) {
        if (path.node.expression.operator === "&&") {
          // it's safe to assume the right operator is probably a sequence/one thing
          path.replace(
            b.ifStatement(
              path.node.expression.left,
              b.expressionStatement(path.node.expression.right)
            )
          );

          this.visit(path);
          this.traverse(path);

          return false;
        }

        if (
          path.node.expression.operator === "||" &&
          n.BinaryExpression.check(path.node.expression.left) &&
          path.node.expression.left.operator in oppositeExpressions
        ) {
          // so far: || has been used exclusively with binary expressions to check the opposite, if it's null then do nothing
          // other||wise, execute expression.right
          path.replace(
            b.ifStatement(
              b.binaryExpression(
                oppositeExpressions[
                  path.node.expression.left
                    .operator as keyof typeof oppositeExpressions
                ] as Parameters<typeof b.binaryExpression>[0],
                path.node.expression.left.left,
                path.node.expression.left.right
              ),
              b.expressionStatement(path.node.expression.right)
            )
          );

          this.visit(path);
          this.traverse(path);

          return false;
        }
      }

      if (
        n.LogicalExpression.check(path.node.expression) &&
        path.node.expression.operator === "||"
      ) {
        // it's safe to assume the right operator is probably a sequence/one thing
        path.replace(
          b.ifStatement(
            b.unaryExpression("!", path.node.expression.left),
            b.expressionStatement(path.node.expression.right)
          )
        );

        this.visit(path);
        this.traverse(path);

        return false;
      }

      this.traverse(path);
    },
    visitUnaryExpression(path) {
      if (path.node.operator === "!")
        if (
          n.Literal.check(path.node.argument) &&
          typeof path.node.argument.value === "number"
        )
          return path.replace(b.literal(!path.node.argument.value)), false;
        else if (n.ArrayExpression.check(path.node.argument))
          return path.replace(b.literal(false)), false;
        else if (
          n.UnaryExpression.check(path.node.argument) &&
          n.ArrayExpression.check(path.node.argument.argument)
        )
          return path.replace(b.literal(true)), false;

      this.traverse(path);
    },
    visitBinaryExpression(path) {
      // traverse and simplify the operators before doing anything
      // this.traverse(path);

      // right side should always be simple
      // simple: typeof a === "string"
      // not simple: 12 === a
      // not simple: -1 !== test

      const isSimple = (node: n.Node) =>
        n.Literal.check(node) ||
        (n.UnaryExpression.check(node) && n.Literal.check(node.argument));

      if (
        path.node.operator in flippedExpressions &&
        isSimple(path.node.left) &&
        !isSimple(path.node.right)
      ) {
        // flip
        path.replace(
          b.binaryExpression(
            flippedExpressions[
              path.node.operator as keyof typeof flippedExpressions
            ] as Parameters<typeof b.binaryExpression>[0],
            path.node.right,
            path.node.left
          )
        );
      }

      this.traverse(path);
    },
    visitForStatement(path) {
      // console.log("got a for statement", escodegen.generate(path.node));

      if (
        n.VariableDeclaration.check(path.node.init) &&
        path.node.init.declarations.length !== 1 &&
        path.node.init.kind === "var" && // this is a var-only optimization
        path.parent?.node.type !== "LabeledStatement" // too much work/imopssible
      ) {
        // move all the ones before the final declaration outside of the statement
        const [realDeclaration] = path.node.init.declarations.slice(-1);
        const declarations = path.node.init.declarations.slice(0, -1);

        const { kind } = path.node.init;

        const body = [
          ...declarations.map((declaration) =>
            b.variableDeclaration(kind, [declaration])
          ),
          b.forStatement(
            b.variableDeclaration(kind, [realDeclaration]),
            path.node.test,
            path.node.update,
            path.node.body
          ),
        ];

        if (
          !path.parent?.node.type ||
          ["Program", "BlockStatement", "SwitchCase"].includes(
            path.parent.node.type
          )
        ) {
          // global or in block
          path.replace(...body);
          this.visit(path.parentPath);
          this.traverse(path.parentPath);
          return;
        } else path.replace(b.blockStatement(body));
      }

      this.traverse(path);
    },
    visitIfStatement(path) {
      // if((optimized, false))...
      if (n.SequenceExpression.check(path.node.test)) {
        const [realTest] = path.node.test.expressions.slice(-1);

        const body = [
          ...path.node.test.expressions
            .slice(0, -1)
            .map((e) => b.expressionStatement(e)),
          b.ifStatement(realTest, path.node.consequent, path.node.alternate),
        ];

        if (
          !path.parent?.node.type ||
          ["Program", "BlockStatement", "SwitchCase"].includes(
            path.parent.node.type
          )
        ) {
          // global or in block
          path.replace(...body);
          this.visit(path.parentPath);
          this.traverse(path.parentPath);
          return;
        } else path.replace(b.blockStatement(body));
      }

      if (n.VariableDeclaration.check(path.node.consequent))
        path.replace(
          b.ifStatement(
            path.node.test,
            n.VariableDeclaration.check(path.node.consequent)
              ? b.blockStatement([path.node.consequent])
              : path.node.consequent,
            path.node.alternate
          )
        );

      if (n.VariableDeclaration.check(path.node.alternate))
        path.replace(
          b.ifStatement(
            path.node.test,
            path.node.consequent,
            n.VariableDeclaration.check(path.node.alternate)
              ? b.blockStatement([path.node.alternate])
              : path.node.alternate
          )
        );

      this.traverse(path);
    },
    visitMemberExpression(path) {
      if (
        path.node.computed &&
        n.Literal.check(path.node.property) &&
        typeof path.node.property.value === "string" &&
        isIdentifierName(path.node.property.value)
      )
        path.replace(
          b.memberExpression(
            path.node.object,
            b.identifier(path.node.property.value),
            false
          )
        );

      this.traverse(path);
    },
    visitProperty(path) {
      if (
        n.Literal.check(path.node.key) &&
        typeof path.node.key.value === "string" &&
        isIdentifierName(path.node.key.value)
      )
        path.replace(
          b.property(
            path.node.kind,
            b.identifier(path.node.key.value),
            path.node.value
          )
        );

      this.traverse(path);
    },
    visitMethodDefinition(path) {
      if (
        n.Literal.check(path.node.key) &&
        typeof path.node.key.value === "string" &&
        isIdentifierName(path.node.key.value)
      )
        path.replace(
          b.methodDefinition(
            path.node.kind,
            b.identifier(path.node.key.value),
            path.node.value,
            path.node.static
          )
        );

      this.traverse(path);
    },
  });

  return escodegen.generate(program);
}
