import { useMemo } from "react";
import { erc20Abi } from "viem";
import { useReadContract, useReadContracts } from "wagmi";
import { trellisVaultAbi } from "~~/contracts/abi";

type HexAddress = `0x${string}`;

export const useVaultInfo = (params: { address?: HexAddress; chainId?: number }) => {
  const { address, chainId } = params;

  const { data: assetAddress } = useReadContract({
    address,
    abi: trellisVaultAbi,
    functionName: "asset",
    chainId,
    query: {
      enabled: Boolean(address),
    },
  });

  const contracts = assetAddress
    ? ([
        {
          address,
          abi: trellisVaultAbi,
          functionName: "decimals",
          chainId,
        },
        {
          address,
          abi: trellisVaultAbi,
          functionName: "symbol",
          chainId,
        },
        {
          address: assetAddress as HexAddress,
          abi: erc20Abi,
          functionName: "decimals",
          chainId,
        },
        {
          address: assetAddress as HexAddress,
          abi: erc20Abi,
          functionName: "symbol",
          chainId,
        },
      ] as const)
    : undefined;

  const { data: metadata } = useReadContracts({
    query: {
      enabled: Boolean(assetAddress),
    },
    allowFailure: true,
    contracts,
  });

  const vaultDecimals = metadata && metadata[0]?.status === "success" ? (metadata[0]?.result as number) : undefined;
  const vaultSymbol = metadata && metadata[1]?.status === "success" ? (metadata[1]?.result as string) : undefined;
  const assetDecimals = metadata && metadata[2]?.status === "success" ? (metadata[2]?.result as number) : undefined;
  const assetSymbol = metadata && metadata[3]?.status === "success" ? (metadata[3]?.result as string) : undefined;

  return useMemo(
    () => ({
      assetAddress: assetAddress as HexAddress | undefined,
      vaultDecimals: (vaultDecimals as number | undefined) ?? 18,
      vaultSymbol: (vaultSymbol as string | undefined) ?? "",
      assetDecimals: (assetDecimals as number | undefined) ?? 18,
      assetSymbol: (assetSymbol as string | undefined) ?? "",
    }),
    [assetAddress, assetDecimals, assetSymbol, vaultDecimals, vaultSymbol],
  );
};
