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
import { expectApprox, MAX_UINT256, ZERO_ADDRESS } from './utils/helpers';

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

  describe('deposit, mint', () => {
    it('success - after deposit', async () => {
      const receipt = await (await hdc.connect(alice).deposit(parseUnits('1', 6), bob.address)).wait();
      expect(await hdc.balanceOf(bob.address)).to.be.equal(parseEther('1'));
      expect(await usdc.balanceOf(alice.address)).to.be.equal(parseUnits('999', 6));
      inReceipt(receipt, 'Deposit', {
        caller: alice.address,
        owner: bob.address,
        assets: parseUnits('1', 6),
        shares: parseEther('1'),
      });
    });
    it('success - after mint', async () => {
      const receipt = await (await hdc.connect(alice).mint(parseEther('1'), bob.address)).wait();
      expect(await hdc.balanceOf(bob.address)).to.be.equal(parseEther('1'));
      expect(await usdc.balanceOf(alice.address)).to.be.equal(parseUnits('999', 6));
      inReceipt(receipt, 'Deposit', {
        caller: alice.address,
        owner: bob.address,
        assets: parseUnits('1', 6),
        shares: parseEther('1'),
      });
    });
  });
  describe('maxWithdraw', () => {
    it('success', async () => {
      await hdc.connect(alice).mint(parseEther('1'), bob.address);
      expect(await hdc.maxWithdraw(bob.address)).to.be.equal(parseUnits('0.99', 6));
      expect(await hdc.maxWithdraw(alice.address)).to.be.equal(parseUnits('0', 6));
    });
  });
  describe('maxRedeem', () => {
    it('success', async () => {
      await hdc.connect(alice).mint(parseEther('1'), bob.address);
      expect(await hdc.maxRedeem(bob.address)).to.be.equal(parseEther('1'));
      expect(await hdc.maxRedeem(alice.address)).to.be.equal(parseEther('0'));
    });
  });
  describe('previewWithdraw', () => {
    it('success', async () => {
      expectApprox(await hdc.previewWithdraw(parseUnits('100', 6)), parseEther('101'), 0.1);
    });
  });
  describe('previewRedeem', () => {
    it('success', async () => {
      expect(await hdc.previewRedeem(parseEther('100'))).to.be.equal(parseUnits('99', 6));
    });
  });
  /*
  TODO
  - last to leave then someone comes back
  - handleUserGain = 0
  */
});
