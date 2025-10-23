## 2025-10-24T10:30:00Z [Docs]
- Summary: Expanded the GitHub publishing runbook with explicit conflict-resolution steps so pushes can proceed smoothly even when rebasing or merging.
- Versions: Node=24.6.0, Next=16.0.0, wagmi=2.18.2, rainbowkit=2.2.9, viem=2.38.3, Foundry=1.4.3, OZ=5.4.0
- Changes: docs/runbooks/github-push.md, LOG.md
- Decisions: Documented both rebase and merge flows to match our preferred conventional history while giving operators an abort path.
- Next: Review CI automation to auto-detect stale branches before merge.
- Reviewer: TBD

## 2025-10-24T09:00:00Z [Code|Test|Frontend|Docs|Ops]
- Summary: Closed medium/low audit items by redeploying assets during strategy migrations, introducing a dedicated harvester role + keeper guardrails, threading asset decimals into UI metrics, validating Chainlink feed freshness, and restoring the documented env templates/docs.
- Versions: Node=24.6.0, Next=16.0.0, wagmi=2.18.2, rainbowkit=2.2.9, viem=2.38.3, Foundry=1.4.3, OZ=5.4.0
- Changes: contracts/src/TrellisVault.sol, contracts/src/strategies/StrategyERC4626.sol, contracts/test/TrellisVault.t.sol, frontend/app/page.tsx, frontend/app/vault/[address]/page.tsx, frontend/components/vaults/VaultOverviewCard.tsx, frontend/hooks/useVaultMetrics.ts, frontend/hooks/useUsdPrice.ts, frontend/config/vaults.ts, ops/keeper/harvest.ts, ops/README.md, contracts/.env.example, frontend/.env.local.example, ops/.env.example, README.md, AUDIT.md, LOG.md
- Decisions: Added an allowlisted harvester to keep access minimal while preserving owner authority; treated Chainlink answers older than one hour (configurable) as stale; shipped documented env templates to eliminate setup drift.
- Next: Expand strategy failure-mode tests (partial withdraw, non-zero loss) and surface paused state in the UI to proactively disable deposit/withdraw buttons.
- Reviewer: TBD

## 2025-10-23T15:42:00Z [Docs]
- Summary: Authored a GitHub publishing runbook for Trellis contributors and linked it from the README to guide pushing audit updates upstream.
- Versions: Node=24.6.0, Next=16.0.0, wagmi=2.18.2, rainbowkit=2.2.9, viem=2.38.3, Foundry=1.4.3, OZ=5.4.0
- Changes: docs/runbooks/github-push.md, README.md, LOG.md
- Decisions: Documented the preferred workflow using conventional commits and rebasing on origin/main before pushing to ensure clean history.
- Next: Review GitHub permissions and automate PR checklist once CI workflows are active.
- Reviewer: TBD

## 2025-10-23T15:05:00Z [Docs]
- Summary: Added document control metadata to AUDIT.md to clarify publication status and review cadence after prepping the audit for GitHub push.
- Versions: Node=24.6.0, Next=16.0.0, wagmi=2.18.2, rainbowkit=2.2.9, viem=2.38.3, Foundry=1.4.3, OZ=5.4.0
- Changes: AUDIT.md, LOG.md
- Decisions: Confirmed audit remains accurate; documented release state to satisfy publication request.
- Next: Monitor remediation progress and update audit once medium-severity findings are addressed.
- Reviewer: TBD

## 2025-10-23T12:59:15Z [Code|Frontend|Ops]
- Summary: Generated frontend contract artifacts from deployments, delivered vault detail flows (deposit/withdraw with allowances + pricing), and built the admin control surface for pause/harvest/strategy management.
- Versions: Node=24.6.0, Next=16.0.0, wagmi=2.18.2, rainbowkit=2.2.9, viem=2.38.3, Foundry=1.4.3, OZ=5.4.0
- Changes: scripts/generate-frontend-artifacts.mjs, frontend/contracts/abi/*, frontend/contracts/deployedContracts.ts, package.json, frontend/config/vaults.ts, frontend/app/vault/[address]/page.tsx, frontend/hooks/useVaultInfo.ts, frontend/hooks/useVaultUserState.ts, frontend/hooks/useUsdPrice.ts, frontend/components/vaults/VaultOverviewCard.tsx, frontend/app/admin/page.tsx, frontend/types/shims.d.ts, frontend/.env.local.example, README.md
- Decisions: Consolidated ABI/deployment generation to one script with env fallbacks for Base networks; vault detail UI enforces ERC20 approval flow and surfaces USD valuations via optional Chainlink feed; admin actions gated by vault ownership with network mismatch guardrails.
- Next: 1) Integrate broadcast outputs once Sepolia deployment occurs to auto-populate deployedContracts. 2) Implement per-vault activity/event feeds on detail pages. 3) Enhance admin view with fee recipient updates and strategy address validation against allowlists.
- Reviewer: TBD

## 2025-10-23T12:37:47Z [Code|Frontend|Docs|Ops]
- Summary: Generated typed ABIs for Trellis contracts, parameterized the deployment script + env templates, and bootstrapped frontend vault config/metrics wiring against Base/Base Sepolia networks.
- Versions: Node=24.6.0, Next=16.0.0, wagmi=2.18.2, rainbowkit=2.2.9, viem=2.38.3, Foundry=1.4.3, OZ=5.4.0
- Changes: scripts/generate-frontend-abis.mjs, frontend/contracts/abi/*, package.json, contracts/script/Deploy.s.sol, contracts/script/DeployHelpers.s.sol, contracts/.env.example, frontend/.env.local.example, frontend/scaffold.config.ts, frontend/config/vaults.ts, frontend/hooks/useVaultMetrics.ts, frontend/components/vaults/VaultOverviewCard.tsx, frontend/app/page.tsx, README.md
- Decisions: Added pnpm ABI override (WalletConnect 2.22.x) to resolve React 19 peers and surfaced ABIs via a dedicated generator; deployment script now enforces env config and retains operational control until multisig accepts ownership; frontend home view shows Base/Base Sepolia vault metrics driven from the new hooks.
- Next: 1) Ingest deployment artifacts to auto-populate `deployedContracts.ts` once Base Sepolia deployment exists. 2) Build `/vault/[address]` detail page with deposit/withdraw flows. 3) Flesh out admin panel wiring (pause, harvest, setStrategy) gated by owner address.
- Reviewer: TBD

## 2025-10-23T12:06:29Z [Code|Test|Docs|Ops]
- Summary: Implemented the TrellisVault ERC-4626 core with high-water-mark fee minting, wired the StrategyERC4626 adapter, authored comprehensive Foundry tests, added keeper/runbook scaffolding, and resolved WalletConnect React 19 compatibility via pnpm overrides.
- Versions: Node=24.6.0, Next=16.0.0, wagmi=2.18.2, rainbowkit=2.2.9, viem=2.38.3, Foundry=1.4.3, OZ=5.4.0
- Changes: contracts/src/TrellisVault.sol, contracts/src/interfaces/IStrategy.sol, contracts/src/strategies/StrategyERC4626.sol, contracts/test/TrellisVault.t.sol, contracts/script/Deploy.s.sol, contracts/.env.example, docs/runbooks/incident-response.md, ops/keeper/harvest.ts, ops/.env.example, ops/README.md, frontend/.env.local.example, package.json, pnpm-lock.yaml, README.md, LOG.md
- Decisions: Use share-price high-water mark to avoid deposit-induced fee spikes; defer deposits when no strategy but preserve liquidity to enable safe migration; enforce WalletConnect 2.22.x via pnpm overrides to silence React 19 peer warnings; keep harvest keeper minimal with ABI fragment until Foundry artifact export lands.
- Next: 1) Surface ABI artifacts + TypeScript types for frontend integration. 2) Flesh out deploy scripts (parameter handling + broadcast pipeline). 3) Begin frontend vault list/detail implementation wired to new contract interface.
- Reviewer: TBD

## 2025-10-23T11:30:05Z [Design|Docs]
- Summary: Bootstrapped Trellis monorepo from Scaffold-ETH 2 (Foundry preset), migrated to pnpm workspace, and documented baseline architecture + tooling.
- Versions: Node=24.6.0, Next=16.0.0, wagmi=2.18.2, rainbowkit=2.2.9, viem=2.38.3, Foundry=1.4.3, OZ=5.4.0
- Changes: package.json, pnpm-workspace.yaml, frontend/package.json, contracts/package.json, contracts/foundry.toml, README.md, LOG.md, LICENSE, CODE_OF_CONDUCT.md, docs/addresses.base*.json, .gitignore
- Decisions: Adopted Scaffold-ETH 2 for speed and aligned layout to requirements; stayed on Next 16.0.0 + React 19 (latest) while tracking walletconnect peer warning (React <=18) for follow-up; pruned Scaffold-ETH extras (IPFS, burner stack) to focus on vault requirements; standardized on pnpm for deterministic installs.
- Next: 1) Draft vault + strategy contract skeletons w/ fee accounting design. 2) Define frontend routing + data layer aligned with contracts ABI. 3) Add CI workflows (contracts + frontend) including Foundry, Slither, ESLint, and Next build.
- Reviewer: TBD
