import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { packageMetadata, root, runNpm } from "./lib.mjs";

const metadata = await packageMetadata();
const directory = path.join(root, "artifacts");
await mkdir(directory, { recursive: true });
const packed = JSON.parse(
  runNpm(["pack", "--json", "--pack-destination", directory], {
    stdio: "pipe",
  }),
);
const filename = packed[0]?.filename;
if (
  !filename ||
  path.basename(filename) !== filename ||
  !filename.endsWith(".tgz")
) {
  throw new Error("npm pack did not return a valid tarball filename.");
}
const tarball = path.join(directory, filename);
const digest = createHash("sha256")
  .update(await readFile(tarball))
  .digest("hex");
const checksum = `${tarball}.sha256`;
await writeFile(checksum, `${digest}  ${filename}\n`);
console.log(`Package: ${tarball}\nSHA-256: ${digest}`);

if (process.env.GITHUB_OUTPUT) {
  await appendFile(
    process.env.GITHUB_OUTPUT,
    `tarball=artifacts/${filename}\nchecksum=artifacts/${filename}.sha256\n`,
  );
}
