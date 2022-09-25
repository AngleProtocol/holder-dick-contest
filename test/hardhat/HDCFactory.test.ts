import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { formatBytes32String, parseEther, parseUnits } from 'ethers/lib/utils';
import { ethers } from 'hardhat';

import {
  MockCoreBorrow,
  MockCoreBorrow__factory,
  MockTokenPermit,
  MockTokenPermit__factory,
  HolderDickContestERC20,
  HolderDickContestERC20__factory,
  HDCFactory,
  HDCFactory__factory,
} from '../../typechain';
import { parseAmount } from '../../utils/bignumber';
import { expect } from './utils/chai-setup';
import { inReceipt } from './utils/expectEvent';
import { MAX_UINT256, ZERO_ADDRESS } from './utils/helpers';

describe('HDCFactory', () => {
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let governor: SignerWithAddress;

  let usdc: MockTokenPermit;
  let factory: HDCFactory;
  let coreBorrow: MockCoreBorrow;

  before(async () => {
    [deployer, alice, bob, governor] = await ethers.getSigners();
  });

  beforeEach(async () => {
    usdc = (await new MockTokenPermit__factory(deployer).deploy('usdc', 'usdc', 6)) as MockTokenPermit;
    coreBorrow = (await new MockCoreBorrow__factory(deployer).deploy()) as MockCoreBorrow;
    factory = (await new HDCFactory__factory(deployer).deploy(coreBorrow.address)) as HDCFactory;
  });

  describe('constructor', () => {
    it('success', async () => {
      expect(await factory.coreBorrow()).to.be.equal(coreBorrow.address);
    });
  });
});
