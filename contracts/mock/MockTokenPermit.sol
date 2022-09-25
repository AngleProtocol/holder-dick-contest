// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.12;

import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract MockTokenPermit is ERC20Permit {
    using SafeERC20 for IERC20;
    event Minting(address indexed _to, address indexed _minter, uint256 _amount);

    event Burning(address indexed _from, address indexed _burner, uint256 _amount);

    uint8 internal _decimal;

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimal_
    ) ERC20Permit(name_) ERC20(name_, symbol_) {
        _decimal = decimal_;
    }

    function decimals() public view override returns (uint8) {
        return _decimal;
    }

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
        emit Minting(account, msg.sender, amount);
    }

    function burn(address account, uint256 amount) public {
        _burn(account, amount);
        emit Burning(account, msg.sender, amount);
    }
}
