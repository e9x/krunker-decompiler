import "source-map-support/register.js";
import { deobfuscated, unpackedDir } from "./consts.js";
import unpackWebpack from "./libUnpackWebpack.js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { rimraf } from "rimraf";

const unpacked = await unpackWebpack(await readFile(deobfuscated, "utf-8"));

await rimraf(unpackedDir);
await mkdir(unpackedDir);

if (unpacked)
  for (const res of unpacked)
    await writeFile(join(unpackedDir, `${res.id}.js`), res.code);

console.log("Completed");
