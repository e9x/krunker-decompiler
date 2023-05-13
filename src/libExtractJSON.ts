import { parse } from "acorn";
import {
  namedTypes as n,
  builders as b,
  astNodesAreEquivalent,
} from "ast-types";

export default function extractJSON(
  code: string
): { json: false } | { json: true; data: unknown } {
  const program = parse(code, {
    ecmaVersion: "latest",
    ranges: true,
  }) as n.Node as n.Program;

  return n.ExpressionStatement.check(program.body[0]) &&
    n.AssignmentExpression.check(program.body[0].expression) &&
    astNodesAreEquivalent(
      program.body[0].expression.left,
      b.memberExpression(b.identifier("module"), b.identifier("exports"))
    ) &&
    n.CallExpression.check(program.body[0].expression.right) &&
    astNodesAreEquivalent(
      program.body[0].expression.right.callee,
      b.memberExpression(b.identifier("JSON"), b.identifier("parse"))
    ) &&
    n.Literal.check(program.body[0].expression.right.arguments[0]) &&
    typeof program.body[0].expression.right.arguments[0].value === "string"
    ? {
        json: true,
        data: JSON.parse(program.body[0].expression.right.arguments[0].value),
      }
    : { json: false };
}
