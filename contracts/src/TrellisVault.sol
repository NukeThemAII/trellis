// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ERC4626 } from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { Ownable2Step } from "@openzeppelin/contracts/access/Ownable2Step.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { IStrategy } from "./interfaces/IStrategy.sol";

/// @title TrellisVault
/// @notice ERC-4626 vault with pluggable strategy adapter and performance fee using a high-water mark.
contract TrellisVault is ERC4626, Pausable, Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    event Harvest(uint256 totalAssets, uint256 profit, uint256 feeAssets, uint256 feeShares);
    event PerformanceFeeUpdated(uint16 previousFeeBps, uint16 newFeeBps);
    event FeeRecipientUpdated(address indexed previousRecipient, address indexed newRecipient);
    event StrategyUpdated(address indexed previousStrategy, address indexed newStrategy, uint256 reclaimedAssets);
    event StrategyWithdrawAll(uint256 assetsRecovered);
    event Sweep(address indexed token, uint256 amount, address indexed recipient);

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    error InvalidFee(uint16 feeBps);
    error InvalidRecipient();
    error InvalidStrategy();
    error SweepAssetNotAllowed();
    error StrategyNotSet();

    /*//////////////////////////////////////////////////////////////
                                CONSTANTS
    //////////////////////////////////////////////////////////////*/

    uint256 public constant HWM_SCALE = 1e18;
    uint16 public constant MAX_FEE_BPS = 2_000; // 20%
    uint16 public constant DEFAULT_FEE_BPS = 1_000; // 10%
    uint16 public constant MAX_BPS = 10_000;

    /*//////////////////////////////////////////////////////////////
                                STATE
    //////////////////////////////////////////////////////////////*/

    IStrategy public strategy;
    address public feeRecipient;
    uint16 public performanceFeeBps;
    uint256 public highWaterMark; // price per share scaled by HWM_SCALE

    /*//////////////////////////////////////////////////////////////
                                CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(
        IERC20Metadata _asset,
        string memory _name,
        string memory _symbol,
        address _owner,
        address _feeRecipient,
        uint16 _performanceFeeBps
    ) ERC20(_name, _symbol) ERC4626(_asset) Ownable(_owner) {
        _updateFeeRecipient(_feeRecipient);
        _updatePerformanceFee(_performanceFeeBps == 0 ? DEFAULT_FEE_BPS : _performanceFeeBps);
        highWaterMark = HWM_SCALE;
    }

    /*//////////////////////////////////////////////////////////////
                                MODIFIERS
    //////////////////////////////////////////////////////////////*/

    /*//////////////////////////////////////////////////////////////
                                VIEWS
    //////////////////////////////////////////////////////////////*/

    function totalAssets() public view override returns (uint256) {
        uint256 assetsInVault = IERC20(asset()).balanceOf(address(this));
        uint256 strategyAssets = address(strategy) == address(0) ? 0 : strategy.totalAssets();
        return assetsInVault + strategyAssets;
    }

    function maxDeposit(address receiver) public view override returns (uint256) {
        return paused() ? 0 : super.maxDeposit(receiver);
    }

    function maxMint(address receiver) public view override returns (uint256) {
        return paused() ? 0 : super.maxMint(receiver);
    }

    function maxWithdraw(address owner_) public view override returns (uint256) {
        return paused() ? 0 : super.maxWithdraw(owner_);
    }

    function maxRedeem(address owner_) public view override returns (uint256) {
        return paused() ? 0 : super.maxRedeem(owner_);
    }

    /*//////////////////////////////////////////////////////////////
                                DEPOSITS
    //////////////////////////////////////////////////////////////*/

    function deposit(uint256 assets, address receiver)
        public
        override
        whenNotPaused
        nonReentrant
        returns (uint256 shares)
    {
        shares = super.deposit(assets, receiver);
        _postDeposit();
    }

    function mint(uint256 shares, address receiver)
        public
        override
        whenNotPaused
        nonReentrant
        returns (uint256 assets)
    {
        assets = super.mint(shares, receiver);
        _postDeposit();
    }

    /*//////////////////////////////////////////////////////////////
                                WITHDRAWALS
    //////////////////////////////////////////////////////////////*/

    function withdraw(uint256 assets, address receiver, address owner_)
        public
        override
        whenNotPaused
        nonReentrant
        returns (uint256 shares)
    {
        _pullFromStrategy(assets);
        shares = super.withdraw(assets, receiver, owner_);
        _updateHighWaterMark();
    }

    function redeem(uint256 shares, address receiver, address owner_)
        public
        override
        whenNotPaused
        nonReentrant
        returns (uint256 assets)
    {
        uint256 assetsToWithdraw = previewRedeem(shares);
        _pullFromStrategy(assetsToWithdraw);
        assets = super.redeem(shares, receiver, owner_);
        _updateHighWaterMark();
    }

    /*//////////////////////////////////////////////////////////////
                                STRATEGY
    //////////////////////////////////////////////////////////////*/

    function setStrategy(address newStrategy) external onlyOwner {
        if (newStrategy == address(0)) revert InvalidStrategy();

        IStrategy candidate = IStrategy(newStrategy);
        if (candidate.asset() != asset()) revert InvalidStrategy();
        if (candidate.vault() != address(this)) revert InvalidStrategy();

        uint256 reclaimed = 0;
        address previous = address(strategy);
        if (previous != address(0)) {
            reclaimed = strategy.withdrawAll(address(this));
        }

        strategy = candidate;
        emit StrategyUpdated(previous, newStrategy, reclaimed);

        _deployToStrategy();
        _updateHighWaterMark();
    }

    function withdrawAllFromStrategy() external onlyOwner {
        if (address(strategy) == address(0)) revert StrategyNotSet();
        uint256 reclaimed = strategy.withdrawAll(address(this));
        emit StrategyWithdrawAll(reclaimed);
        _updateHighWaterMark();
    }

    function harvest() external onlyOwner whenNotPaused nonReentrant {
        if (address(strategy) == address(0)) revert StrategyNotSet();
        _harvest();
    }

    /*//////////////////////////////////////////////////////////////
                                OWNER OPS
    //////////////////////////////////////////////////////////////*/

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function setPerformanceFee(uint16 newFeeBps) external onlyOwner {
        _updatePerformanceFee(newFeeBps);
    }

    function setFeeRecipient(address newRecipient) external onlyOwner {
        _updateFeeRecipient(newRecipient);
    }

    function sweep(address token, address recipient, uint256 amount) external onlyOwner {
        if (token == asset()) revert SweepAssetNotAllowed();
        if (recipient == address(0)) revert InvalidRecipient();
        IERC20(token).safeTransfer(recipient, amount);
        emit Sweep(token, amount, recipient);
    }

    /*//////////////////////////////////////////////////////////////
                                INTERNAL
    //////////////////////////////////////////////////////////////*/

    function _postDeposit() internal {
        _deployToStrategy();
        _updateHighWaterMark();
    }

    function _deployToStrategy() internal {
        if (address(strategy) == address(0)) return;
        uint256 balance = IERC20(asset()).balanceOf(address(this));
        if (balance == 0) return;
        IERC20(asset()).safeTransfer(address(strategy), balance);
        strategy.deposit(balance);
    }

    function _pullFromStrategy(uint256 amount) internal {
        IERC20 assetToken = IERC20(asset());
        uint256 currentBalance = assetToken.balanceOf(address(this));
        if (currentBalance >= amount) return;

        if (address(strategy) == address(0)) revert StrategyNotSet();

        uint256 shortfall = amount - currentBalance;
        strategy.withdraw(shortfall, address(this));

        uint256 postBalance = assetToken.balanceOf(address(this));
        if (postBalance < amount) revert InvalidStrategy();
    }

    function _harvest() internal {
        if (address(strategy) == address(0)) revert StrategyNotSet();
        strategy.harvest();

        uint256 supply = totalSupply();
        if (supply == 0) {
            highWaterMark = HWM_SCALE;
            return;
        }

        uint256 totalAssetValue = totalAssets();
        uint256 currentPps = (totalAssetValue * HWM_SCALE) / supply;

        if (currentPps <= highWaterMark) {
            emit Harvest(totalAssetValue, 0, 0, 0);
            return;
        }

        uint256 profitPps = currentPps - highWaterMark;
        uint256 profit = (profitPps * supply) / HWM_SCALE;

        uint256 feeAssets = (profit * performanceFeeBps) / MAX_BPS;
        uint256 feeShares = 0;

        if (feeAssets > 0) {
            feeShares = convertToShares(feeAssets);
            if (feeShares > 0) {
                _mint(feeRecipient, feeShares);
            }
        }

        highWaterMark = (totalAssets() * HWM_SCALE) / totalSupply();
        emit Harvest(totalAssetValue, profit, feeAssets, feeShares);
    }

    function _updatePerformanceFee(uint16 newFeeBps) internal {
        if (newFeeBps > MAX_FEE_BPS) revert InvalidFee(newFeeBps);
        uint16 previous = performanceFeeBps;
        performanceFeeBps = newFeeBps;
        emit PerformanceFeeUpdated(previous, newFeeBps);
    }

    function _updateFeeRecipient(address newRecipient) internal {
        if (newRecipient == address(0)) revert InvalidRecipient();
        address previous = feeRecipient;
        feeRecipient = newRecipient;
        emit FeeRecipientUpdated(previous, newRecipient);
    }

    function _updateHighWaterMark() internal {
        uint256 supply = totalSupply();
        if (supply == 0) {
            highWaterMark = HWM_SCALE;
            return;
        }
        uint256 pps = (totalAssets() * HWM_SCALE) / supply;
        if (pps > highWaterMark) {
            highWaterMark = pps;
        }
    }
}
