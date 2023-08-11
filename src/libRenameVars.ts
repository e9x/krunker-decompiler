import { generateRandomWords } from "./generateRandomWords.js";
import escodegen from "@javascript-obfuscator/escodegen";
import { namedTypes as n, builders as b, visit } from "ast-types";
import { astNodesAreEquivalent } from "ast-types";
import { camelCase } from "camel-case";
import type { Scope as ESLintScope } from "eslint";
import type { Scope, Variable } from "eslint-scope";
import { analyze } from "eslint-scope";
import MersenneTwister from "mersenne-twister";
import { pascalCase } from "pascal-case";

const iiiiiii = /(?:i|[^\sa-z0-9]){4,}$|_0x[a-zA-Z0-9]{6}/i;

function getVarPrefix(type: ESLintScope.DefinitionType["type"]) {
  switch (type) {
    case "FunctionName":
      return "func";
    case "Parameter":
      return "arg";
    case "ClassName":
      return "Class";
    case "ImportBinding":
      return "imported";
    default:
      return "var";
  }
}

const reservedWords = [
  "arguments",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "function",
  "get",
  "if",
  "import",
  "in",
  "instanceof",
  "new",
  "null",
  "return",
  "set",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
];

const getName = (name: string, testName: (name: string) => boolean) => {
  if (reservedWords.includes(name)) name = `_${name}`;

  for (let i = 0; i < 1e6; i++) {
    const newName = name + (i === 0 ? "" : i);

    i++;

    if (!testName(newName)) continue;

    return newName;
  }

  throw new Error("FAIL");
};

interface StaticScopeData {
  assignmentExpressions: n.AssignmentExpression[];
  defineProperties: {
    /**
     * Object.defineProperty(exports, **"name"**, { get: function() { return getIdentifier; } })
     */
    name: string;
    /**
     * Object.defineProperty(exports, "name", { get: function() { return **getIdentifier;** } })
     */
    getIdentifier: n.Identifier;
  }[];
}

function fetchStaticScopeData(scope: Scope) {
  const data: StaticScopeData = {
    assignmentExpressions: [],
    defineProperties: [],
  };

  visit(scope.block, {
    visitIfStatement(path) {
      if (
        n.UnaryExpression.check(path.node.test) &&
        n.CallExpression.check(path.node.test.argument) &&
        astNodesAreEquivalent(
          path.node.test.argument.callee,
          b.memberExpression(
            b.memberExpression(
              b.memberExpression(
                b.identifier("Object"),
                b.identifier("prototype")
              ),
              b.identifier("hasOwnProperty")
            ),
            b.identifier("call")
          )
        ) &&
        astNodesAreEquivalent(
          path.node.test.argument.arguments[0],
          b.identifier("exports")
        ) &&
        n.Literal.check(path.node.test.argument.arguments[1]) &&
        n.ExpressionStatement.check(path.node.consequent) &&
        n.CallExpression.check(path.node.consequent.expression) &&
        astNodesAreEquivalent(
          path.node.consequent.expression.callee,
          b.memberExpression(
            b.identifier("Object"),
            b.identifier("defineProperty")
          )
        ) &&
        astNodesAreEquivalent(
          path.node.consequent.expression.arguments[0],
          b.identifier("exports")
        ) &&
        n.Literal.check(path.node.consequent.expression.arguments[1]) &&
        n.ObjectExpression.check(
          path.node.consequent.expression.arguments[2]
        ) &&
        n.Property.check(
          path.node.consequent.expression.arguments[2].properties[0]
        ) &&
        n.FunctionExpression.check(
          path.node.consequent.expression.arguments[2].properties[0].value
        ) &&
        n.ReturnStatement.check(
          path.node.consequent.expression.arguments[2].properties[0].value.body
            .body[0]
        ) &&
        n.Identifier.check(
          path.node.consequent.expression.arguments[2].properties[0].value.body
            .body[0].argument
        )
      )
        data.defineProperties.push({
          name:
            path.node.consequent.expression.arguments[1].value?.toString() ||
            "",
          getIdentifier:
            path.node.consequent.expression.arguments[2].properties[0].value
              .body.body[0].argument,
        });

      this.traverse(path);
    },
    visitAssignmentExpression(path) {
      data.assignmentExpressions.push(path.node);

      this.traverse(path);
    },
  });

  return data;
}

function generateName(
  mt: MersenneTwister,
  scope: Scope,
  v: ESLintScope.Variable,
  sd: StaticScopeData
) {
  const def0 = v.defs[0];
  const vars: Variable[] = [];

  let s: Scope | null = scope;
  while (s) {
    vars.push(...s.variables);
    s = s.upper;
  }

  let isClass = false;

  if (def0.type === "FunctionName" && def0.node.body.body.length === 0)
    return getName("noOp", (n) => !vars.some((s) => s.name === n));

  let isFuncVar = false;

  if (def0.type === "Variable" && n.FunctionExpression.check(def0.node.init)) {
    isFuncVar = true;

    visit(def0.node.init.body, {
      visitThisExpression() {
        isClass = true;
        this.abort();
      },
    });
  }

  if (def0.type === "FunctionName")
    visit(def0.node.body, {
      visitThisExpression() {
        isClass = true;
        this.abort();
      },
    });

  for (const node of sd.defineProperties) {
    if (astNodesAreEquivalent(node.getIdentifier, b.identifier(v.name))) {
      // TODO: check if v.identifiers contains this identifier, otherwise the node may be a completely different variable

      return getName(
        (isClass ? pascalCase : camelCase)("e_" + node.name),
        (n) => !vars.some((s) => s.name === n)
      );
    }
  }

  for (const node of sd.assignmentExpressions) {
    if (
      n.MemberExpression.check(node.left) &&
      n.Identifier.check(node.left.property) &&
      !node.left.computed &&
      astNodesAreEquivalent(node.right, b.identifier(v.name))
      /*&&
      v.references.some(
        (i) =>
          ((node.left as n.MemberExpression).property as n.Identifier) ===
          i.identifier
      )
      */
    ) {
      // TODO: check if v.identifiers contains this identifier, otherwise the node may be a completely different variable
      return getName(
        (isClass ? pascalCase : camelCase)("m_" + node.left.property.name),
        (n) => !vars.some((s) => s.name === n)
      );
    } else if (
      astNodesAreEquivalent(node.left, b.identifier(v.name)) &&
      n.ThisExpression.check(node.right)
    )
      return getName("this", (n) => !vars.some((s) => s.name === n));
  }

  const varPrefix = isClass
    ? "Class"
    : isFuncVar
    ? "func"
    : getVarPrefix(def0.type);

  if (
    def0.type === "Variable" &&
    n.CallExpression.check(def0.node.init) &&
    astNodesAreEquivalent(def0.node.init.callee, b.identifier("require")) &&
    n.Literal.check(def0.node.init.arguments[0]) &&
    typeof def0.node.init.arguments[0].value === "string"
  )
    return getName(
      camelCase("require" + def0.node.init.arguments[0].value),
      (n) => !vars.some((s) => s.name === n)
    );
  else if (
    def0.type === "Variable" &&
    n.MemberExpression.check(def0.node.init) &&
    n.Identifier.check(def0.node.init.property)
  )
    return getName(
      "p_" + def0.node.init.property.name,
      (n) => !vars.some((s) => s.name === n)
    );
  else if (def0.type === "Variable" && n.Identifier.check(def0.node.init))
    return getName(
      "v_" + def0.node.init.name,
      (n) => !vars.some((s) => s.name === n)
    );
  else if (def0.type === "Variable" && n.NewExpression.check(def0.node.init))
    return getName(
      camelCase(escodegen.generate(def0.node.init.callee)),
      (n) => !vars.some((s) => s.name === n)
    );
  else if (def0.type === "Variable" && n.ThisExpression.check(def0.node.init))
    for (let i = 0; ; i++) {
      const newName = "_this" + (i === 0 ? "" : i);

      i++;

      if (vars.some((s) => s.name === newName)) continue;

      return newName;
    }

  while (true) {
    const newName = varPrefix + generateRandomWords(mt, 2).join("");
    if (vars.some((s) => s.name === newName)) continue;
    return newName;
  }
}

export default function renameVars(program: n.Program, hash: number) {
  const mt = new MersenneTwister(hash);

  const scopeManger = analyze(program, {
    ecmaVersion: 6,
    sourceType: "module",
  });

  // first def, new name
  const renamedNodes = new WeakMap<object, string>();
  const renamedNames = new Map<string, string>();

  for (const scope of scopeManger.scopes) {
    // takes an awful long time before JIT
    // but < 10 ms after
    const sd = fetchStaticScopeData(scope);

    for (const v of scope.variables) {
      if (!iiiiiii.test(v.name)) continue;

      const firstDef = v.defs[0];

      const newName =
        renamedNodes.get(firstDef.node) || generateName(mt, scope, v, sd);

      renamedNames.set(v.name, newName);

      if (firstDef.type === "ClassName")
        renamedNodes.set(firstDef.node, newName);

      // used by generateName
      v.name = newName;

      for (const def of v.defs) def.name.name = newName;

      for (const ref of v.references) ref.identifier.name = newName;
    }

    // took the hack from the deobfuscator
    for (const ref of scope.references) {
      const got = renamedNames.get(ref.identifier.name);
      if (got) ref.identifier.name = got;
    }
  }

  const labels: string[] = [];

  // fix labels
  // eslint-scope doesn't have labels
  visit(program, {
    visitLabeledStatement(path) {
      while (true) {
        const newName = generateRandomWords(mt, 2).join("");
        if (labels.includes(newName)) continue;
        labels.push(newName);

        visit(path.node, {
          visitContinueStatement(subPath) {
            if (subPath.node.label?.name === path.node.label.name)
              subPath.replace(b.continueStatement(b.identifier(newName)));
            return false;
          },
          visitBreakStatement(subPath) {
            if (subPath.node.label?.name === path.node.label.name)
              subPath.replace(b.breakStatement(b.identifier(newName)));
            return false;
          },
        });

        path.replace(b.labeledStatement(b.identifier(newName), path.node.body));
        this.traverse(path);
        return;
      }
    },
  });
}
