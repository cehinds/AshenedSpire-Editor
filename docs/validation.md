# Validation — September 30, 2026

57 named tests passed with zero failures; full suite took 3.8 seconds locally. Source review inspected 62 files. Production build and nested Pages paths passed. Desktop and 390 px browser checks passed; report records credential and downloaded-byte limits.

Actual original game settings validator accepted deck minimum 11 and --check, rejected minimum -1 and unknown key atomically. Original defaults stayed unchanged. This native smoke did not rebuild the actual game. Authenticated fixture source edit/save/build produced edited HTML; it is distinct from full game runtime verification.

CI templates cap each job at five minutes and are not live on GitHub. No remote was created, connected or published. See [tool audit](tool-audit.md) for observations, mode restrictions and remaining work.
