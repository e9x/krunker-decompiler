import "source-map-support/register.js";
import { processedDir, unpackedDir } from "./consts.js";
import { processCode } from "./processWorker.js";
import { mkdir, opendir, writeFile, readFile } from "node:fs/promises";
import { join, parse } from "node:path";
import { argv, exit, stdout } from "node:process";
import P from "piscina";
import prettyMilliseconds from "pretty-ms";
import { rimraf } from "rimraf";

const [, , file, output] = argv;

if (file) {
  let code: string;

  try {
    // try reading it as a file
    code = await readFile(file, "utf-8");
  } catch {
    // use it as code
    code = file;
  }

  const parsed = processCode(code);

  if (output) {
    await writeFile(output, parsed);
  } else {
    stdout.write(parsed);
    stdout.end();
  }

  exit();
}

const pool = new P.Piscina({
  filename: new URL("./processWorker.js", import.meta.url).toString(),
  maxQueue: 100000,
  concurrentTasksPerWorker: 3,
});

await rimraf(processedDir);
await mkdir(processedDir);

type Data = [path: string, promise: Promise<void>, resolved: boolean];

const promises: Data[] = [];

for await (const ent of await opendir(unpackedDir)) {
  if (!ent.isFile()) continue;
  const path = join(unpackedDir, ent.name);
  const data: Data = [path, pool.run(path), false];
  promises.push(data);
  data[1].finally(() => (data[2] = true));
}

const start = Date.now();

const interval = setInterval(() => {
  console.log(
    `[${prettyMilliseconds(Date.now() - start).padEnd(
      7,
      " "
    )}] Waiting for: ${promises
      .filter((d) => !d[2])
      .map((d) => parse(d[0]).name)
      .join(", ")}`
  );
}, 10e3);

await Promise.all(promises.map(([, promise]) => promise));

clearInterval(interval);

console.log("Completed");
