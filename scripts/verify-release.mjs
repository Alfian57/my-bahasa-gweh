import { appendFile } from "node:fs/promises";
import { packageMetadata } from "./lib.mjs";
import { releaseInfo } from "./release-info.mjs";

const info = releaseInfo(await packageMetadata(), {
  tag: process.env.RELEASE_TAG || process.env.GITHUB_REF_NAME,
  refType: process.env.RELEASE_TAG ? "tag" : process.env.GITHUB_REF_TYPE,
  repository: process.env.GITHUB_REPOSITORY,
});
console.log(`Verified v${info.version}; npm dist-tag: ${info.distTag}`);
if (process.env.GITHUB_OUTPUT) {
  await appendFile(
    process.env.GITHUB_OUTPUT,
    `version=${info.version}\ndist_tag=${info.distTag}\n`,
  );
}
