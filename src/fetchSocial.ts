import { writeFile } from "node:fs/promises";
import { argv } from "node:process";

// you need im_ after the numbers so they don't mess with the JS or anything
// example custom URL: https://web.archive.org/web/20210322135140im_/https://krunker.io/social.html
const [, , destination, url = "https://krunker.io/social.html"] = argv;

if (!destination) throw new TypeError("Need output destination");

const res = await fetch(url);

const [, script] =
  (await res.text()).match(
    /<script(?: type="text\/javascript")?>(\/\*!\n \*[\s\S]*?)<\/script>/
  ) || [];

if (!script) throw new TypeError("No script");

await writeFile(destination, script);
