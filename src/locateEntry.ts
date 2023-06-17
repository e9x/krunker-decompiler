import "source-map-support/register.js";
import { deobfuscated } from "./consts.js";
import { findWebpackLoader } from "./libUnpackWebpack.js";
import { parse } from "acorn";
import { namedTypes as n } from "ast-types";
import { readFile } from "node:fs/promises";

const code = await readFile(deobfuscated, "utf-8");
const program = parse(code, { ecmaVersion: "latest" });

if (!n.Program.assert(program)) throw new Error();

const webpackLoader = findWebpackLoader(program);
if (!webpackLoader) throw new TypeError("No loader");

const { body } = webpackLoader.expression.callee;

const ret = body.body[body.body.length - 1];

// ret = `return require(require.s = 128903128941)`
if (!n.ReturnStatement.assert(ret)) throw new TypeError("bad webpack loader");
if (!n.CallExpression.assert(ret.argument))
  throw new TypeError("bad webpack loader");
if (!n.AssignmentExpression.assert(ret.argument.arguments[0]))
  throw new TypeError("bad webpack loader");
if (!n.MemberExpression.assert(ret.argument.arguments[0].left))
  throw new TypeError("bad webpack loader");
if (!n.Identifier.assert(ret.argument.arguments[0].left.object))
  throw new TypeError("bad webpack loader");
if (!n.Identifier.assert(ret.argument.arguments[0].left.property))
  throw new TypeError("bad webpack loader");
if (!n.Literal.assert(ret.argument.arguments[0].right))
  throw new TypeError("bad webpack loader");
if (typeof ret.argument.arguments[0].right.value !== "number")
  throw new TypeError("bad webpack loader");

const entryID = ret.argument.arguments[0].right.value;

console.log("Entry point module ID:", entryID);
