import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { parseEther, parseUnits } from 'ethers/lib/utils';
import { ethers } from 'hardhat';

import {
  MockTokenPermit,
  MockTokenPermit__factory,
  HolderDickContestERC20,
  HolderDickContestERC20__factory,
} from '../../typechain';
import { parseAmount } from '../../utils/bignumber';
import { expect } from './utils/chai-setup';
import { inReceipt } from './utils/expectEvent';
import { MAX_UINT256, ZERO_ADDRESS } from './utils/helpers';

describe('HolderDickContestERC20', () => {
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let governor: SignerWithAddress;

  let usdc: MockTokenPermit;
  let hdc: HolderDickContestERC20;

  before(async () => {
    [deployer, alice, bob, governor] = await ethers.getSigners();
  });

  beforeEach(async () => {
    usdc = (await new MockTokenPermit__factory(deployer).deploy('usdc', 'usdc', 6)) as MockTokenPermit;
    hdc = (await new HolderDickContestERC20__factory(deployer).deploy(
      usdc.address,
      parseAmount.gwei('0.01'),
      86400,
    )) as HolderDickContestERC20;
    await usdc.mint(alice.address, parseUnits('1000', 6));
    await usdc.mint(bob.address, parseUnits('1000', 6));
    await usdc.connect(alice).approve(hdc.address, MAX_UINT256);
    await usdc.connect(bob).approve(hdc.address, MAX_UINT256);
  });

  describe('constructor', () => {
    it('success - asset, withdrawFee, vesting period', async () => {
      expect(await hdc.withdrawFee()).to.be.equal(parseAmount.gwei('0.01'));
      expect(await hdc.vestingPeriod()).to.be.equal(86400);
      expect(await hdc.asset()).to.be.equal(usdc.address);
      expect(await hdc.name()).to.be.equal('usdc Holder Dick Contest');
      expect(await hdc.symbol()).to.be.equal('usdc-hdc');
    });
  });
});
