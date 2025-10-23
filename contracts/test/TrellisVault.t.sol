// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC4626 } from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";

import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { TrellisVault } from "../src/TrellisVault.sol";
import { StrategyERC4626 } from "../src/strategies/StrategyERC4626.sol";
import { IStrategy } from "../src/interfaces/IStrategy.sol";

contract MockERC20 is ERC20 {
    uint8 private immutable _decimals;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        _decimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockERC4626Target is ERC20, ERC4626 {
    constructor(MockERC20 asset_)
        ERC20(string(abi.encodePacked("Target-", asset_.symbol())), string(abi.encodePacked("t", asset_.symbol())))
        ERC4626(asset_)
    { }

    function decimals() public view override(ERC20, ERC4626) returns (uint8) {
        return super.decimals();
    }

    function skim(address to, uint256 amount) external {
        IERC20(asset()).transfer(to, amount);
    }
}

contract TrellisVaultTest is Test {
    TrellisVault internal vault;
    StrategyERC4626 internal strategy;
    MockERC20 internal assetToken;
    MockERC4626Target internal target;

    address internal constant OWNER = address(0xA11CE);
    address internal constant FEE_RECIPIENT = address(0xFEE);
    address internal constant USER = address(0xBEEF);
    address internal constant KEEP = address(0xCAFE);
    address internal constant HARVESTER = address(0xC0FFEE);

    uint256 internal constant ONE = 1e6; // 6 decimal asset

    function setUp() public {
        assetToken = new MockERC20("Mock USDC", "mUSDC", 6);
        target = new MockERC4626Target(assetToken);

        vault = new TrellisVault(assetToken, "Trellis Vault USDC", "tvUSDC", OWNER, FEE_RECIPIENT, 1000);

        vm.prank(OWNER);
        strategy = new StrategyERC4626(address(vault), assetToken, target, OWNER);

        vm.prank(OWNER);
        vault.setStrategy(address(strategy));

        vm.label(address(assetToken), "asset");
        vm.label(address(target), "target");
        vm.label(address(strategy), "strategy");
        vm.label(address(vault), "vault");
        vm.label(FEE_RECIPIENT, "feeRecipient");
        vm.label(USER, "user");
        vm.label(address(this), "testHarness");
        vm.label(0x7FA9385bE102ac3EAc297483Dd6233D62b3e1496, "foundryDefaultSender");
    }

    function _dealAndApprove(address to, uint256 amount) internal {
        assetToken.mint(to, amount);
        vm.prank(to);
        assetToken.approve(address(vault), amount);
    }

    function _deposit(address user, uint256 amount) internal {
        _dealAndApprove(user, amount);
        vm.prank(user);
        vault.deposit(amount, user);
    }

    function testDepositForwardsToStrategy() public {
        uint256 amount = 100 * ONE;
        _deposit(USER, amount);

        assertEq(assetToken.balanceOf(address(strategy)), 0);
        assertGt(target.balanceOf(address(strategy)), 0);
        assertEq(vault.totalAssets(), amount);
        assertEq(vault.balanceOf(USER), amount);
        assertApproxEqAbs(strategy.totalAssets(), amount, 1);
    }

    function testWithdrawReturnsFunds() public {
        uint256 amount = 100 * ONE;
        _deposit(USER, amount);

        vm.prank(USER);
        vault.withdraw(40 * ONE, USER, USER);

        assertEq(assetToken.balanceOf(USER), 40 * ONE);
        assertApproxEqAbs(vault.totalAssets(), 60 * ONE, 10);
        assertEq(vault.balanceOf(USER), 60 * ONE);
    }

    function testRedeemAll() public {
        uint256 amount = 50 * ONE;
        _deposit(USER, amount);

        uint256 shares = vault.balanceOf(USER);
        vm.prank(USER);
        vault.redeem(shares, USER, USER);

        assertEq(assetToken.balanceOf(USER), amount);
        assertEq(vault.totalAssets(), 0);
        assertEq(vault.totalSupply(), 0);
        assertEq(vault.highWaterMark(), vault.HWM_SCALE());
    }

    function testHarvestMintsPerformanceFeeOnProfit() public {
        uint256 amount = 100 * ONE;
        _deposit(USER, amount);

        // Simulate 10% profit by donating assets to the target.
        assetToken.mint(address(target), 10 * ONE);

        uint256 feeRecipientBalanceBefore = vault.balanceOf(FEE_RECIPIENT);
        uint256 supplyBefore = vault.totalSupply();
        uint256 assetsBefore = vault.totalAssets();

        vm.prank(OWNER);
        vault.harvest();

        uint256 totalAssetsAfter = vault.totalAssets();
        assertApproxEqAbs(totalAssetsAfter, 110 * ONE, 1);

        uint256 expectedFeeAssets = (10 * ONE * 1000) / vault.MAX_BPS();
        uint256 expectedFeeShares = Math.mulDiv(expectedFeeAssets, supplyBefore + 1, assetsBefore + 1);
        uint256 feeRecipientBalanceAfter = vault.balanceOf(FEE_RECIPIENT);

        assertApproxEqAbs(feeRecipientBalanceAfter - feeRecipientBalanceBefore, expectedFeeShares, 2);

        // Running harvest again without additional profit should mint nothing.
        vm.prank(OWNER);
        vault.harvest();
        assertEq(vault.balanceOf(FEE_RECIPIENT), feeRecipientBalanceAfter);
    }

    function testNoFeeOnLoss() public {
        uint256 amount = 100 * ONE;
        _deposit(USER, amount);

        // Force a 10% loss by pulling funds from the target.
        vm.prank(KEEP);
        target.skim(KEEP, 10 * ONE);

        uint256 feeBalanceBefore = vault.balanceOf(FEE_RECIPIENT);

        vm.prank(OWNER);
        vault.harvest();

        assertEq(vault.balanceOf(FEE_RECIPIENT), feeBalanceBefore);
    }

    function testHarvesterRoleCanHarvest() public {
        uint256 amount = 100 * ONE;
        _deposit(USER, amount);

        assetToken.mint(address(target), 10 * ONE);

        vm.prank(OWNER);
        vault.setHarvester(HARVESTER);
        assertEq(vault.harvester(), HARVESTER);

        vm.prank(HARVESTER);
        vault.harvest();

        assertGt(vault.balanceOf(FEE_RECIPIENT), 0);
    }

    function testHarvestRevertsForUnauthorizedCaller() public {
        _deposit(USER, 10 * ONE);

        vm.prank(USER);
        vm.expectRevert(TrellisVault.UnauthorizedHarvester.selector);
        vault.harvest();
    }

    function testPauseBlocksDeposits() public {
        vm.prank(OWNER);
        vault.pause();

        _dealAndApprove(USER, 10 * ONE);
        vm.prank(USER);
        vm.expectRevert();
        vault.deposit(10 * ONE, USER);

        vm.prank(OWNER);
        vault.unpause();

        vm.prank(USER);
        vault.deposit(10 * ONE, USER);
    }

    function testSweepBlocksUnderlying() public {
        _deposit(USER, 10 * ONE);

        vm.prank(OWNER);
        vm.expectRevert(TrellisVault.SweepAssetNotAllowed.selector);
        vault.sweep(address(assetToken), OWNER, ONE);
    }

    function testStrategyMigration() public {
        _deposit(USER, 20 * ONE);

        // Deploy new target/strategy pair and migrate.
        MockERC4626Target newTarget = new MockERC4626Target(assetToken);
        vm.prank(OWNER);
        StrategyERC4626 newStrategy = new StrategyERC4626(address(vault), assetToken, newTarget, OWNER);

        vm.prank(OWNER);
        vault.setStrategy(address(newStrategy));

        assertEq(address(vault.strategy()), address(newStrategy));
        assertEq(target.balanceOf(address(strategy)), 0);
        assertGt(newTarget.balanceOf(address(newStrategy)), 0);
    }

    function testUpdateTargetRedeploysIdleAssets() public {
        _deposit(USER, 50 * ONE);

        MockERC4626Target newTarget = new MockERC4626Target(assetToken);

        vm.prank(OWNER);
        strategy.updateTarget(newTarget);

        assertEq(assetToken.balanceOf(address(strategy)), 0);
        assertEq(target.balanceOf(address(strategy)), 0);
        assertGt(newTarget.balanceOf(address(strategy)), 0);
    }
}
