// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.12;

import "@openzeppelin/contracts/interfaces/IERC20Metadata.sol";

import "./interfaces/ICoreBorrow.sol";
import "./HolderDickContestERC20.sol";

/// @title HDCFactory
/// @author Angle Core Team
contract HDCFactory {
    uint256 internal constant _BASE_PARAMS = 10**9;

    // ================================== Errors ===================================

    error InvalidCall();
    error InvalidParam();
    error NotGovernorOrGuardian();
    error ZeroAddress();

    // =============================== Event =======================================

    event FiledUint64(uint64 param, bytes32 what);
    event NewHDCContract(address indexed asset, uint64 fees, uint64 vestingPeriod, address indexed deploymentAddress);

    // =============================== Parameters ==================================

    /// @notice Address used for Access control
    ICoreBorrow public coreBorrow;

    /// @notice Maps pairs of (asset address, fee value) to the address of the corresponding
    /// holder dick contest
    mapping(address => mapping(uint64 => address)) public hdcFactory;

    /// @notice Maps a fee value to whether it is supported or not
    mapping(uint64 => bool) public supportedFees;

    /// @notice Maps a vesting period to whether it is supported or not
    mapping(uint64 => bool) public supportedVestingPeriods;

    /// @notice List of all HDC contract addresses
    address[] public hdcContractList;

    /// @notice Checks whether the `msg.sender` has the governor or guardian role or not
    modifier onlyGovernorOrGuardian() {
        if (!coreBorrow.isGovernorOrGuardian(msg.sender)) revert NotGovernorOrGuardian();
        _;
    }

    constructor(ICoreBorrow _coreBorrow) {
        if (address(_coreBorrow) == address(0)) revert ZeroAddress();
        coreBorrow = _coreBorrow;
        supportedVestingPeriods[24 * 3600] = true;
        supportedFees[10000000] = true;
    }

    /// @notice Deploys a HDC contract for `asset` with withdrawal fees of `fees` and a vesting period of
    /// `vestingPeriod`
    function deployHDC(
        address asset,
        uint64 fees,
        uint64 vestingPeriod
    ) external returns (address deployed) {
        if (hdcFactory[asset][fees] != address(0) || !supportedFees[fees] || !supportedVestingPeriods[vestingPeriod])
            revert InvalidCall();
        deployed = address(new HolderDickContestERC20(IERC20Metadata(asset), fees, vestingPeriod));
        hdcFactory[asset][fees] = deployed;
        hdcContractList.push(deployed);
        emit NewHDCContract(asset, fees, vestingPeriod, deployed);
    }

    // ============================ Helper View Functions ==========================

    /// @notice Get the HDC contract address associated to the pair (`asset`, `fees`)
    function getHDCAddress(address asset, uint64 fees) external view returns (address) {
        return hdcFactory[asset][fees];
    }

    /// @notice Returns all the HDC contracts
    /// @dev Helper for UIs
    function getAllHDCContracts() external view returns (address[] memory) {
        return hdcContractList;
    }

    // ============================ Governance Function ============================

    /// @notice Toggles support for a fee or a vesting period
    function toggleUint64(uint64 param, bytes32 what) external onlyGovernorOrGuardian {
        bool status;
        if (what == "F") {
            if (param > _BASE_PARAMS) revert InvalidParam();
            status = supportedFees[param];
            supportedFees[param] = !status;
        } else if (what == "V") {
            if (param == 0) revert InvalidParam();
            status = supportedVestingPeriods[param];
            supportedVestingPeriods[param] = !status;
        } else revert InvalidParam();
        emit FiledUint64(param, what);
    }
}
