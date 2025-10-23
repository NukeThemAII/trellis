## 2025-10-23T11:30:05Z [Design|Docs]
- Summary: Bootstrapped Trellis monorepo from Scaffold-ETH 2 (Foundry preset), migrated to pnpm workspace, and documented baseline architecture + tooling.
- Versions: Node=24.6.0, Next=16.0.0, wagmi=2.18.2, rainbowkit=2.2.9, viem=2.38.3, Foundry=1.4.3, OZ=5.4.0
- Changes: package.json, pnpm-workspace.yaml, frontend/package.json, contracts/package.json, contracts/foundry.toml, README.md, LOG.md, LICENSE, CODE_OF_CONDUCT.md, docs/addresses.base*.json, .gitignore
- Decisions: Adopted Scaffold-ETH 2 for speed and aligned layout to requirements; stayed on Next 16.0.0 + React 19 (latest) while tracking walletconnect peer warning (React <=18) for follow-up; pruned Scaffold-ETH extras (IPFS, burner stack) to focus on vault requirements; standardized on pnpm for deterministic installs.
- Next: 1) Draft vault + strategy contract skeletons w/ fee accounting design. 2) Define frontend routing + data layer aligned with contracts ABI. 3) Add CI workflows (contracts + frontend) including Foundry, Slither, ESLint, and Next build.
- Reviewer: TBD
