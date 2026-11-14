import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { releaseInfo } from "../scripts/release-info.mjs";
import { publicationNeeded } from "../scripts/publication-state.mjs";
import { verifyPublishedVersion } from "../scripts/verify-publication.mjs";

const metadata = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);
const releaseConfig = JSON.parse(
  await readFile(
    new URL("../.release-please-config.json", import.meta.url),
    "utf8",
  ),
);
const releaseManifest = JSON.parse(
  await readFile(
    new URL("../.release-please-manifest.json", import.meta.url),
    "utf8",
  ),
);
const source = {
  tag: `v${metadata.version}`,
  refType: "tag",
  repository: "Alfian57/my-bahasa-gweh",
};

test("Release Please config and manifest match package metadata", () => {
  assert.equal(releaseConfig["release-type"], "node");
  assert.equal(releaseConfig.packages["."]["package-name"], metadata.name);
  assert.equal(releaseManifest["."], metadata.version);
});

test("local release scripts and version hooks are removed", () => {
  assert.equal(
    Object.keys(metadata.scripts).some((script) =>
      script.startsWith("release:"),
    ),
    false,
  );
  assert.equal(metadata.scripts.preversion, undefined);
  assert.equal(metadata.scripts.version, undefined);
});

test("stable releases select latest and prereleases select next", () => {
  assert.deepEqual(releaseInfo(metadata, source), {
    version: metadata.version,
    distTag: "latest",
  });
  const prerelease = { ...metadata, version: "1.0.0-beta.2" };
  assert.equal(
    releaseInfo(prerelease, { ...source, tag: "v1.0.0-beta.2" }).distTag,
    "next",
  );
});

for (const [label, override] of [
  ["a branch ref", { refType: "branch" }],
  ["an unmatched tag", { tag: "v9.9.9" }],
  ["a different repository", { repository: "someone-else/my-bahasa-gweh" }],
]) {
  test(`release guard rejects ${label}`, () => {
    assert.throws(() => releaseInfo(metadata, { ...source, ...override }));
  });
}

for (const [label, override] of [
  ["invalid package name", { name: "other-package" }],
  ["private package access", { publishConfig: { access: "restricted" } }],
  [
    "unexpected registry",
    { publishConfig: { access: "public", registry: "https://example.com" } },
  ],
  ["invalid semantic version", { version: "01.0.0" }],
  ["empty prerelease identifier", { version: "1.0.0-beta..1" }],
  ["leading zero in numeric prerelease", { version: "1.0.0-beta.01" }],
]) {
  test(`release guard rejects ${label}`, () => {
    const changed = { ...metadata, ...override };
    assert.throws(() =>
      releaseInfo(changed, {
        ...source,
        tag: `v${changed.version ?? metadata.version}`,
      }),
    );
  });
}

test("an unpublished version requires a publish", () => {
  assert.equal(
    publicationNeeded(Buffer.from("tested archive"), undefined),
    true,
  );
});

test("a published version is skipped only for identical tarball bytes", () => {
  const tarball = Buffer.from("tested archive");
  const integrity = `sha512-${createHash("sha512").update(tarball).digest("base64")}`;
  assert.equal(publicationNeeded(tarball, { dist: { integrity } }), false);
  assert.throws(
    () =>
      publicationNeeded(Buffer.from("different archive"), {
        dist: { integrity },
      }),
    /different tarball/u,
  );
  assert.throws(() => publicationNeeded(tarball, {}), /different tarball/u);
});

test("registry verification retries temporary responses then checks exact integrity", async () => {
  const tarball = Buffer.from("published package");
  const integrity = `sha512-${createHash("sha512").update(tarball).digest("base64")}`;
  let now = 0;
  let calls = 0;
  const result = await verifyPublishedVersion({
    name: metadata.name,
    version: metadata.version,
    tarball,
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) return { ok: false, status: 404 };
      if (calls === 2) return { ok: false, status: 503 };
      return {
        ok: true,
        status: 200,
        json: async () => ({ version: metadata.version, dist: { integrity } }),
      };
    },
    sleepImpl: async (milliseconds) => {
      now += milliseconds;
    },
    nowImpl: () => now,
    timeoutMs: 100,
    pollIntervalMs: 10,
  });
  assert.equal(calls, 3);
  assert.deepEqual(result, {
    name: metadata.name,
    version: metadata.version,
    integrity,
  });
});

test("registry verification rejects mismatched integrity and permanent errors", async () => {
  const tarball = Buffer.from("expected package");
  const different = Buffer.from("different package");
  const wrongIntegrity = `sha512-${createHash("sha512").update(different).digest("base64")}`;
  await assert.rejects(
    verifyPublishedVersion({
      name: metadata.name,
      version: metadata.version,
      tarball,
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          version: metadata.version,
          dist: { integrity: wrongIntegrity },
        }),
      }),
    }),
    /different tarball/u,
  );
  await assert.rejects(
    verifyPublishedVersion({
      name: metadata.name,
      version: metadata.version,
      tarball,
      fetchImpl: async () => ({ ok: false, status: 403 }),
    }),
    /HTTP 403/u,
  );
});

test("registry verification stops after its bounded wait", async () => {
  let now = 0;
  await assert.rejects(
    verifyPublishedVersion({
      name: metadata.name,
      version: metadata.version,
      tarball: Buffer.from("expected package"),
      fetchImpl: async () => ({ ok: false, status: 404 }),
      sleepImpl: async (milliseconds) => {
        now += milliseconds;
      },
      nowImpl: () => now,
      timeoutMs: 25,
      pollIntervalMs: 10,
    }),
    /within 25 ms/u,
  );
});

test("release workflow uses main pushes, App auth, Release Please and OIDC", async () => {
  const workflow = (
    await readFile(new URL("../.github/workflows/publish.yml", import.meta.url), "utf8")
  ).replace(/\r\n/gu, "\n");
  assert.match(workflow, /push:\n\s+branches: \[main\]/u);
  assert.match(workflow, /workflow_dispatch:/u);
  assert.doesNotMatch(workflow, /tags:\s*\n\s+- ['"]?v\*/u);
  assert.match(workflow, /actions\/create-github-app-token@/u);
  assert.match(workflow, /googleapis\/release-please-action@/u);
  assert.match(workflow, /Check Release Please App configuration/u);
  assert.match(workflow, /RELEASE_PLEASE_APP_PRIVATE_KEY/u);
  assert.match(workflow, /npm publish .*--provenance/u);
});

test("CI exposes a required gate for PRs and reusable retry checks", async () => {
  const workflow = (
    await readFile(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8")
  ).replace(/\r\n/gu, "\n");
  assert.match(workflow, /pull_request:\n\s+branches:\n\s+- main/u);
  assert.match(workflow, /workflow_call:/u);
  assert.match(workflow, /name: CI gate/u);
  assert.match(workflow, /name: Installable package smoke test/u);
});
