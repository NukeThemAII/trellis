# Trellis Vaults Code & Ops Audit — 2025-10-23

## Executive Summary
- The Trellis Vaults repository implements a single-strategy ERC-4626 vault with a plug-in adapter layer, a Next.js front-end, and basic operational tooling. Contracts follow best practices such as high-water-mark performance fees, pausable entry points, and non-reentrancy guards, and the monorepo wiring (CI, artifact generation scripts, and documentation) is largely in place.
- Core risks are concentrated in strategy lifecycle management and automation. Updating the ERC-4626 strategy target leaves capital idle inside the adapter because the idle balance is never re-deployed, and the keeper script can only function if it is funded with the vault owner key, which conflicts with the intended multisig ownership model.
- User-facing polish, documentation, and configuration scaffolding require additional work. Several `.env` templates referenced in the README are missing, front-end metrics assume six decimals for all assets, and Chainlink price reads lack freshness checks. Tests exist for the main happy-path vault flows but do not cover negative scenarios (e.g., strategy failure) or adapter target migrations.

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

2. **Keeper automation requires vault-owner credentials**  
   - **Issue.** The on-chain `harvest` entry point is restricted to `onlyOwner`, while the keeper script expects a `KEEPER_PK` private key to sign transactions.【F:contracts/src/TrellisVault.sol†L192-L195】【F:ops/keeper/harvest.ts†L59-L112】 Given the project charter that the owner is an ops multisig, the script is either unusable (multisigs cannot export a raw key) or encourages operators to run automation with privileged keys exposed on disk.
   - **Impact.** Harvest automation cannot be safely delegated, increasing operational risk (missed harvests or compromised owner keys).  
   - **Recommendation.** Introduce a dedicated keeper role (e.g., via `AccessControl` or an allowlisted harvester) or redesign the script to operate through the multisig/API, and update docs/runbooks accordingly.

### Low Severity

3. **Vault metrics assume six-decimal assets**  
   - **Issue.** `VaultOverviewCard` defaults to `decimals = 6`, and the home page never overrides it, so TVL/share-price displays are wrong for non-6-decimal assets.【F:frontend/components/vaults/VaultOverviewCard.tsx†L6-L47】【F:frontend/app/page.tsx†L32-L41】  
   - **Recommendation.** Thread the actual asset decimals from configuration or discovery into overview cards.

4. **Chainlink price reads ignore staleness/negativity**  
   - **Issue.** `useUsdPrice` trusts `latestRoundData` without checking the `answeredInRound`, `updatedAt`, or sign of `answer`, risking stale or negative USD conversions in the UI.【F:frontend/hooks/useUsdPrice.ts†L29-L64】  
   - **Recommendation.** Validate that `updatedAt` is recent, `answeredInRound >= roundId`, and `answer > 0` before using the feed.

5. **Documentation and config drift**  
   - **Issue.** The README and ops guide reference `.env` templates (`contracts/.env.example`, `frontend/.env.local.example`, `ops/.env.example`) and `docs/runbooks/incident.md`, none of which exist in the repo, causing setup commands (including `pnpm` postinstall) to fail.【F:README.md†L42-L46】【F:ops/README.md†L11-L32】  
   - **Recommendation.** Restore the referenced templates (even with placeholder content) and fix runbook links to match `incident-response.md`.

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
Prepared by: Codex Builder (gpt-5-codex) on 2025-10-23.

## Document Control
- **Version:** 1.0 (initial publication)
- **Status:** Released to repository (ready for GitHub push)
- **Next Review:** Upon completion of remediation items listed in "Recommendations & Next Steps"
