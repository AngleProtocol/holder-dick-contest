import { ChainId,  CONTRACTS_ADDRESSES } from '@angleprotocol/sdk';
import { DeployFunction } from 'hardhat-deploy/types';
import {deploy} from './helpers'

const func: DeployFunction = async ({ deployments,  network }) => {
  console.log(`Deploying the contract on ${network.name}`)
  const marketplace = await deploy('Marketplace',[])
  console.log('Success')
};

func.tags = ['registry'];
// func.dependencies = ['marketplace'];
export default func;
