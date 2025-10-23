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

const STALE_AFTER_SECONDS = Number(process.env.NEXT_PUBLIC_PRICE_MAX_STALE ?? "3600");

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
    const latestResult = data[0];
    const decimalsResult = data[1];

    if (latestResult.status !== "success" || decimalsResult.status !== "success") {
      return undefined;
    }

    const [roundId, answer, , updatedAt, answeredInRound] = latestResult.result;
    const decimals = decimalsResult.result;

    if (answer <= 0n) return undefined;
    if (answeredInRound < roundId) return undefined;
    if (updatedAt == 0n) return undefined;

    if (STALE_AFTER_SECONDS > 0) {
      const now = BigInt(Math.floor(Date.now() / 1000));
      if (now - updatedAt > BigInt(STALE_AFTER_SECONDS)) {
        return undefined;
      }
    }

    return Number(answer) / 10 ** decimals;
  }, [data]);
};
