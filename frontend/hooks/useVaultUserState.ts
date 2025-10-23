import { useMemo } from "react";
import { erc20Abi, formatUnits } from "viem";
import { useAccount, useReadContracts } from "wagmi";
import { trellisVaultAbi } from "~~/contracts/abi";

type HexAddress = `0x${string}`;

export const useVaultUserState = (params: {
  vaultAddress?: HexAddress;
  assetAddress?: HexAddress;
  chainId?: number;
  assetDecimals: number;
}) => {
  const { address: account } = useAccount();
  const { vaultAddress, assetAddress, chainId, assetDecimals } = params;

  const enabled = Boolean(account && vaultAddress && assetAddress);

  const contracts = enabled
    ? ([
        {
          address: vaultAddress!,
          abi: trellisVaultAbi,
          functionName: "balanceOf",
          args: [account!],
          chainId,
        },
        {
          address: assetAddress!,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [account!],
          chainId,
        },
        {
          address: assetAddress!,
          abi: erc20Abi,
          functionName: "allowance",
          args: [account!, vaultAddress!],
          chainId,
        },
      ] as const)
    : ([] as const);

  const { data, isLoading, refetch } = useReadContracts({
    allowFailure: false,
    query: {
      enabled,
    },
    contracts,
  });

  let userShares = 0n;
  let walletBalance = 0n;
  let allowance = 0n;

  if (data) {
    userShares = data[0] as bigint;
    walletBalance = data[1] as bigint;
    allowance = data[2] as bigint;
  }

  const formattedBalance = useMemo(() => formatUnits(walletBalance, assetDecimals), [walletBalance, assetDecimals]);

  return {
    isLoading,
    userShares,
    walletBalance,
    allowance,
    formattedBalance,
    refetch,
  };
};
