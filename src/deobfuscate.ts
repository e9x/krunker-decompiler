import "source-map-support/register.js";
import { unpackedDir } from "./consts.js";
import { readFile } from "node:fs/promises";
import { argv } from "node:process";
import { rimraf } from "rimraf";
import { webcrack } from "webcrack";

const [, , script] = argv;
let code = await readFile(script, "utf-8");

const res = await webcrack(code, { unpack: true });
console.log("Deobfuscated. Saving unpacked modules.");
await rimraf(unpackedDir);
await res.save(unpackedDir);
// await writeFile(deobfuscated, code);
