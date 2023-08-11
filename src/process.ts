import "source-map-support/register.js";
import { processedDir, unpackedDir } from "./consts.js";
import { mkdir, readFile } from "node:fs/promises";
import { join, parse } from "node:path";
import P from "piscina";
import prettyMilliseconds from "pretty-ms";
import { rimraf } from "rimraf";

const bundle = JSON.parse(
  await readFile(join(unpackedDir, "bundle.json"), "utf-8")
) as {
  type: "webpack" | "browserify";
  entryId: string;
  modules: {
    id: string;
    path: string;
  }[];
};

const pool = new P.Piscina({
  filename: new URL("./processWorker.js", import.meta.url).toString(),
  maxQueue: 100000,
  concurrentTasksPerWorker: 3,
});

await rimraf(processedDir);
await mkdir(processedDir);

type Data = [path: string, promise: Promise<void>, resolved: boolean];

const promises: Data[] = [];

for await (const ent of bundle.modules) {
  const path = join(unpackedDir, ent.path);
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
