// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "./DeployHelpers.s.sol";
import { TrellisVault } from "../src/TrellisVault.sol";
import { StrategyERC4626 } from "../src/strategies/StrategyERC4626.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC4626 } from "@openzeppelin/contracts/interfaces/IERC4626.sol";

/**
 * @notice Main deployment script for all contracts
 * @dev Expects environment variables supplied via Foundry: see README and contracts/.env.example.
 */
contract DeployScript is ScaffoldETHDeploy {
    struct DeployConfig {
        IERC20Metadata asset;
        string name;
        string symbol;
        address vaultOwner;
        address feeRecipient;
        address strategyOwner;
        IERC4626 target;
        uint16 performanceFeeBps;
    }

    function run() external scaffoldEthDeployerRunner {
        DeployConfig memory cfg = _loadConfig();

        TrellisVault vault =
            new TrellisVault(cfg.asset, cfg.name, cfg.symbol, deployer, cfg.feeRecipient, cfg.performanceFeeBps);
        deployments.push(Deployment({ name: "TrellisVault", addr: address(vault) }));

        StrategyERC4626 strategy =
            new StrategyERC4626(address(vault), IERC20(address(cfg.asset)), cfg.target, cfg.strategyOwner);
        deployments.push(Deployment({ name: "StrategyERC4626", addr: address(strategy) }));

        vault.setStrategy(address(strategy));

        if (cfg.vaultOwner != deployer) {
            vault.transferOwnership(cfg.vaultOwner);
        }
    }

    function _loadConfig() internal view returns (DeployConfig memory cfg) {
        cfg.asset = IERC20Metadata(vm.envAddress("ASSET_TOKEN_ADDRESS"));
        cfg.target = IERC4626(vm.envAddress("STRATEGY_TARGET_ERC4626"));
        cfg.name = vm.envOr("VAULT_NAME", string("Trellis Vault Asset"));
        cfg.symbol = vm.envOr("VAULT_SYMBOL", string("tvASSET"));

        address vaultOwnerEnv = vm.envOr("VAULT_OWNER_ADDRESS", deployer);
        cfg.vaultOwner = vaultOwnerEnv == address(0) ? deployer : vaultOwnerEnv;

        address feeRecipientEnv = vm.envOr("FEE_RECIPIENT_ADDRESS", deployer);
        cfg.feeRecipient = feeRecipientEnv == address(0) ? deployer : feeRecipientEnv;

        address strategyOwnerEnv = vm.envOr("STRATEGY_OWNER_ADDRESS", cfg.vaultOwner);
        cfg.strategyOwner = strategyOwnerEnv == address(0) ? cfg.vaultOwner : strategyOwnerEnv;

        uint256 feeBps = vm.envOr("PERFORMANCE_FEE_BPS", uint256(TrellisVault.DEFAULT_FEE_BPS()));
        require(feeBps <= TrellisVault.MAX_FEE_BPS(), "fee too high");
        cfg.performanceFeeBps = uint16(feeBps);

        require(cfg.target.asset() == address(cfg.asset), "target asset mismatch");
        require(cfg.feeRecipient != address(0), "fee recipient zero");
    }
}
