# Release workflow

GitHub Actions publishes `my-bahasa-gweh` to npm. Release Please selects the next version from conventional commits, updates `package.json`, `package-lock.json` and `CHANGELOG.md` in a release PR, and creates the GitHub Release after merge. The workflow then validates and smoke-tests one package tarball before publishing it through npm OIDC Trusted Publishing with provenance.

## One-time GitHub setup

Create one GitHub App for Release Please and install it on this repository (the same App can serve other package repositories). Grant these repository permissions:

| Permission    | Access         |
| ------------- | -------------- |
| Contents      | Read and write |
| Issues        | Read and write |
| Pull requests | Read and write |

In this repository's **Settings → Secrets and variables → Actions**, add:

| Kind     | Name                             | Value                        |
| -------- | -------------------------------- | ---------------------------- |
| Variable | `RELEASE_PLEASE_APP_ID`          | The GitHub App ID            |
| Secret   | `RELEASE_PLEASE_APP_PRIVATE_KEY` | The private key for that App |

The App token lets CI run on Release Please pull requests. Never commit or share its private key.

Add these settings separately to every repository using the App; its ID and private key can be reused. Protect `main` so changes require a pull request and the GitHub Actions check **CI gate**. Allow **squash and merge only**, use the pull request title as the squash commit title, and enable automatic deletion of merged branches. Conventional pull request titles then remain visible to Release Please. Do not require an approval count that blocks the sole maintainer from merging. Publication automation requires the App installation and both Actions values above in this repository.

## One-time npm setup

In npm package settings, configure a GitHub Actions Trusted Publisher:

| Setting              | Value                      |
| -------------------- | -------------------------- |
| Organization or user | `Alfian57`                 |
| Repository           | `my-bahasa-gweh`           |
| Workflow filename    | `publish.yml`              |
| Environment          | Leave empty                |
| Publishing mode      | Allow direct `npm publish` |

The workflow uses Node.js 24 and npm 11.16.0 with `id-token: write`. Do not add an `NPM_TOKEN`. Keep the workflow filename as `publish.yml` to match the Trusted Publisher configuration.

## Releasing a change

1. Make changes on a feature branch and use [Conventional Commits](https://www.conventionalcommits.org/), such as `fix: handle empty profile` or `feat: add profile export option`.
2. Open a pull request to `main`. The required **CI gate** runs tests and `npm pack --dry-run` on Linux, macOS and Windows across Node.js 18, 20, 22 and 24, then smoke-tests an installable tarball.
3. Merge after CI passes. The push to `main` runs Release Please, which opens or updates a release PR when it finds releasable commits.
4. Review the generated version and changelog. Merge the release PR only after its **CI gate** passes.
5. Release Please creates the version tag and GitHub Release. The same workflow validates the tag/repository, builds and smoke-tests a tarball, and publishes it through npm OIDC.
6. Check the `Release and publish npm package` workflow and npm version before installing:

   ```sh
   npm view my-bahasa-gweh version
   npm install -g my-bahasa-gweh@latest
   my-bahasa-gweh --version
   ```

After confirming a feature PR is merged, update local `main` with `git pull --ff-only`. Check that the worktree is clean and compare the local feature branch's commit with the merged PR's `headRefOid` before removing that local branch. Squash commits do not preserve feature-branch ancestry, so a verified merged branch may require `git branch -D`. GitHub deletes the remote branch automatically through the repository setting.

Stable versions use `latest`; prereleases use `next`. A retry skips an existing npm version only when its SHA-512 integrity matches the exact tarball. A mismatch fails safely because npm versions are immutable.

## Recovering a failed publication

Fix the issue first. For code or validation fixes, dispatch `publish.yml` from `main` and pass the existing Release Please tag. The workflow validates using its current guard and loads package metadata and release contents from the selected tag:

```sh
gh workflow run publish.yml --repo Alfian57/my-bahasa-gweh --ref main -f release_tag=my-bahasa-gweh-v0.5.0
```

The retry validates the tag against package metadata at that tag, reruns CI, and reuses the same tarball integrity guard. Branch refs and mismatched tags fail validation. Do not move tags, run `npm version`, or publish from a local machine.
