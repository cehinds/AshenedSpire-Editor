# AshenedSpire Editor documentation

| Document | Purpose |
|---|---|
| [Architecture](architecture.md) | Folder map, browser/local-host boundaries, account and build data ownership |
| [CI/CD](ci-cd.md) | `dev` → `test` → `main`, fast checks, prepared versioned Pages workflows |
| [Export formats](export-formats.md) | Workbench/native JSON/CSV boundaries and genuine Excel `.xlsx` output |
| [Project README](../README.md) | Startup, nine workspaces, source provenance, working features and limits |
| [Local game workflow](local-workflow.md) | Practical local import, branch, source save, settings promotion and build steps |
| [Repository handoff](repository-handoff.md) | Restore all three source branches from bundled Git archive |
| [Validation](validation.md) | Final test/build/browser evidence and limits |
| [Tool audit](tool-audit.md) | Browser evidence and validation scope |
| [Design reference](../design/AshenSpire-Parent-Design.pdf) | Approved parent shell design; original reference retains original project name |

No editor account or GitHub connection is required to use the editor locally. Account optionally authorizes GitHub through GitHub CLI and the OS default browser. Site publication remains paused and the remote Pages workflow is disabled; source promotion remains dev → test → main.
