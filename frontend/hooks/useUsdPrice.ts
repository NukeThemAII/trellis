import { useMemo } from "react";
import { useReadContracts } from "wagmi";

const aggregatorAbi = [
  {
    inputs: [],
    name: "latestRoundData",
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

type HexAddress = `0x${string}`;

export const useUsdPrice = (params: { feed?: HexAddress; chainId?: number }) => {
  const { feed, chainId } = params;
  const enabled = Boolean(feed);

  const contracts = enabled
    ? ([
        {
          address: feed!,
          abi: aggregatorAbi,
          functionName: "latestRoundData",
          chainId,
        },
        {
          address: feed!,
          abi: aggregatorAbi,
          functionName: "decimals",
          chainId,
        },
      ] as const)
    : ([] as const);

  const { data } = useReadContracts({
    allowFailure: true,
    query: {
      enabled,
    },
    contracts,
  });

  return useMemo(() => {
    if (!data || !data[0] || !data[1]) return undefined;
    const latest = data[0] as [bigint, bigint, bigint, bigint, bigint];
    const decimals = data[1] as number;
    const answer = Number(latest[1]) / 10 ** decimals;
    return answer;
  }, [data]);
};
