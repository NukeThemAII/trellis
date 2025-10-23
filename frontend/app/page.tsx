"use client";

import type { NextPage } from "next";
import { useMemo } from "react";
import { useAccount, useChainId } from "wagmi";
import { VAULTS } from "~~/config/vaults";
import { VaultOverviewCard } from "~~/components/vaults/VaultOverviewCard";

const Home: NextPage = () => {
  const { address: connectedAddress } = useAccount();
  const chainId = useChainId();
  const liveVaults = useMemo(() => VAULTS.flatMap((vault) => vault.networks.map((network) => ({ vault, network }))), []);
  const activeVaults = useMemo(
    () =>
      liveVaults.filter(({ network }) => (chainId ? network.chainId === chainId : true)),
    [liveVaults, chainId],
  );

  return (
    <>
      <div className="flex grow flex-col gap-8 px-5 pt-10">
        <div className="text-center">
          <h1 className="text-4xl font-bold">Trellis Vaults</h1>
          <p className="mt-2 text-base-content/70">
            Secure single-asset ERC-4626 vaults routed into battle-tested Base yield strategies.
          </p>
          {connectedAddress && (
            <p className="mt-4 text-sm text-base-content/60">Connected wallet: {connectedAddress}</p>
          )}
        </div>

        <div className="flex flex-col gap-6">
          {activeVaults.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-base-300 bg-base-200/40 px-6 py-8 text-center text-base-content/60">
              Configure `NEXT_PUBLIC_DEFAULT_VAULT_ADDRESS` to preview vault metrics for the current network.
            </div>
          ) : (
            activeVaults.map(({ vault, network }) => (
              <VaultOverviewCard
                key={`${vault.id}-${network.chainId}`}
                vault={vault}
                network={network}
                decimals={vault.assetDecimals}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
};

export default Home;
