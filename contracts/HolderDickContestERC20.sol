// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/interfaces/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/// @title HolderDickContestERC20
/// @author Angle Core Team
contract HolderDickContestERC20 is ERC4626 {
    using Math for uint256;

    uint256 internal constant _BASE_PARAMS = 10**9;

    // ============================ Contract Parameters ============================

    /// @notice Fee paid by users withdrawing from the contract
    uint64 public withdrawFee;

    /// @notice The period in seconds over which locked profit is unlocked
    /// @dev If 0, it can open this contract up to sandwich attacks
    uint64 public vestingPeriod;

    // ============================ Contract Variables =============================

    /// @notice Timestamp of the last gain for users
    uint64 public lastUpdate;

    /// @notice Amount of profit that needs to be vested
    uint256 public vestingProfit;

    constructor(
        IERC20Metadata _asset,
        uint64 _withdrawFee,
        uint64 _vestingPeriod
    )
        ERC4626(_asset)
        ERC20(
            string(abi.encodePacked(_asset.name(), " Holder Dick Contest")),
            string(abi.encodePacked(_asset.symbol(), "-hdc"))
        )
    {
        withdrawFee = _withdrawFee;
        vestingPeriod = _vestingPeriod;
    }

    // ============================== View Functions ===============================

    /// @inheritdoc ERC4626
    function totalAssets() public view override returns (uint256) {
        return IERC20(asset()).balanceOf(address(this)) - lockedProfit();
    }

    /// @inheritdoc ERC4626
    function maxWithdraw(address owner) public view override returns (uint256) {
        (uint256 maxAsset, ) = _computeRedemptionFees(balanceOf(owner));
        return maxAsset;
    }

    /// @inheritdoc ERC4626
    function previewWithdraw(uint256 assets) public view override returns (uint256) {
        (uint256 shares, ) = _computeWithdrawalFees(assets);
        return shares;
    }

    /// @inheritdoc ERC4626
    function previewRedeem(uint256 shares) public view override returns (uint256) {
        (uint256 assets, ) = _computeRedemptionFees(shares);
        return assets;
    }

    /// @notice Computes the current amount of locked profit
    /// @dev This function is what effectively vests profits going to remaining users
    function lockedProfit() public view virtual returns (uint256) {
        // Getting the last update and vesting period
        uint256 _lastUpdate = lastUpdate;
        uint256 _vestingPeriod = vestingPeriod;

        unchecked {
            // If the vesting period has passed, there is no locked profit
            // This cannot overflow on human timescales
            if (block.timestamp >= _lastUpdate + _vestingPeriod) return 0;

            uint256 currentlyVestingProfit = vestingProfit;

            // Computing how much profit remains locked based on the last time a profit was acknowledged and the vesting period
            return currentlyVestingProfit - (currentlyVestingProfit * (block.timestamp - _lastUpdate)) / _vestingPeriod;
        }
    }

    // ============================= User Interactions =============================

    /// @inheritdoc ERC4626
    function deposit(uint256 assets, address receiver) public virtual override returns (uint256) {
        uint256 shares = previewDeposit(assets);
        _deposit(_msgSender(), receiver, assets, shares);
        return shares;
    }

    /// @inheritdoc ERC4626
    function mint(uint256 shares, address receiver) public virtual override returns (uint256) {
        uint256 assets = previewMint(shares);
        _deposit(_msgSender(), receiver, assets, shares);
        return assets;
    }

    /// @inheritdoc ERC4626
    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) public virtual override returns (uint256) {
        (uint256 shares, uint256 fees) = _computeWithdrawalFees(assets);
        _handleUserGain(fees);
        _withdraw(_msgSender(), receiver, owner, assets, shares);
        return shares;
    }

    /// @inheritdoc ERC4626
    function redeem(
        uint256 shares,
        address receiver,
        address owner
    ) public virtual override returns (uint256) {
        (uint256 assets, uint256 fees) = _computeRedemptionFees(shares);
        _handleUserGain(fees);
        _withdraw(_msgSender(), receiver, owner, assets, shares);
        return assets;
    }

    // ================================= Helpers ===================================

    /// @notice Splits the fees paid by someone withdrawing to all users
    /// @param fees Fees paid by a user withdrawing
    function _handleUserGain(uint256 fees) internal virtual {
        if (fees > 0) {
            vestingProfit = (lockedProfit() + fees);
            lastUpdate = uint64(block.timestamp);
        }
    }

    /// @notice Computes the fees paid and the shares burnt for a withdrawal of `assets`
    function _computeWithdrawalFees(uint256 assets) internal view returns (uint256 shares, uint256 fees) {
        uint256 assetsPlusFees = assets.mulDiv(_BASE_PARAMS, _BASE_PARAMS - withdrawFee, Math.Rounding.Up);
        shares = _convertToShares(assetsPlusFees, Math.Rounding.Up);
        fees = assetsPlusFees - assets;
    }

    /// @notice Computes the fees paid and the assets redeemed for a redemption of `shares`
    function _computeRedemptionFees(uint256 shares) internal view returns (uint256 assets, uint256 fees) {
        assets = _convertToAssets(shares, Math.Rounding.Down);
        fees = assets.mulDiv(withdrawFee, _BASE_PARAMS, Math.Rounding.Up);
        assets -= fees;
    }
}
