import "source-map-support/register.js";
import { processedDir } from "./consts.js";
import decompile from "./libDecompile.js";
import renameVars from "./libRenameVars.js";
import toCommonJS from "./libToCommonJS.js";
import escodegen from "@javascript-obfuscator/escodegen";
import { parse as parseScript } from "acorn";
import type { namedTypes as n } from "ast-types";
import crc32 from "crc-32";
import { readFile, writeFile } from "node:fs/promises";
import { join, parse } from "node:path";

export function processCode(code: string) {
  let program = parseScript(code, {
    ecmaVersion: "latest",
    allowReturnOutsideFunction: true,
  }) as n.Node as n.Program;

  decompile(program);
  toCommonJS(program);

  code = escodegen.generate(program);

  program = parseScript(code, {
    ecmaVersion: "latest",
    ranges: true,
    allowReturnOutsideFunction: true,
  }) as n.Node as n.Program;

  const hash = crc32.str(code);

  renameVars(program, hash);

  return escodegen.generate(program);
}

export default async function processWorker(file: string) {
  const name = parse(file).name;
  const code = await readFile(file, "utf-8");

  try {
    await writeFile(join(processedDir, `${name}.js`), processCode(code));
  } catch (err) {
    console.error("Failure processing:", name);
    throw err;
  }

  console.log("Wrote", name);
}
