# Ops Toolkit

This directory houses operational tooling for Trellis Vaults.

## Keeper — Harvest Automation

The script at `keeper/harvest.ts` evaluates whether the vault has accrued profit above the high-water mark and, if the configured profit threshold is exceeded, submits a `harvest()` transaction. Ensure the keeper key is authorized via `setHarvester(<keeper address>)` (or use the owner account directly) before running the script.

### Usage

```bash
cp contracts/.env.example contracts/.env                # ensure Foundry env is configured
cp frontend/.env.local.example frontend/.env.local      # frontend reference (optional)
cp ops/.env.example ops/.env                            # keeper specific secrets (see below)

pnpm dlx tsx ops/keeper/harvest.ts
```

Environment variables (place in `ops/.env` or export prior to running):

- `NETWORK` — `base` (default) or `base-sepolia`
- `RPC_URL` — HTTPS RPC endpoint for the selected network
- `VAULT_ADDRESS` — deployed TrellisVault contract address
- `KEEPER_PK` — keeper private key (`0x`-prefixed, never commit)
- `MIN_FEE_BPS` — minimum fee accrual (in basis points of profit) before triggering a harvest (default `5`)

The script relies on the ABI fragment inline; regenerate from Foundry artifacts when interfaces change.

## Runbooks

- `docs/runbooks/incident-response.md` outlines pause/escalation procedures.
- Add new runbooks here and reference them from `README.md` when processes stabilize.
