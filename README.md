# <img src="logo.svg" alt="Holder Dick Contest" height="40px"> Holder Dick Contest

[![CI](https://github.com/AngleProtocol/holder-dick-contest/workflows/CI/badge.svg)](https://github.com/AngleProtocol/holder-dick-contest/actions?query=workflow%3ACI)

## What is the Holder Dick Contest?

It's a funny contest where those who hold their tokens longer than the others participants make money from it. If not, you're losing a bit.

## How does that work in practice?

There can be as many Holder Dick Contests (HDC) as possible as there are ERC20 tokens and possible fees.
HDC work as ERC4626 contracts where there is no entry fee but a fixed exit fee.

As such if we are 2 in the contract with 100 wETH deposited each and there is a 1% exit fee, then if you withdraw all your shares, I am left as the only share owner of the contract with 101 wETH that correspond to it: I have made 1 wETH because I held longer than you did.

## How can I deploy a new HDC contest?

You just have to go through the factory contract of the chain on which you wish to create the contest (or deploy a factory contract using the deployment scripts available here by yourself).

Once you create a HDC contest, the contract is fully permissionless and immutable.

## What tokens are supported?

Only ERC-20 tokens are supported. If you want to build a HDC for ETH, you need to use wETH.
Rebalancing tokens are supported as well.

## Is there a UI I can use to participate?

No, there's no UI so far. This is a fun experiment, and so if you'd like to take it at a bigger scale, feel free to build your own UI around HDC contracts.
