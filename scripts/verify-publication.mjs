import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { packageMetadata } from "./lib.mjs";
import { publicationNeeded } from "./publication-state.mjs";

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_POLL_INTERVAL_MS = 5_000;

export async function verifyPublishedVersion({
  name,
  version,
  tarball,
  fetchImpl = fetch,
  sleepImpl = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
  nowImpl = Date.now,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  fetchTimeoutMs = 10_000,
}) {
  const url = `https://registry.npmjs.org/${encodeURIComponent(name)}/${encodeURIComponent(version)}`;
  const deadline = nowImpl() + timeoutMs;
  let lastError;

  while (nowImpl() < deadline) {
    const remaining = deadline - nowImpl();
    let response;
    try {
      response = await fetchImpl(url, {
        signal: AbortSignal.timeout(
          Math.max(1, Math.min(fetchTimeoutMs, remaining)),
        ),
      });
    } catch (error) {
      lastError = error;
      await sleepImpl(
        Math.min(pollIntervalMs, Math.max(0, deadline - nowImpl())),
      );
      continue;
    }

    if (
      response.status === 404 ||
      response.status === 429 ||
      response.status >= 500
    ) {
      lastError = new Error(`npm registry returned HTTP ${response.status}.`);
    } else if (!response.ok) {
      throw new Error(
        `Cannot verify npm publication: registry returned HTTP ${response.status}.`,
      );
    } else {
      let metadata;
      try {
        metadata = await response.json();
      } catch (error) {
        lastError = error;
        await sleepImpl(
          Math.min(pollIntervalMs, Math.max(0, deadline - nowImpl())),
        );
        continue;
      }
      if (metadata?.version !== version) {
        lastError = new Error(
          `Registry returned unexpected version ${String(metadata?.version)}.`,
        );
      } else {
        publicationNeeded(tarball, metadata);
        return { name, version, integrity: metadata.dist.integrity };
      }
    }

    await sleepImpl(
      Math.min(pollIntervalMs, Math.max(0, deadline - nowImpl())),
    );
  }

  throw new Error(
    `npm registry did not expose ${name}@${version} with matching integrity within ${timeoutMs} ms.`,
    { cause: lastError },
  );
}

async function main() {
  const tarballPath = process.argv[2];
  if (!tarballPath) throw new Error("Expected the tested tarball path.");
  const metadata = await packageMetadata();
  await verifyPublishedVersion({
    name: metadata.name,
    version: metadata.version,
    tarball: await readFile(path.resolve(tarballPath)),
  });
  console.log(
    `Verified ${metadata.name}@${metadata.version} is available on npm.`,
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await main();
}
