import { useMemo } from "react";
import { formatUnits } from "viem";
import { useReadContracts } from "wagmi";
import { trellisVaultAbi } from "~~/contracts/abi";

type HexAddress = `0x${string}`;

type VaultMetricResult = {
  totalAssets: bigint;
  totalSupply: bigint;
  performanceFeeBps: number;
  highWaterMark: bigint;
  pricePerShare: string;
};

export const useVaultMetrics = (params: { address?: HexAddress; chainId?: number; decimals?: number }) => {
  const { address, chainId, decimals = 18 } = params;

  const enabled = Boolean(address);

  const contracts = enabled
    ? ([
        {
          address: address!,
          chainId,
          abi: trellisVaultAbi,
          functionName: "totalAssets",
        },
        {
          address: address!,
          chainId,
          abi: trellisVaultAbi,
          functionName: "totalSupply",
        },
        {
          address: address!,
          chainId,
          abi: trellisVaultAbi,
          functionName: "performanceFeeBps",
        },
        {
          address: address!,
          chainId,
          abi: trellisVaultAbi,
          functionName: "highWaterMark",
        },
      ] as const)
    : undefined;

  const { data, isLoading, isFetching, refetch } = useReadContracts({
    allowFailure: false,
    query: {
      enabled,
    },
    contracts,
  });

  const metrics: VaultMetricResult | undefined = useMemo(() => {
    if (!data || data.length < 4) return undefined;
    const [totalAssets, totalSupply, performanceFeeBps, highWaterMark] = data as unknown as [
      bigint,
      bigint,
      number,
      bigint,
    ];

    const pricePerShare =
      totalSupply === 0n ? "0" : formatUnits((totalAssets * 10n ** BigInt(decimals)) / totalSupply, decimals);

    return {
      totalAssets,
      totalSupply,
      performanceFeeBps,
      highWaterMark,
      pricePerShare,
    };
  }, [data, decimals]);

  return {
    metrics,
    isLoading: isLoading || isFetching,
    refetch,
  };
};
