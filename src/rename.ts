import "source-map-support/register.js";
import { processedDir, renamedDir } from "./consts.js";
import extractJSON from "./libExtractJSON.js";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, parse, relative, resolve } from "node:path";
import { rimraf } from "rimraf";

await rimraf(renamedDir);
await mkdir(renamedDir);

// Get JSON modules

interface NewData {
  /**
   * New data
   */
  data: string;
  /**
   * New path
   */
  path: string;
}

const data = new Map(
  await Promise.all(
    await readdir(processedDir, { withFileTypes: true }).then((ents) =>
      ents
        .filter((ent) => ent.isFile())
        .map(async (ent) => {
          const path = join(processedDir, ent.name);
          const renamedPath = join(renamedDir, ent.name);

          return [
            renamedPath,
            {
              data: await readFile(path, "utf-8"),
              path: renamedPath,
            },
          ] as [string, NewData];
        })
    )
  )
);

for await (const [, newData] of data) {
  try {
    const json = extractJSON(newData.data);

    if (json.json) {
      newData.path = join(renamedDir, `${parse(newData.path).name}.json`);
      newData.data = JSON.stringify(json.data, undefined, 2);
    }
  } catch (err) {
    console.log(data);
    console.error(err);
  }
}

for (const [, newData] of data) {
  newData.data = newData.data.replace(/require\('(.*?)'\)/g, (match, id) => {
    const resolvedPath = resolve(id, newData.path);

    for (const [depPath, newDepData] of data) {
      if (depPath === resolvedPath)
        return `require(${JSON.stringify(
          relative(newData.path, newDepData.path)
        )})`;
    }

    return match;
  });

  await writeFile(newData.path, newData.data);
}
