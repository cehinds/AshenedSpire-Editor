# Repository handoff

Local editor source repository has `main`, `test`, and `dev` at the same verified bootstrap commit; active branch is `dev`. No remote origin exists. The source package includes an `AshenedSpireEditor.bundle` Git archive with all three branches and a working source copy, generated local build, and numbered static preview sample.

To restore Git history into a new directory:

```sh
git clone --branch dev AshenedSpireEditor.bundle AshenedSpireEditor
cd AshenedSpireEditor
git branch main origin/main
git branch test origin/test
```

The source ZIP places the bundle in `repository-history/`; use that path when cloning from the extracted package. `origin` in the restored clone refers to the local bundle, not a network repository. Source account/checkouts, installed dependencies and QA mount are excluded. First authenticated-host visit creates your own owner account; there are no delivered credentials.

`dist/` is the compiled local-host build. `preview-site/AshenedSpireEditor/dev/42-1/` is a static offline-authoring sample, served from the preview-site root; it does not support password authentication or checkout operations. Its build number is a local sample, not a GitHub Actions run or published deployment.

CI/CD remains prepared for future remote use; no connection or publication happened during this delivery. See local workflow and CI/CD documents for mode boundaries and promotion rules.
