import { appendFile, readFile } from "node:fs/promises";
import { packageMetadata } from "./lib.mjs";
import { publicationNeeded } from "./publication-state.mjs";

const tarball = process.env.TARBALL || process.argv[2];
if (!tarball) throw new Error("Expected the tested tarball path.");
const metadata = await packageMetadata();
const url = `https://registry.npmjs.org/${encodeURIComponent(metadata.name)}/${encodeURIComponent(metadata.version)}`;
const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
if (!response.ok && response.status !== 404) {
  throw new Error(
    `Cannot check npm version: registry returned HTTP ${response.status}.`,
  );
}
const existing = response.status === 404 ? undefined : await response.json();
const publish = publicationNeeded(await readFile(tarball), existing);
console.log(
  publish
    ? "Version is not published yet."
    : "Identical tarball is already published; skipping duplicate publish.",
);
if (process.env.GITHUB_OUTPUT)
  await appendFile(process.env.GITHUB_OUTPUT, `publish=${publish}\n`);
