// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

interface IStrategy {
    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    event StrategyDeposit(uint256 assets, uint256 shares);
    event StrategyWithdrawal(uint256 assets, uint256 shares);
    event StrategyTargetUpdated(address indexed previousTarget, address indexed newTarget);
    event StrategyHarvest(uint256 harvested);

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    error NotVault();

    /*//////////////////////////////////////////////////////////////
                                VIEWS
    //////////////////////////////////////////////////////////////*/

    function asset() external view returns (address);

    function vault() external view returns (address);

    function totalAssets() external view returns (uint256);

    function target() external view returns (address);

    /*//////////////////////////////////////////////////////////////
                                ACTIONS
    //////////////////////////////////////////////////////////////*/

    function deposit(uint256 assets) external returns (uint256 shares);

    function withdraw(uint256 assets, address receiver) external returns (uint256 withdrawn);

    function withdrawAll(address receiver) external returns (uint256 withdrawn);

    function harvest() external returns (uint256 harvested);
}
