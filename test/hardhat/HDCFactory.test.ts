import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { formatBytes32String, parseEther, parseUnits } from 'ethers/lib/utils';
import { ethers } from 'hardhat';

import {
  HDCFactory,
  HDCFactory__factory,
  HolderDickContestERC20,
  HolderDickContestERC20__factory,
  MockCoreBorrow,
  MockCoreBorrow__factory,
  MockTokenPermit,
  MockTokenPermit__factory,
} from '../../typechain';
import { parseAmount } from '../../utils/bignumber';
import { expect } from './utils/chai-setup';
import { inReceipt } from './utils/expectEvent';
import { increaseTime, latestTime, MAX_UINT256, ZERO_ADDRESS } from './utils/helpers';

describe('HDCFactory', () => {
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let governor: SignerWithAddress;

  let usdc: MockTokenPermit;
  let weth: MockTokenPermit;
  let factory: HDCFactory;
  let coreBorrow: MockCoreBorrow;

  before(async () => {
    [deployer, alice, bob, governor] = await ethers.getSigners();
  });

  beforeEach(async () => {
    usdc = (await new MockTokenPermit__factory(deployer).deploy('usdc', 'usdc', 6)) as MockTokenPermit;
    weth = (await new MockTokenPermit__factory(deployer).deploy('weth', 'weth', 18)) as MockTokenPermit;
    coreBorrow = (await new MockCoreBorrow__factory(deployer).deploy()) as MockCoreBorrow;
    factory = (await new HDCFactory__factory(deployer).deploy(coreBorrow.address)) as HDCFactory;
    await usdc.mint(alice.address, parseUnits('1000', 6));
    await coreBorrow.toggleGovernor(governor.address);
  });

  describe('constructor', () => {
    it('success - parameters rightly initialized', async () => {
      expect(await factory.coreBorrow()).to.be.equal(coreBorrow.address);
      expect(await factory.supportedFees(parseAmount.gwei('0.01'))).to.be.equal(true);
      expect(await factory.supportedVestingPeriods(86400)).to.be.equal(true);
    });
    it('reverts - zero address', async () => {
      await expect(new HDCFactory__factory(deployer).deploy(ZERO_ADDRESS)).to.be.revertedWith('ZeroAddress');
    });
  });
  describe('deployHDC', () => {
    it('reverts - invalid fees or vesting period', async () => {
      await expect(factory.deployHDC(usdc.address, 0, 86400)).to.be.revertedWith('InvalidCall');
      await expect(factory.deployHDC(usdc.address, parseAmount.gwei('0.01'), 0)).to.be.revertedWith('InvalidCall');
    });
    it('success - HDC deployed', async () => {
      const receipt = await (await factory.deployHDC(usdc.address, parseAmount.gwei('0.01'), 86400)).wait();
      const deploymentAddress = await factory.hdcFactory(usdc.address, parseAmount.gwei('0.01'));
      expect(await factory.hdcContractList(0)).to.be.equal(deploymentAddress);
      expect(await factory.getHDCAddress(usdc.address, parseAmount.gwei('0.01'))).to.be.equal(deploymentAddress);
      expect((await factory.getAllHDCContracts())[0]).to.be.equal(deploymentAddress);
      inReceipt(receipt, 'NewHDCContract', {
        asset: usdc.address,
        fees: parseAmount.gwei('0.01'),
        vestingPeriod: 86400,
        deploymentAddress: deploymentAddress,
      });
      const hdc = new ethers.Contract(
        deploymentAddress,
        HolderDickContestERC20__factory.createInterface(),
        deployer,
      ) as HolderDickContestERC20;

      expect(await hdc.withdrawFee()).to.be.equal(parseAmount.gwei('0.01'));
      expect(await hdc.vestingPeriod()).to.be.equal(86400);
      expect(await hdc.asset()).to.be.equal(usdc.address);
      expect(await hdc.name()).to.be.equal('usdc Holder Dick Contest');
      expect(await hdc.symbol()).to.be.equal('usdc-hdc');

      await usdc.connect(alice).approve(hdc.address, MAX_UINT256);
      await hdc.connect(alice).deposit(parseUnits('1', 6), bob.address);
      expect(await hdc.totalAssets()).to.be.equal(parseUnits('1', 6));
      expect(await hdc.balanceOf(bob.address)).to.be.equal(parseEther('1'));
      expect(await usdc.balanceOf(alice.address)).to.be.equal(parseUnits('999', 6));
      const receipt2 = await (await hdc.connect(bob).redeem(parseEther('0.3'), bob.address, bob.address)).wait();
      expect(await hdc.totalSupply()).to.be.equal(parseEther('0.7'));
      expect(await hdc.balanceOf(bob.address)).to.be.equal(parseEther('0.7'));
      const totalAssets = await hdc.totalAssets();
      expect(totalAssets).to.be.equal(parseUnits('0.7', 6));
      expect(await hdc.lastUpdate()).to.be.equal(await latestTime());
      expect(await usdc.balanceOf(bob.address)).to.be.equal(parseUnits('0.297', 6));
      inReceipt(receipt2, 'Withdraw', {
        caller: bob.address,
        receiver: bob.address,
        owner: bob.address,
        assets: parseUnits('0.297', 6),
        shares: parseEther('0.3'),
      });
      await increaseTime(86401);
      expect(await hdc.totalAssets()).to.be.equal(parseUnits('0.703', 6));
    });

    it('reverts - two HDC already deployed', async () => {
      await factory.deployHDC(usdc.address, parseAmount.gwei('0.01'), 86400);
      await expect(factory.deployHDC(usdc.address, parseAmount.gwei('0.01'), 86400)).to.be.revertedWith('InvalidCall');
    });
    it('success - two HDC contracts deployed from the factory', async () => {
      const receipt = await (await factory.deployHDC(usdc.address, parseAmount.gwei('0.01'), 86400)).wait();
      const deploymentAddress = await factory.hdcFactory(usdc.address, parseAmount.gwei('0.01'));
      const receipt2 = await (await factory.deployHDC(weth.address, parseAmount.gwei('0.01'), 86400)).wait();
      const deploymentAddress2 = await factory.hdcFactory(weth.address, parseAmount.gwei('0.01'));
      expect(await factory.hdcContractList(0)).to.be.equal(deploymentAddress);
      expect(await factory.hdcContractList(1)).to.be.equal(deploymentAddress2);
      expect(await factory.getHDCAddress(usdc.address, parseAmount.gwei('0.01'))).to.be.equal(deploymentAddress);
      expect(await factory.getHDCAddress(weth.address, parseAmount.gwei('0.01'))).to.be.equal(deploymentAddress2);
      expect((await factory.getAllHDCContracts())[0]).to.be.equal(deploymentAddress);
      expect((await factory.getAllHDCContracts())[1]).to.be.equal(deploymentAddress2);
      inReceipt(receipt, 'NewHDCContract', {
        asset: usdc.address,
        fees: parseAmount.gwei('0.01'),
        vestingPeriod: 86400,
        deploymentAddress: deploymentAddress,
      });
      inReceipt(receipt2, 'NewHDCContract', {
        asset: weth.address,
        fees: parseAmount.gwei('0.01'),
        vestingPeriod: 86400,
        deploymentAddress: deploymentAddress2,
      });
      const hdc = new ethers.Contract(
        deploymentAddress,
        HolderDickContestERC20__factory.createInterface(),
        deployer,
      ) as HolderDickContestERC20;
      const hdc2 = new ethers.Contract(
        deploymentAddress2,
        HolderDickContestERC20__factory.createInterface(),
        deployer,
      ) as HolderDickContestERC20;

      expect(await hdc.withdrawFee()).to.be.equal(parseAmount.gwei('0.01'));
      expect(await hdc.vestingPeriod()).to.be.equal(86400);
      expect(await hdc.asset()).to.be.equal(usdc.address);
      expect(await hdc.name()).to.be.equal('usdc Holder Dick Contest');
      expect(await hdc.symbol()).to.be.equal('usdc-hdc');

      expect(await hdc2.withdrawFee()).to.be.equal(parseAmount.gwei('0.01'));
      expect(await hdc2.vestingPeriod()).to.be.equal(86400);
      expect(await hdc2.asset()).to.be.equal(weth.address);
      expect(await hdc2.name()).to.be.equal('weth Holder Dick Contest');
      expect(await hdc2.symbol()).to.be.equal('weth-hdc');
    });
  });
  describe('toggleUint64', () => {
    it('reverts - not governor or guardian', async () => {
      await expect(factory.toggleUint64(10, formatBytes32String('0x'))).to.be.revertedWith('NotGovernorOrGuardian');
    });
    it('reverts - invalid param', async () => {
      await expect(factory.connect(governor).toggleUint64(10, formatBytes32String('0x'))).to.be.revertedWith(
        'InvalidParam',
      );
      await expect(
        factory.connect(governor).toggleUint64(parseAmount.gwei('10'), formatBytes32String('F')),
      ).to.be.revertedWith('InvalidParam');
      await expect(
        factory.connect(governor).toggleUint64(parseAmount.gwei('0'), formatBytes32String('V')),
      ).to.be.revertedWith('InvalidParam');
    });
    it('success - fee changed', async () => {
      const receipt = await (
        await factory.connect(governor).toggleUint64(parseAmount.gwei('0.1'), formatBytes32String('F'))
      ).wait();
      inReceipt(receipt, 'FiledUint64', {
        param: parseAmount.gwei('0.1'),
        what: formatBytes32String('F'),
      });
      expect(await factory.supportedFees(parseAmount.gwei('0.1'))).to.be.equal(true);
      const receipt2 = await (
        await factory.connect(governor).toggleUint64(parseAmount.gwei('0.1'), formatBytes32String('F'))
      ).wait();
      inReceipt(receipt2, 'FiledUint64', {
        param: parseAmount.gwei('0.1'),
        what: formatBytes32String('F'),
      });
      expect(await factory.supportedFees(parseAmount.gwei('0.1'))).to.be.equal(false);
    });
    it('success - vesting period changed', async () => {
      const receipt = await (
        await factory.connect(governor).toggleUint64(parseAmount.gwei('0.1'), formatBytes32String('V'))
      ).wait();
      inReceipt(receipt, 'FiledUint64', {
        param: parseAmount.gwei('0.1'),
        what: formatBytes32String('V'),
      });
      expect(await factory.supportedVestingPeriods(parseAmount.gwei('0.1'))).to.be.equal(true);
      const receipt2 = await (
        await factory.connect(governor).toggleUint64(parseAmount.gwei('0.1'), formatBytes32String('V'))
      ).wait();
      inReceipt(receipt2, 'FiledUint64', {
        param: parseAmount.gwei('0.1'),
        what: formatBytes32String('V'),
      });
      expect(await factory.supportedVestingPeriods(parseAmount.gwei('0.1'))).to.be.equal(false);
    });
  });
});
