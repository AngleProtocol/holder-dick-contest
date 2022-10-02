import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { parseEther, parseUnits } from 'ethers/lib/utils';
import { ethers } from 'hardhat';

import {
  HolderDickContestERC20,
  HolderDickContestERC20__factory,
  MockTokenPermit,
  MockTokenPermit__factory,
} from '../../typechain';
import { parseAmount } from '../../utils/bignumber';
import { expect } from './utils/chai-setup';
import { inReceipt } from './utils/expectEvent';
import { expectApprox, increaseTime, latestTime, MAX_UINT256 } from './utils/helpers';

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
  describe('withdraw', () => {
    it('success - after one withdrawal', async () => {
      await hdc.connect(alice).deposit(parseUnits('1', 6), bob.address);
      expect(await hdc.totalAssets()).to.be.equal(parseUnits('1', 6));
      expect(await hdc.balanceOf(bob.address)).to.be.equal(parseEther('1'));
      expect(await usdc.balanceOf(alice.address)).to.be.equal(parseUnits('999', 6));
      const receipt = await (await hdc.connect(bob).withdraw(parseUnits('0.5', 6), bob.address, bob.address)).wait();
      const totalAssets = await hdc.totalAssets();
      expectApprox(totalAssets, parseUnits('0.49494', 6), 0.1);
      expect(await hdc.lastUpdate()).to.be.equal(await latestTime());
      expect(await usdc.balanceOf(bob.address)).to.be.equal(parseUnits('1000.5', 6));
      const newBalance = await hdc.balanceOf(bob.address);
      expectApprox(newBalance, parseEther('0.49494'), 0.1);
      inReceipt(receipt, 'Withdraw', {
        caller: bob.address,
        receiver: bob.address,
        owner: bob.address,
        assets: parseUnits('0.5', 6),
        shares: parseEther('1').sub(newBalance),
      });
      await increaseTime(86401);
      expect(await hdc.totalAssets()).to.be.equal(parseUnits('0.5', 6));
    });
    it('success - withdraw from and to different addresses', async () => {
      await hdc.connect(alice).deposit(parseUnits('1', 6), bob.address);
      expect(await hdc.totalAssets()).to.be.equal(parseUnits('1', 6));
      expect(await hdc.balanceOf(bob.address)).to.be.equal(parseEther('1'));
      expect(await usdc.balanceOf(alice.address)).to.be.equal(parseUnits('999', 6));
      await hdc.connect(bob).approve(alice.address, MAX_UINT256);
      const receipt = await (
        await hdc.connect(alice).withdraw(parseUnits('0.5', 6), governor.address, bob.address)
      ).wait();
      const totalAssets = await hdc.totalAssets();
      expectApprox(totalAssets, parseUnits('0.49494', 6), 0.1);
      expect(await hdc.lastUpdate()).to.be.equal(await latestTime());
      expect(await usdc.balanceOf(governor.address)).to.be.equal(parseUnits('0.5', 6));
      const newBalance = await hdc.balanceOf(bob.address);
      expectApprox(newBalance, parseEther('0.49494'), 0.1);
      inReceipt(receipt, 'Withdraw', {
        caller: alice.address,
        receiver: governor.address,
        owner: bob.address,
        assets: parseUnits('0.5', 6),
        shares: parseEther('1').sub(newBalance),
      });
      await increaseTime(86401);
      expect(await hdc.totalAssets()).to.be.equal(parseUnits('0.5', 6));
    });
  });
  describe('redeem', () => {
    it('success - after one redemption', async () => {
      await hdc.connect(alice).deposit(parseUnits('1', 6), bob.address);
      expect(await hdc.totalAssets()).to.be.equal(parseUnits('1', 6));
      expect(await hdc.balanceOf(bob.address)).to.be.equal(parseEther('1'));
      expect(await usdc.balanceOf(alice.address)).to.be.equal(parseUnits('999', 6));
      const receipt = await (await hdc.connect(bob).redeem(parseEther('0.3'), bob.address, bob.address)).wait();
      expect(await hdc.totalSupply()).to.be.equal(parseEther('0.7'));
      expect(await hdc.balanceOf(bob.address)).to.be.equal(parseEther('0.7'));
      const totalAssets = await hdc.totalAssets();
      expect(totalAssets).to.be.equal(parseUnits('0.7', 6));
      expect(await hdc.lastUpdate()).to.be.equal(await latestTime());
      expect(await usdc.balanceOf(bob.address)).to.be.equal(parseUnits('1000.297', 6));
      inReceipt(receipt, 'Withdraw', {
        caller: bob.address,
        receiver: bob.address,
        owner: bob.address,
        assets: parseUnits('0.297', 6),
        shares: parseEther('0.3'),
      });
      await increaseTime(86401);
      expect(await hdc.totalAssets()).to.be.equal(parseUnits('0.703', 6));
    });
    it('success - checking vesting and with different addresses', async () => {
      await hdc.connect(alice).deposit(parseUnits('1', 6), bob.address);
      expect(await hdc.totalAssets()).to.be.equal(parseUnits('1', 6));
      expect(await hdc.balanceOf(bob.address)).to.be.equal(parseEther('1'));
      expect(await usdc.balanceOf(alice.address)).to.be.equal(parseUnits('999', 6));
      await hdc.connect(bob).approve(alice.address, MAX_UINT256);
      const receipt = await (await hdc.connect(alice).redeem(parseEther('0.3'), governor.address, bob.address)).wait();
      expect(await hdc.totalSupply()).to.be.equal(parseEther('0.7'));
      expect(await hdc.balanceOf(bob.address)).to.be.equal(parseEther('0.7'));
      const totalAssets = await hdc.totalAssets();
      expect(totalAssets).to.be.equal(parseUnits('0.7', 6));
      expect(await hdc.lastUpdate()).to.be.equal(await latestTime());
      expect(await usdc.balanceOf(governor.address)).to.be.equal(parseUnits('0.297', 6));
      inReceipt(receipt, 'Withdraw', {
        caller: alice.address,
        receiver: governor.address,
        owner: bob.address,
        assets: parseUnits('0.297', 6),
        shares: parseEther('0.3'),
      });
      await increaseTime(43200);
      expect(await hdc.totalAssets()).to.be.equal(parseUnits('0.7015', 6));
      await increaseTime(43200);
      expect(await hdc.totalAssets()).to.be.equal(parseUnits('0.703', 6));
    });
    it('success - with a zero withdrawn amount', async () => {
      await hdc.connect(alice).deposit(parseUnits('1', 6), bob.address);
      expect(await hdc.totalAssets()).to.be.equal(parseUnits('1', 6));
      expect(await hdc.balanceOf(bob.address)).to.be.equal(parseEther('1'));
      expect(await usdc.balanceOf(alice.address)).to.be.equal(parseUnits('999', 6));
      await hdc.connect(bob).approve(alice.address, MAX_UINT256);
      await hdc.connect(alice).redeem(parseEther('0.3'), governor.address, bob.address);
      expect(await hdc.totalSupply()).to.be.equal(parseEther('0.7'));
      expect(await hdc.balanceOf(bob.address)).to.be.equal(parseEther('0.7'));
      const totalAssets = await hdc.totalAssets();
      expect(totalAssets).to.be.equal(parseUnits('0.7', 6));
      const lastUpdate = await hdc.lastUpdate();
      expect(lastUpdate).to.be.equal(await latestTime());
      expect(await usdc.balanceOf(governor.address)).to.be.equal(parseUnits('0.297', 6));
      await increaseTime(43200);
      expect(await hdc.totalAssets()).to.be.equal(parseUnits('0.7015', 6));
      expect(await hdc.lastUpdate()).to.be.equal(lastUpdate);
      const receipt = await (await hdc.connect(alice).redeem(parseEther('0'), governor.address, bob.address)).wait();
      inReceipt(receipt, 'Withdraw', {
        caller: alice.address,
        receiver: governor.address,
        owner: bob.address,
        assets: parseUnits('0', 6),
        shares: parseEther('0'),
      });
      expect(await hdc.lastUpdate()).to.be.equal(lastUpdate);
      await increaseTime(43200);
      expect(await hdc.totalAssets()).to.be.equal(parseUnits('0.703', 6));
    });
    it('success - consecutive withdrawals', async () => {
      await hdc.connect(alice).deposit(parseUnits('1', 6), bob.address);
      expect(await hdc.totalAssets()).to.be.equal(parseUnits('1', 6));
      expect(await hdc.balanceOf(bob.address)).to.be.equal(parseEther('1'));
      expect(await usdc.balanceOf(alice.address)).to.be.equal(parseUnits('999', 6));
      await hdc.connect(bob).approve(alice.address, MAX_UINT256);
      await hdc.connect(alice).redeem(parseEther('0.3'), governor.address, bob.address);
      expect(await hdc.totalSupply()).to.be.equal(parseEther('0.7'));
      expect(await hdc.balanceOf(bob.address)).to.be.equal(parseEther('0.7'));
      expect(await hdc.vestingProfit()).to.be.equal(parseUnits('0.003', 6));
      const totalAssets = await hdc.totalAssets();
      expect(totalAssets).to.be.equal(parseUnits('0.7', 6));
      const lastUpdate = await hdc.lastUpdate();
      expect(lastUpdate).to.be.equal(await latestTime());
      expect(await usdc.balanceOf(governor.address)).to.be.equal(parseUnits('0.297', 6));
      await increaseTime(43200);
      // 0.0015 is left to vest -> this will restart vesting for everyone
      expect(await hdc.totalAssets()).to.be.equal(parseUnits('0.7015', 6));
      expect(await hdc.lastUpdate()).to.be.equal(lastUpdate);
      const receipt = await (await hdc.connect(alice).redeem(parseEther('0.5'), governor.address, bob.address)).wait();
      // Now share price is no longer 1 for 1: you receive: 0.50107143 which makes fees of: 0.005011
      inReceipt(receipt, 'Withdraw', {
        caller: alice.address,
        receiver: governor.address,
        owner: bob.address,
        assets: parseUnits('0.496060', 6),
        shares: parseEther('0.5'),
      });
      expect(await usdc.balanceOf(governor.address)).to.be.equal(parseUnits('0.793060', 6));
      expect(await hdc.lastUpdate()).to.be.equal(await latestTime());
      expect(await hdc.vestingProfit()).to.be.equal(parseUnits('0.006511', 6));
      expect(await hdc.totalSupply()).to.be.equal(parseEther('0.2'));
      expect(await hdc.balanceOf(bob.address)).to.be.equal(parseEther('0.2'));
      expect(await hdc.totalAssets()).to.be.equal(parseUnits('0.200429', 6));
      await increaseTime(43200);
      expect(await hdc.totalAssets()).to.be.equal(parseUnits('0.203684', 6));
      await increaseTime(43200);
      expect(await hdc.totalAssets()).to.be.equal(parseUnits('0.20694', 6));
      // Vesting profit variable is not updated
      expect(await hdc.vestingProfit()).to.be.equal(parseUnits('0.006511', 6));
    });
    it('success - redeems all then someone else comes back', async () => {
      await hdc.connect(alice).deposit(parseUnits('1', 6), alice.address);
      await hdc.connect(alice).redeem(parseEther('1'), governor.address, alice.address);
      expect(await hdc.totalSupply()).to.be.equal(parseEther('0'));
      expect(await hdc.balanceOf(alice.address)).to.be.equal(parseEther('0'));
      const totalAssets = await hdc.totalAssets();
      expect(totalAssets).to.be.equal(parseUnits('0', 6));
      const lastUpdate = await hdc.lastUpdate();
      expect(lastUpdate).to.be.equal(await latestTime());
      expect(await hdc.vestingProfit()).to.be.equal(parseUnits('0.01', 6));
      expect(await usdc.balanceOf(governor.address)).to.be.equal(parseUnits('0.99', 6));
      await increaseTime(43200);
      expect(await hdc.totalAssets()).to.be.equal(parseUnits('0.005', 6));
      expect(await hdc.lastUpdate()).to.be.equal(lastUpdate);
      await increaseTime(43200);
      expect(await hdc.totalAssets()).to.be.equal(parseUnits('0.01', 6));
      expect(await hdc.lastUpdate()).to.be.equal(lastUpdate);
      // There is a null amount in the contract but some idle assets, what happens now when someone deposits
      await hdc.connect(alice).deposit(parseUnits('100', 6), alice.address);
      expect(await hdc.balanceOf(alice.address)).to.be.equal(parseEther('100'));
      // You just make a small gain in this case
      expect(await hdc.totalAssets()).to.be.equal(parseUnits('100.01', 6));
    });
  });
});
