import "source-map-support/register.js";
import { deobfuscated } from "./consts.js";
import { readFile, writeFile } from "node:fs/promises";
import { argv } from "node:process";
import { webcrack } from "webcrack";

const [, , script] = argv;
let code = await readFile(script, "utf-8");

code = (await webcrack(code)).code;

console.log("Writing deobfuscated");

await writeFile(deobfuscated, code);
