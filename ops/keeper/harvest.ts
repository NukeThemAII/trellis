import 'dotenv/config';
import { createPublicClient, createWalletClient, http, formatUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, baseSepolia } from 'viem/chains';

const vaultAbi = [
  {
    "inputs": [],
    "name": "harvest",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalAssets",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalSupply",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "decimals",
    "outputs": [{ "internalType": "uint8", "name": "", "type": "uint8" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "highWaterMark",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "performanceFeeBps",
    "outputs": [{ "internalType": "uint16", "name": "", "type": "uint16" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "harvester",
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

const HWM_SCALE = 10n ** 18n;
const BPS_SCALE = 10_000n;

function getChain() {
  const network = process.env.NETWORK ?? 'base';
  return network === 'base-sepolia' ? baseSepolia : base;
}

async function main() {
  const rpcUrl = process.env.RPC_URL;
  const vaultAddress = process.env.VAULT_ADDRESS as `0x${string}` | undefined;
  const keeperKey = process.env.KEEPER_PK as `0x${string}` | undefined;
  const minFeeBps = BigInt(process.env.MIN_FEE_BPS ?? '5');

  if (!rpcUrl || !vaultAddress || !keeperKey) {
    throw new Error('RPC_URL, VAULT_ADDRESS, and KEEPER_PK must be set');
  }

  const chain = getChain();
  const account = privateKeyToAccount(keeperKey);

  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ chain, transport: http(rpcUrl), account });

  const [
    totalAssets,
    totalSupply,
    decimals,
    highWaterMark,
    performanceFeeBps,
    harvester,
    owner,
  ] = await Promise.all([
    publicClient.readContract({ address: vaultAddress, abi: vaultAbi, functionName: 'totalAssets' }),
    publicClient.readContract({ address: vaultAddress, abi: vaultAbi, functionName: 'totalSupply' }),
    publicClient.readContract({ address: vaultAddress, abi: vaultAbi, functionName: 'decimals' }),
    publicClient.readContract({ address: vaultAddress, abi: vaultAbi, functionName: 'highWaterMark' }),
    publicClient.readContract({ address: vaultAddress, abi: vaultAbi, functionName: 'performanceFeeBps' }),
    publicClient.readContract({ address: vaultAddress, abi: vaultAbi, functionName: 'harvester' }),
    publicClient.readContract({ address: vaultAddress, abi: vaultAbi, functionName: 'owner' })
  ]);

  if (
    harvester.toLowerCase() !== account.address.toLowerCase() &&
    owner.toLowerCase() !== account.address.toLowerCase()
  ) {
    console.error('keeper account is not authorized; call setHarvester() or harvest from the owner account');
    return;
  }

  if (totalSupply === 0n) {
    console.log('nothing to harvest (supply = 0)');
    return;
  }

  const ppsScaled = (totalAssets * HWM_SCALE) / totalSupply;
  if (ppsScaled <= highWaterMark) {
    console.log('no profit accrued above high-water mark');
    return;
  }

  const profitAssets = ((ppsScaled - highWaterMark) * totalSupply) / HWM_SCALE;
  const feeAssets = (profitAssets * BigInt(performanceFeeBps)) / BPS_SCALE;

  if (feeAssets * BPS_SCALE < profitAssets * minFeeBps) {
    console.log('fee below configured threshold; skipping harvest');
    return;
  }

  const feeReadable = formatUnits(feeAssets, decimals);
  console.log(`Triggering harvest. Estimated fee-accruing profit: ${feeReadable}`);

  const hash = await walletClient.writeContract({
    address: vaultAddress,
    abi: vaultAbi,
    functionName: 'harvest'
  });

  console.log(`Harvest submitted: ${hash}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
