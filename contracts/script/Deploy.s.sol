// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "./DeployHelpers.s.sol";
import {TrellisVault} from "../src/TrellisVault.sol";
import {StrategyERC4626} from "../src/strategies/StrategyERC4626.sol";

/**
 * @notice Main deployment script for all contracts
 * @dev Implementation TODO: wire constructor params + addresses via foundry broadcast env vars.
 */
contract DeployScript is ScaffoldETHDeploy {
    function run() external {
        // Intentionally left blank until deployment parameters (asset, strategy target) are finalized.
        // See docs/runbooks for deployment procedure.
    }
}
