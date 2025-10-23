# Trellis Vaults Code & Ops Audit — 2025-10-23 (v1.1)

## Executive Summary
- The Trellis Vaults repository implements a single-strategy ERC-4626 vault with a plug-in adapter layer, a Next.js front-end, and basic operational tooling. Contracts follow best practices such as high-water-mark performance fees, pausable entry points, and non-reentrancy guards, and the monorepo wiring (CI, artifact generation scripts, and documentation) is largely in place.
- Core risks were concentrated in strategy lifecycle management and automation. The strategy adapter now redeploys idle balances automatically when a new target is configured, and the vault exposes a dedicated harvester role so automation can run without multisig keys.
- User-facing polish, documentation, and configuration scaffolding required additional work. The repository now ships the referenced `.env` templates, overview metrics respect per-asset decimals, and Chainlink price reads enforce freshness/sign checks. Tests cover the new migration + harvester paths.

## Scope & Methodology
- Reviewed Solidity sources under `contracts/src/**`, Foundry tests, and deployment scripts (`contracts/script`).
- Reviewed front-end components/hooks (`frontend/app`, `frontend/components`, `frontend/hooks`, `frontend/config`) and scaffold configuration.
- Evaluated operational tooling in `ops/` and repository documentation (`README.md`, `LOG.md`, `docs/runbooks/incident-response.md`).
- Examined CI workflows in `.github/workflows` and artifact generation scripts in `scripts/`.

## System Overview
- `TrellisVault` is an ERC-4626 vault with pausable deposit/withdraw flows, high-water-mark fee minting, and a pluggable `IStrategy` interface.【F:contracts/src/TrellisVault.sol†L15-L314】
- `StrategyERC4626` wraps an upstream ERC-4626 vault, managing allowances and migrations between targets while restricting calls to the vault owner.【F:contracts/src/strategies/StrategyERC4626.sol†L11-L160】
- Front-end routes (home, vault detail, admin) consume on-chain metrics through Wagmi/viem hooks, with vault configuration provided via `frontend/config/vaults.ts`.【F:frontend/app/page.tsx†L1-L45】【F:frontend/app/vault/[address]/page.tsx†L1-L214】【F:frontend/app/admin/page.tsx†L1-L204】
- Operational tooling includes a harvest keeper script that calculates fee accrual before submitting a transaction.【F:ops/keeper/harvest.ts†L1-L117】 Documentation outlines incident-response procedures.【F:docs/runbooks/incident-response.md†L1-L34】

## Findings

### Medium Severity

1. **Idle funds after strategy target update**
   - **Issue.** `StrategyERC4626.updateTarget` redeems all shares from the old target but never re-deploys the adapter’s now-idle asset balance into the new target. Because only the vault can call `deposit`, the capital remains idle until a separate manual action re-routes it, which can materially suppress yield after migrations.【F:contracts/src/strategies/StrategyERC4626.sol†L142-L159】
   - **Impact.** Users earn no yield on assets whenever a target migration occurs until an operator performs an additional (undocumented) intervention, creating a protracted idle-period risk.
   - **Recommendation.** After updating `_targetVault`, immediately deposit the adapter’s entire `assetToken` balance into the new target (or expose a dedicated vault-accessible hook the vault can invoke post-update). Augment tests to cover the migration path.
   - **Status.** Resolved — `updateTarget` now redeploys idle balances and emits a deposit event, with tests asserting the new target holds the assets.【F:contracts/src/strategies/StrategyERC4626.sol†L142-L166】【F:contracts/test/TrellisVault.t.sol†L214-L226】

2. **Keeper automation requires vault-owner credentials**
   - **Issue.** The on-chain `harvest` entry point is restricted to `onlyOwner`, while the keeper script expects a `KEEPER_PK` private key to sign transactions.【F:contracts/src/TrellisVault.sol†L192-L195】【F:ops/keeper/harvest.ts†L59-L112】 Given the project charter that the owner is an ops multisig, the script is either unusable (multisigs cannot export a raw key) or encourages operators to run automation with privileged keys exposed on disk.
   - **Impact.** Harvest automation cannot be safely delegated, increasing operational risk (missed harvests or compromised owner keys).
   - **Recommendation.** Introduce a dedicated keeper role (e.g., via `AccessControl` or an allowlisted harvester) or redesign the script to operate through the multisig/API, and update docs/runbooks accordingly.
   - **Status.** Resolved — the vault exposes a mutable `harvester` role, tests cover delegation + unauthorized access, and the keeper script checks that the configured signer matches either the owner or harvester. Docs instruct ops to set the role before running automation.【F:contracts/src/TrellisVault.sol†L66-L203】【F:contracts/test/TrellisVault.t.sol†L174-L213】【F:ops/keeper/harvest.ts†L8-L112】【F:ops/README.md†L6-L27】

### Low Severity

3. **Vault metrics assume six-decimal assets**
   - **Issue.** `VaultOverviewCard` defaults to `decimals = 6`, and the home page never overrides it, so TVL/share-price displays are wrong for non-6-decimal assets.【F:frontend/components/vaults/VaultOverviewCard.tsx†L6-L47】【F:frontend/app/page.tsx†L32-L41】
   - **Recommendation.** Thread the actual asset decimals from configuration or discovery into overview cards.
   - **Status.** Resolved — vault configs include `assetDecimals`, overview cards accept the value, and per-vault pages pass the asset-decimal discovery into `useVaultMetrics` and the shared card component.【F:frontend/config/vaults.ts†L10-L41】【F:frontend/components/vaults/VaultOverviewCard.tsx†L6-L45】【F:frontend/app/page.tsx†L17-L41】【F:frontend/app/vault/[address]/page.tsx†L259-L343】

4. **Chainlink price reads ignore staleness/negativity**
   - **Issue.** `useUsdPrice` trusts `latestRoundData` without checking the `answeredInRound`, `updatedAt`, or sign of `answer`, risking stale or negative USD conversions in the UI.【F:frontend/hooks/useUsdPrice.ts†L29-L64】
   - **Recommendation.** Validate that `updatedAt` is recent, `answeredInRound >= roundId`, and `answer > 0` before using the feed.
   - **Status.** Resolved — `useUsdPrice` enforces positive answers, freshness thresholds (configurable via `NEXT_PUBLIC_CHAINLINK_STALE_AFTER`), and `answeredInRound` validation before returning a quote.【F:frontend/hooks/useUsdPrice.ts†L31-L71】【F:frontend/app/vault/[address]/page.tsx†L279-L297】【F:frontend/.env.local.example†L11-L15】

5. **Documentation and config drift**
   - **Issue.** The README and ops guide reference `.env` templates (`contracts/.env.example`, `frontend/.env.local.example`, `ops/.env.example`) and `docs/runbooks/incident.md`, none of which exist in the repo, causing setup commands (including `pnpm` postinstall) to fail.【F:README.md†L42-L46】【F:ops/README.md†L11-L32】
   - **Recommendation.** Restore the referenced templates (even with placeholder content) and fix runbook links to match `incident-response.md`.
   - **Status.** Resolved — the repo now includes the referenced env templates with guidance, README/ops docs reference the correct paths, and the incident runbook link is accurate.【F:contracts/.env.example†L1-L18】【F:frontend/.env.local.example†L1-L15】【F:ops/.env.example†L1-L7】【F:README.md†L42-L86】【F:ops/README.md†L1-L27】

### Informational Observations
- Foundry tests cover core vault flows but omit adversarial cases (strategy under-withdrawal, keeper misconfiguration, fee updates).【F:contracts/test/TrellisVault.t.sol†L92-L212】 Expanding coverage would harden behavior guarantees.
- Deployment metadata is still empty (`docs/addresses.*.json`, `frontend/contracts/deployedContracts.ts`), signalling no staging/mainnet deployments yet.【F:docs/addresses.base.json†L1-L1】【F:frontend/contracts/deployedContracts.ts†L1-L10】 Keep these updated once contracts ship.
- Front-end deposit/withdraw forms do not reflect the paused state proactively; users only see a revert. Consider disabling actions when `paused` is true (the admin page already fetches this state).【F:contracts/src/TrellisVault.sol†L110-L159】【F:frontend/app/vault/[address]/page.tsx†L88-L178】

## Recommendations & Next Steps
1. Patch `StrategyERC4626.updateTarget` to redeploy idle balances and extend tests to cover migrations.
2. Introduce a role-based harvester and update keeper automation/docs to avoid owner key exposure.
3. Fix configuration/documentation drift (missing `.env` templates, stale runbook links) so that fresh clones can install successfully.
4. Propagate accurate token decimals and feed validation into the UI, and consider surfacing paused status directly in deposit/withdraw components.
5. Expand Foundry test coverage for failure cases (strategy shortfalls, fee adjustments, paused interactions) and add front-end integration tests or type-safe mocks as the UI stabilizes.

---
Prepared by: Codex Builder (gpt-5-codex) on 2025-10-23. Updated 2025-10-24 with remediation status.

## Document Control
- **Version:** 1.1 (medium/low findings remediated)
- **Status:** Released to repository (ready for GitHub push)
- **Next Review:** When new contracts/strategies are introduced or additional findings emerge
