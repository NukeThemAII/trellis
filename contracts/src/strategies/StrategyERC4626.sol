// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {IStrategy} from "../interfaces/IStrategy.sol";

/// @title StrategyERC4626
/// @notice Simple adapter that forwards capital to an underlying ERC-4626 strategy vault.
///         The adapter assumes the underlying ERC-4626 vault accepts the same ERC-20 asset as the Trellis Vault.
contract StrategyERC4626 is Ownable, IStrategy {
    using SafeERC20 for IERC20;

    /*//////////////////////////////////////////////////////////////
                                IMMUTABLES
    //////////////////////////////////////////////////////////////*/

    IERC20 public immutable assetToken;
    address public immutable override vault;

    /*//////////////////////////////////////////////////////////////
                                STATE
    //////////////////////////////////////////////////////////////*/

    IERC4626 private _targetVault;

    /*//////////////////////////////////////////////////////////////
                                CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    error StrategyZeroAddress();
    error StrategyAssetMismatch();
    error StrategyInsufficientAssets(uint256 expected, uint256 actual);
    error StrategyWithdrawShortfall(uint256 expected, uint256 actual);

    constructor(address _vault, IERC20 _asset, IERC4626 _target, address _owner) Ownable(_owner) {
        if (_vault == address(0)) revert StrategyZeroAddress();
        if (address(_asset) == address(0)) revert StrategyZeroAddress();
        if (address(_target) == address(0)) revert StrategyZeroAddress();
        if (_target.asset() != address(_asset)) revert StrategyAssetMismatch();

        vault = _vault;
        assetToken = _asset;
        _targetVault = _target;
    }

    /*//////////////////////////////////////////////////////////////
                                MODIFIERS
    //////////////////////////////////////////////////////////////*/

    modifier onlyVault() {
        if (msg.sender != vault) revert NotVault();
        _;
    }

    /*//////////////////////////////////////////////////////////////
                                VIEWS
    //////////////////////////////////////////////////////////////*/

    function asset() external view override returns (address) {
        return address(assetToken);
    }

    function target() external view override returns (address) {
        return address(_targetVault);
    }

    function totalAssets() public view override returns (uint256) {
        uint256 idle = assetToken.balanceOf(address(this));
        uint256 investedShares = _targetVault.balanceOf(address(this));
        uint256 investedAssets = _targetVault.convertToAssets(investedShares);
        return idle + investedAssets;
    }

    /*//////////////////////////////////////////////////////////////
                                ACTIONS
    //////////////////////////////////////////////////////////////*/

    /// @inheritdoc IStrategy
    function deposit(uint256 assets) external override onlyVault returns (uint256 shares) {
        if (assets == 0) return 0;

        uint256 balance = assetToken.balanceOf(address(this));
        if (balance < assets) revert StrategyInsufficientAssets(assets, balance);

        address targetAddr = address(_targetVault);
        assetToken.forceApprove(targetAddr, 0);
        assetToken.forceApprove(targetAddr, assets);
        shares = _targetVault.deposit(assets, address(this));
        assetToken.forceApprove(targetAddr, 0);

        emit StrategyDeposit(assets, shares);
    }

    /// @inheritdoc IStrategy
    function withdraw(uint256 assets, address receiver) external override onlyVault returns (uint256 withdrawn) {
        if (assets == 0) return 0;

        uint256 balanceBefore = assetToken.balanceOf(address(this));
        uint256 sharesBurned = _targetVault.withdraw(assets, address(this), address(this));
        uint256 balanceAfter = assetToken.balanceOf(address(this));
        withdrawn = balanceAfter - balanceBefore;
        if (withdrawn < assets) {
            revert StrategyWithdrawShortfall(assets, withdrawn);
        }

        assetToken.safeTransfer(receiver, withdrawn);

        emit StrategyWithdrawal(withdrawn, sharesBurned);
    }

    /// @inheritdoc IStrategy
    function withdrawAll(address receiver) external override onlyVault returns (uint256 withdrawn) {
        uint256 shares = _targetVault.balanceOf(address(this));
        if (shares > 0) {
            withdrawn = _targetVault.redeem(shares, address(this), address(this));
        }

        uint256 idle = assetToken.balanceOf(address(this));
        if (idle > 0) {
            assetToken.safeTransfer(receiver, idle);
            withdrawn += idle;
        }

        emit StrategyWithdrawal(withdrawn, shares);
    }

    /// @inheritdoc IStrategy
    function harvest() external override onlyVault returns (uint256 harvested) {
        // Most ERC-4626 implementations auto-compound. We expose this hook for symmetry; no-op by default.
        emit StrategyHarvest(0);
        return 0;
    }

    /*//////////////////////////////////////////////////////////////
                                OWNER OPERATIONS
    //////////////////////////////////////////////////////////////*/

    function updateTarget(IERC4626 newTarget) external onlyOwner {
        if (address(newTarget) == address(0)) revert StrategyZeroAddress();
        if (newTarget.asset() != address(assetToken)) revert StrategyAssetMismatch();

        address previous = address(_targetVault);

        // Pull funds back from the old target before switching.
        uint256 shares = _targetVault.balanceOf(address(this));
        if (shares > 0) {
            _targetVault.redeem(shares, address(this), address(this));
        }
        if (previous != address(0)) {
            assetToken.forceApprove(previous, 0);
        }

        _targetVault = newTarget;

        uint256 idle = assetToken.balanceOf(address(this));
        if (idle > 0) {
            address targetAddr = address(_targetVault);
            assetToken.forceApprove(targetAddr, idle);
            _targetVault.deposit(idle, address(this));
            assetToken.forceApprove(targetAddr, 0);
        }

        emit StrategyTargetUpdated(previous, address(newTarget));
    }
}
