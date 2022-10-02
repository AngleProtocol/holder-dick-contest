import { ChainId,  CONTRACTS_ADDRESSES } from '@angleprotocol/sdk';
import { DeployFunction } from 'hardhat-deploy/types';
import yargs from 'yargs';

const argv = yargs.env('').boolean('ci').parseSync();

const func: DeployFunction = async ({ deployments,  network, ethers }) => {
  const { deploy } = deployments;
  const { deployer } = await ethers.getNamedSigners();
  console.log(`Deploying the contract on ${network.name}`)
  let coreBorrow: string;
  if (!network.live || network.config.chainId == 1) {
    // If we're in mainnet fork, we're using the `CoreBorrow` address from mainnet
    coreBorrow = CONTRACTS_ADDRESSES[ChainId.MAINNET].CoreBorrow!;
  } else {
    // Otherwise, we're using the address from the desired network
    coreBorrow = CONTRACTS_ADDRESSES[network.config.chainId as ChainId].CoreBorrow!;
  }
  console.log(`CoreBorrow address is ${coreBorrow}`)
  await deploy('HDCFactory', {
    contract: 'HDCFactory',
    from: deployer.address,
    args: [coreBorrow],
    log: !argv.ci,
  });
  const hdcFactory = (await deployments.get('HDCFactory')).address;
  console.log(`Successfully deployed the hdc factory at ${hdcFactory}`)
};

func.tags = ['factory'];
export default func;
