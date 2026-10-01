# Repository handoff

Current handoff: the editor opens without a local account or sign-in. Its loopback host automatically establishes a session while retaining CSRF/origin checks, private-path restrictions and sandboxed build previews. Account is optional GitHub authorization through GitHub CLI and the OS default browser; passwords/tokens stay outside the editor frontend. Account authorization does not imply a repository clone succeeded. The approved delivery publishes consolidated HTML from `test` to `https://cehinds.github.io/AshenedSpire-Editor/test/<run-number>-<attempt>/`, retaining immutable history and channel latest links. Preserve dev → test → main source promotion.

The current `dist/pages/index.html` embeds the editor, native ERD, source snapshots, assets and native game preview runtime. In game tabs and Scenes Play preview run bundled native renderers without checkout writes or saved-game persistence. Local and Sites outputs remain separate. See [preview behavior and limits](in-game-preview.md).

The original source package described below contains `main`, `test`, and `dev` at the same verified bootstrap commit, with active branch `dev` and no network remote. It includes an `AshenedSpireEditor.bundle` Git archive with all three branches and a working source copy, generated local build, and numbered static preview sample. These describe the original archive, not current remote or branch state.

To restore Git history into a new directory:

```sh
git clone --branch dev AshenedSpireEditor.bundle AshenedSpireEditor
cd AshenedSpireEditor
git branch main origin/main
git branch test origin/test
```

The source ZIP places the bundle in `repository-history/`; use that path when cloning from the extracted package. `origin` in the restored clone refers to the local bundle, not a network repository. Source account/checkouts, installed dependencies and QA mount are excluded. The current editor needs no owner account; no credentials are delivered. Its retained password-mode library is available only for explicitly configured hosts/tests, with server-side hashes and a five-character minimum.

`dist/` is the compiled local-host build. `preview-site/AshenedSpireEditor/dev/42-1/` is a static offline-authoring sample, served from the preview-site root; it does not support password authentication or checkout operations. Its build number is a local sample, not a GitHub Actions run or published deployment.

The original archive delivery did not connect or publish remotely. The current approved delivery uses the existing GitHub repository and Pages workflow; original archive statements do not describe current publication state. See local workflow and CI/CD documents for mode boundaries and promotion rules.
