# AGENTS.md — Trellis Vaults (Latest‑First Edition)

> Spec version: 1.1 • Standard: [https://agents.md](https://agents.md) • Owner: Founders (Ops Multisig) • Agent: **Codex Builder**

## 0) Identity

* **Project:** Trellis Vaults (`trellis`)
* **Mission:** Ship a secure, gas‑efficient **single‑asset yield vault dApp on Base** that starts with **one USDT vault** routed to an **ERC‑4626 target (Euler v2 Earn)** *if available*; otherwise **fallback to USDC**. Scale to multiple vaults via plug‑and‑play adapters.
* **Primary Network:** Base mainnet • **Staging:** Base Sepolia.

## 1) Latest‑First Policy (MANDATORY)

**Always use the latest stable releases at the time of execution.**

* **Node:** latest LTS (≥ current LTS) • **pnpm:** `pnpm@latest`.
* **Frontend:** **Next.js (latest stable)** via `create-next-app@latest` **OR** **Scaffold‑ETH 2** via `create-eth@latest` (see §3). If a brand‑new major (e.g., Next v16+) breaks core deps (wagmi/RainbowKit/viem), use the **most recent compatible minor**, note the decision in **LOG.md**, and open a follow‑up task to upgrade when deps catch up.
* **Wallet/Stacks:** `wagmi@latest`, `viem@latest`, `@rainbow-me/rainbowkit@latest`.
* **Contracts:** **Foundry (latest)** + OpenZeppelin Contracts (latest 4.x/5.x compatible with ^0.8.20+).
* **Linters/Formatters:** ESLint, Prettier, Solhint — all `@latest`.
* **CI:** GitHub Actions runners pinned to latest LTS.

> The agent MUST write a short **version audit** in **LOG.md** (what versions were resolved, any pins, and why).

## 2) Goals & Non‑Goals

**Goals**

1. MVP: 1 production vault on Base with **10% performance/maintenance fee** on profits (configurable); **USDT on Euler v2** if ERC‑4626 target exists, else **USDC**.
2. Pluggable **Strategy** interface: start with an **ERC‑4626 adapter** (Euler v2 Earn), then add Aave v3 / Comet / Morpho adapters.
3. A clean **Next.js (latest)** app with **RainbowKit + wagmi + viem** UI: TVL, share price, deposit/withdraw, owner `harvest()`.
4. Tests, CI, runbooks, incident response, and documentation discipline (README + LOG.md).
5. Easy, config‑driven addition of new vaults/strategies.

**Non‑Goals**

* Cross‑chain bridging in MVP; speculative APR projections.

## 3) Frontend Foundation Choice (DYOR & Decide)

The agent MUST evaluate both and pick ONE (record decision + rationale in **LOG.md**):

**A. Scaffold‑ETH 2 (preferred for speed & EVM ergonomics)**

* Bootstrap: `pnpm dlx create-eth@latest` (or `npx create-eth@latest`).
* Pros: ships with Next.js (latest compatible), RainbowKit, wagmi, viem, contracts workspace (Hardhat/Foundry), and dapp helpers.
* Use **Foundry** preset.

**B. From‑Scratch Next.js + RainbowKit Starter**

* Bootstrap: `pnpm dlx create-next-app@latest` then `pnpm create @rainbow-me/rainbowkit@latest` to wire wallet, wagmi, viem.

If option **A** lags a just‑released Next major you need, choose **B**. If **B** takes longer to integrate contracts ergonomics, choose **A**. Always document the decision.

## 4) Operating Principles

* **Security first:** minimize attack surface; least privilege; `pause` as a circuit breaker; isolate owner and fee recipient.
* **Standards:** ERC‑4626, OZ contracts, conventional commits, semver.
* **Docs or it didn’t happen:** update **README.md** and append **LOG.md** on every material change.
* **Config over forks:** new vaults via config + addresses; strategies are pluggable.
* **Determinism:** lock toolchain via config files; reproducible deploy scripts.

## 5) Deliverables

* **/contracts** (Foundry): Vault (ERC‑4626) w/ fee shares (high‑water mark), Strategy interfaces, **ERC‑4626 Strategy adapter (Euler v2)**, tests, deploy scripts.
* **/frontend** (Next.js latest): RainbowKit wallet connect; TVL/share price; deposit/withdraw; admin harvest.
* **/ops**: Keeper (harvest) script, runbooks, env samples.
* **/docs**: Architecture, risk notes, addresses JSON (per network).
* **Root docs:** `AGENTS.md`, `README.md`, `LOG.md`, `LICENSE` (MIT), `CODE_OF_CONDUCT.md`.

## 6) Repository Layout

```
/ (repo root: trellis-vaults)
├─ contracts/                # Foundry project (src/, script/, test/)
├─ frontend/                 # Next.js app (Scaffold‑ETH 2 or custom)
├─ ops/                      # keeper scripts, runbooks
├─ docs/                     # diagrams, specs, addresses.<net>.json
├─ AGENTS.md
├─ README.md
├─ LOG.md                    # work log (append‑only)
├─ LICENSE (MIT)
└─ .github/workflows/        # CI for contracts + frontend
```

## 7) High‑Level Architecture

* **Vault (ERC‑4626):** single‑asset (USDT/USDC), forwards deposits to Strategy; withdraws on demand; `totalAssets()` = local + strategy.
* **Performance Fee:** 10% of profit via **fee shares** on `harvest()` using **high‑water mark** (no fee on loss).
* **Strategy ERC‑4626 Adapter:** deposits into target ERC‑4626 (Euler v2 Earn); target can be updated by owner.
* **UI:** vault list & detail; deposit/withdraw; owner harvest; TVL & share price.
* **Extensibility:** deploy more vaults, plug different strategies (Aave/Comet/Morpho).

## 8) Security Invariants

* No reentrancy on deposit/withdraw/harvest.
* `pause()` halts deposits/withdrawals/harvest.
* `sweep()` cannot move the underlying asset.
* Fee shares only on profit.
* Allowances minimized; reset on strategy changes.
* Owner = multisig, distinct from feeRecipient.

## 9) Environment, Secrets, Address Book

* Networks: `base` (mainnet), `base-sepolia` (staging).
* `.env` / `.env.local` for RPCs, keys (never commit).
* `docs/addresses.base.json` & `docs/addresses.base-sepolia.json` store contract addresses, block numbers, verification links.

## 10) How to Add a Vault/Strategy (Playbook)

1. **Target Check:** Prefer **USDT on Euler v2 (ERC‑4626)**. If unavailable, pick **USDC**. Confirm vault addresses & decimals.
2. **Deploy Vault:** ERC‑4626 vault with asset address, name/symbol, fee config.
3. **Deploy Strategy:** ERC‑4626 adapter pointing to the target; bind to vault.
4. **Wire & Verify:** `setStrategy`, verify on Basescan, record in addresses JSON.
5. **UI:** add vault entry to config (name, icon, addresses, caps, decimals).
6. **Keeper:** include new vault in harvest schedule.
7. **Docs:** update diagrams; append **LOG.md** with rationale, caps, risks.

## 11) Work Log Standard (LOG.md)

Append entries; newest on top.

```
## 2025-10-23T14:05:00Z [Design|Code|Test|Docs|Ops]
- Summary: <what/why>
- Versions: Node=<x>, Next=<x>, wagmi=<x>, rainbowkit=<x>, viem=<x>
- Changes: <files or PRs>
- Decisions: <key tradeoffs>
- Next: <next steps>
- Reviewer: <if any>
```

## 12) CI/CD

* **Contracts CI:** `forge build`, `forge test`, Slither; upload artifacts.
* **Frontend CI:** install, typecheck, lint, build (Next.js latest). Optional preview deploy on PRs (Vercel).
* **Release:** manual tags; changelog from conventional commits.

## 13) Frontend Spec

* **Framework:** **Next.js (latest)** App Router.
* **Wallet:** RainbowKit + wagmi + viem (Base + Base Sepolia chains).
* **State:** wagmi hooks; optional Zustand.
* **Theme:** Dark default, "Trellis" green accent; Tailwind + shadcn/ui.
* **Routes**

  * `/` – Vault list (cards: TVL, share price, deposit CTA)
  * `/vault/[address]` – Vault details (TVL, price/share, user balance, deposit/withdraw, events, harvest if owner)
  * `/admin` – Guarded owner ops: set fees, set strategy, pause/unpause, harvest
* **Data**

  * Onchain reads (viem): `totalAssets`, `totalSupply`, `convertToAssets/convertToShares`, fee params, `lastTotalAssets`
  * Optional USD price via Chainlink feed
* **Edge Cases**: rounding; paused state; preview flows; gas estimation & reverts surfaced to user.

## 14) Build Plan

**Phase 0 — Bootstrap (Day 1)**

* Scaffold repo; pick **A** (Scaffold‑ETH 2) or **B** (from‑scratch). Document the choice in LOG.md.
* Commit CI skeleton, README, LOG.md, LICENSE.

**Phase 1 — Contracts (Days 1‑3)**

* Implement Vault (ERC‑4626) + fee shares + high‑water mark.
* Implement Strategy (ERC‑4626 adapter).
* Tests: deposit/withdraw; fee accrual; pause; sweep; strategy switch; fuzzing.
* Deploy to Base Sepolia; smoke UI.

**Phase 2 — Frontend (Days 3‑5)**

* Next (latest) + RainbowKit; vault list/detail; deposit/withdraw; admin harvest.
* Theme + accessibility.

**Phase 3 — Ops & Docs (Days 5‑6)**

* Keeper (profit‑aware/time‑based harvest).
* Runbooks; addresses JSON; finalize README + diagrams.

**Phase 4 — Mainnet (Day 7)**

* Verify, set caps, announce.

## 15) Owner & Roles

* `owner`: Ops multisig (admin)
* `feeRecipient`: revenue wallet (separate)
* **No EOAs for production control.**

## 16) Risk & Incident Response

* **Triggers:** target pause, utilization spikes, oracle issues, failed withdraw.
* **Actions:** `pause` vault, `withdrawAll` from strategy, status update, postmortem in LOG.md.

## 17) Agent Checklist (Every Task)

* Read **AGENTS.md** fully before starting.
* Create a **LOG.md** entry; after code changes, run tests/linters and update **README.md**.
* Never commit secrets; use env files.
* If any instruction conflicts, **update AGENTS.md first**, get review, then proceed.
