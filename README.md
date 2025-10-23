# Trellis Vaults — Latest-First

**Trellis Vaults** is a secure, modular **ERC-4626 yield vault** platform for **Base**. The MVP focuses on a single-asset vault (USDT preferred; fallback to USDC) that routes liquidity into an ERC-4626 compliant strategy (Euler v2 Earn when available). The system is designed for plug-and-play strategy adapters so additional vaults can be onboarded with minimal lift.

## Stack & Tooling (Resolved 2025-01-23)

- **Node.js** 24.6.0 (Latest LTS)
- **pnpm** 10.19.0 (workspace package manager)
- **Next.js** 16.0.0 + **React** 19.0.0 + **TypeScript** 5.9.3
- **wagmi** 2.18.2 • **@rainbow-me/rainbowkit** 2.2.9 • **viem** 2.38.3
- **Foundry** 1.4.3-stable • **OpenZeppelin Contracts** 5.4.0
- **Linting/Formatting:** ESLint 9, Prettier 3, Tailwind CSS 4

> We selected **Scaffold-ETH 2 (Foundry preset)** as the foundation, then refactored the generated structure into the required monorepo layout (`contracts/`, `frontend/`, `ops/`, `docs/`) and migrated tooling to pnpm for deterministic installs.

## Repository Layout

```
/ (trellis)
├─ contracts/        # Foundry workspace (src/, script/, test/)
├─ frontend/         # Next.js app with RainbowKit/wagmi/viem
├─ ops/              # Keeper scripts and runbooks (TBD)
├─ docs/             # Architecture notes + addresses.<network>.json
├─ .github/workflows # GitHub Actions (contracts & frontend pipelines)
├─ AGENTS.md         # Source of truth for requirements
├─ LOG.md            # Append-only work log + version audits
├─ README.md         # This file
├─ LICENSE (MIT)
└─ CODE_OF_CONDUCT.md
```

## Development Setup

```bash
pnpm install        # install workspace dependencies
pnpm contracts:test # run Foundry test suite (placeholder)
pnpm frontend:dev   # launch Next.js dev server (localhost:3000)
```

Environment variables:

- `contracts/.env` — RPC URLs, deployer key, owner, fee recipient, asset/strategy addresses (never commit secrets).
- `frontend/.env.local` — RPC endpoints (`NEXT_PUBLIC_RPC_URL`), supported networks, feature flags.

Sample env files will be added alongside implementation.

## Contracts Module (Foundry)

* `src/` will host the ERC-4626 vault, performance-fee accounting (10% via fee shares and high-water mark), and strategy interfaces.
* `script/Deploy.s.sol` will deploy vault + strategy on Base / Base Sepolia.
* Tests will cover accounting invariants, pause/sweep guards, strategy upgrades, and fuzz rounding.
* Static analysis will run via **Slither** in CI.

Common commands:

```bash
cd contracts
forge build
forge test -vvv
forge fmt
```

## Frontend Module (Next.js)

* App Router, dark theme with Trellis green accent, Tailwind + shadcn/ui.
* Pages: `/` (vault list), `/vault/[address]` (details, deposit/withdraw), `/admin` (owner actions guarded by wallet address).
* wagmi + RainbowKit preconfigured for Base / Base Sepolia chains.
* Uses React Query for data fetching and `viem` for onchain reads (`totalAssets`, `convertTo*`, fees, high-water mark metrics).

Local development:

```bash
cd frontend
pnpm dev
```

## Ops & Documentation

* `ops/` will include keeper automation (`harvest()` cadence + profit threshold), incident runbooks, and monitoring hooks.
* `docs/addresses.base.json` / `docs/addresses.base-sepolia.json` track deployments (address, block number, verification URL).
* Every material change updates **README.md** and appends **LOG.md** with a version audit.

## Security Invariants

* No reentrancy on deposit, withdraw, harvest.
* `pause()` halts user flows; owner can `withdrawAll` from strategy.
* `sweep()` cannot move the underlying asset.
* Performance fees apply only to realized profit (high-water mark).
* Owner (Ops multisig) separate from `feeRecipient` wallet.

## Roadmap Highlights

1. Implement ERC-4626 vault + strategy adapter + comprehensive tests.
2. Integrate UI reads/actions, handle paused states, error surfacing, and gas estimation.
3. Ship keeper script and incident response runbook.
4. Deploy to Base Sepolia, verify, populate address book, and prepare mainnet rollout.

---

For detailed requirements and operating rules, always refer to **AGENTS.md**.
