/** Centralize release checks so a branch or mismatched package cannot be published. */
export function releaseInfo(metadata, { tag, refType, repository }) {
  const version = metadata.version;
  if (
    typeof version !== "string" ||
    !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/u.test(
      version,
    )
  ) {
    throw new Error(
      "Release requires a semantic package version without build metadata.",
    );
  }
  const prerelease = version.split("-").slice(1).join("-");
  if (prerelease.split(".").some((part) => /^0\d+$/u.test(part))) {
    throw new Error(
      "Numeric prerelease identifiers must not contain leading zeroes.",
    );
  }
  const expectedTag = `${metadata.name}-v${version}`;
  if (refType !== "tag" || tag !== expectedTag) {
    throw new Error(`Release must run from the exact tag ${expectedTag}.`);
  }
  const expectedRepository = `git+https://github.com/${repository}.git`;
  if (!repository || metadata.repository?.url !== expectedRepository) {
    throw new Error(
      `package.json repository.url must match ${expectedRepository}.`,
    );
  }
  if (
    metadata.name !== "my-bahasa-gweh" ||
    metadata.publishConfig?.access !== "public" ||
    metadata.publishConfig?.registry !== "https://registry.npmjs.org/"
  ) {
    throw new Error(
      "Release package name, access or registry does not match npm configuration.",
    );
  }
  return { version, distTag: version.includes("-") ? "next" : "latest" };
}
