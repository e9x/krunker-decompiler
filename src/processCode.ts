import "source-map-support/register.js";
import { processCode } from "./processWorker.js";
import { writeFile, readFile } from "node:fs/promises";
import { webcrack } from "webcrack";

const programArgv = [...process.argv.slice(2)]; // clone the array to modify it

const deobfuscateI = programArgv.indexOf("--deobfuscate");
const deobfuscate = deobfuscateI !== -1;
if (deobfuscate) programArgv.splice(deobfuscateI, 1);

const [file, output] = programArgv;

if (!file) {
  console.log(`${process.argv
    .slice(0, 2)
    .join(" ")} [<file>|<code>] [<output>] [--deobfuscate]

Arguments:
    <file>           Path to a file containing the code
    <code>           The actual code (if not using a file)
    <output>         Location to output the code (default: stdout)

Options:
    --deobfuscate    Flag indicating whether the code should be deobfuscated using webcrack`);
  process.exit(0);
}

let code: string;

try {
  // try reading it as a file
  code = await readFile(file, "utf-8");
} catch {
  // use it as code
  code = file;
}

if (deobfuscate) {
  const { log } = console;
  console.log = () => {
    // noop
  };
  ({ code } = await webcrack(code));
  console.log = log;
}

const parsed = processCode(code);

if (output) {
  await writeFile(output, parsed);
} else {
  console.log(parsed);
}
