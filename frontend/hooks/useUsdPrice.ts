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

const DEFAULT_STALE_AFTER_SECONDS = 60 * 60; // 1 hour

export const useUsdPrice = (params: { feed?: HexAddress; chainId?: number; staleAfterSeconds?: number }) => {
  const { feed, chainId, staleAfterSeconds = DEFAULT_STALE_AFTER_SECONDS } = params;
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
    : undefined;

  const { data } = useReadContracts({
    allowFailure: true,
    query: {
      enabled,
    },
    contracts,
  });

  return useMemo(() => {
    if (!data || data.length < 2) return undefined;

    const latestRound = data[0];
    const decimalsResult = data[1];

    if (latestRound.status !== "success" || decimalsResult.status !== "success") {
      return undefined;
    }

    const latest = latestRound.result as [bigint, bigint, bigint, bigint, bigint];
    const decimals = Number(decimalsResult.result);

    const [roundId, answer, startedAt, updatedAt, answeredInRound] = latest;
    if (answer <= 0n) return undefined;
    if (updatedAt == 0n || answeredInRound < roundId) return undefined;
    if (startedAt == 0n) return undefined;

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (Number(updatedAt) + staleAfterSeconds < nowSeconds) return undefined;

    return Number(answer) / 10 ** decimals;
  }, [data, staleAfterSeconds]);
};
