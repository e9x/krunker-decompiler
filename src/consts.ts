import { fileURLToPath } from "node:url";

export const deobfuscated = fileURLToPath(
  new URL("../deobfuscated.js", import.meta.url)
);
export const unpackedDir = fileURLToPath(
  new URL("../unpacked/", import.meta.url)
);
export const processedDir = fileURLToPath(
  new URL("../processed/", import.meta.url)
);
export const renamedDir = fileURLToPath(
  new URL("../renamed/", import.meta.url)
);
