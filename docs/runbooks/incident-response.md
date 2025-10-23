# Incident Response Runbook

## Trigger Conditions
- Vault share price declines unexpectedly (high-water mark breached downward).
- Strategy target (Euler v2, etc.) pauses withdrawals or reports insolvency.
- Keeper automation fails to harvest for >24h.
- Abnormal on-chain events (exploits, admin actions) detected by monitoring.

## Immediate Actions
1. **Pause the vault**
   ```bash
   cast send $VAULT_ADDRESS "pause()" --rpc-url $RPC_URL --private-key $OPS_PK
   ```
2. **Pull liquidity back to the vault**
   ```bash
   cast send $VAULT_ADDRESS "withdrawAllFromStrategy()" --rpc-url $RPC_URL --private-key $OPS_PK
   ```
3. Snapshot state: record `totalAssets`, `totalSupply`, and strategy balances. Persist in `LOG.md`.
4. Notify Ops multisig & stakeholders via incident channel (Slack/Telegram).

## Triage Checklist
- Confirm underlying asset balances recovered match user deposits.
- Evaluate strategy status (e.g., Euler vault health, target-specific docs).
- Identify exploit vector or upstream cause; engage protocol teams if external.

## Remediation
- If losses realized, compute user impact and publish disclosure.
- Patch contract or strategy adapter if bug identified; redeploy and migrate assets.
- For upstream issues, remain paused until target resumes operations.

## Postmortem
- Document timeline, root cause, and remediation actions in `LOG.md` and `docs/`.
- Update runbooks and monitoring to prevent recurrence.
- Schedule audit review if smart contract changes were required.
