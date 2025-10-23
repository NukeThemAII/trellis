import { useMemo } from "react";
import { formatUnits } from "viem";
import { useReadContract } from "wagmi";
import { VaultConfig, VaultNetworkConfig } from "~~/config/vaults";
import { useVaultMetrics } from "~~/hooks/useVaultMetrics";
import { useVaultInfo } from "~~/hooks/useVaultInfo";
import { trellisVaultAbi } from "~~/contracts/abi";

type VaultOverviewCardProps = {
  vault: VaultConfig;
  network: VaultNetworkConfig;
};

export const VaultOverviewCard = ({ vault, network }: VaultOverviewCardProps) => {
  if (!network.address) {
    return (
      <div className="flex flex-col space-y-4 rounded-3xl border border-base-300 bg-base-200/40 p-6">
        <div>
          <h2 className="text-xl font-semibold">{vault.name}</h2>
          <p className="text-sm text-base-content/70">
            {vault.assetSymbol} on {network.chainName}
          </p>
        </div>
        <p className="text-sm text-base-content/60">Deployment pending — provide addresses in configuration to enable metrics.</p>
      </div>
    );
  }

  const { assetDecimals, assetSymbol } = useVaultInfo({ address: network.address, chainId: network.chainId });
  const decimals = assetDecimals ?? 18;

  const { data: paused } = useReadContract({
    address: network.address,
    abi: trellisVaultAbi,
    functionName: "paused",
    chainId: network.chainId,
    query: {
      enabled: Boolean(network.address),
    },
  });

  const { metrics, isLoading } = useVaultMetrics({
    address: network.address,
    chainId: network.chainId,
    decimals,
  });

  const tvl = useMemo(() => {
    if (!metrics) return "0";
    return formatUnits(metrics.totalAssets, decimals);
  }, [metrics, decimals]);

  return (
    <div className="flex flex-col space-y-4 rounded-3xl border border-base-300 bg-base-200/40 p-6">
      <div>
        <h2 className="text-xl font-semibold">{vault.name}</h2>
        <p className="text-sm text-base-content/70">
          {vault.assetSymbol} on {network.chainName}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <div className="flex flex-col">
          <span className="text-base-content/60">Vault Address</span>
          <span className="font-mono text-xs">{network.address ?? "pending deployment"}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-base-content/60">Performance Fee</span>
          <span className="font-medium">{vault.performanceFeeBps / 100}%</span>
        </div>
        <div className="flex flex-col">
          <span className="text-base-content/60">TVL</span>
          <span className="font-medium">{isLoading ? "Loading..." : `${tvl} ${assetSymbol || vault.assetSymbol}`}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-base-content/60">Share Price</span>
          <span className="font-medium">{isLoading ? "Loading..." : metrics?.pricePerShare ?? "0"}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-base-content/60">Status</span>
          <span className={`font-medium ${paused ? "text-warning" : "text-success"}`}>
            {paused ? "Paused" : "Active"}
          </span>
        </div>
      </div>
    </div>
  );
};
