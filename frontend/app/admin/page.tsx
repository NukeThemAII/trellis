"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { isAddress } from "viem";
import { useAccount, useChainId, useReadContracts, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { Address } from "~~/components/scaffold-eth";
import { VAULTS } from "~~/config/vaults";
import { trellisVaultAbi } from "~~/contracts/abi";

type HexAddress = `0x${string}`;

const AdminPage = () => {
  const { address: account } = useAccount();
  const cards = useMemo(
    () =>
      VAULTS.flatMap((vault) =>
        vault.networks
          .filter((network) => Boolean(network.address))
          .map((network) => ({
            vault,
            network: network as { chainId: number; chainName: string; address: HexAddress },
          })),
      ),
    [],
  );

  if (cards.length === 0) {
    return (
      <div className="px-5 py-10">
        <h1 className="text-3xl font-bold">Admin</h1>
        <p className="mt-4 text-base-content/70">No vault deployments found. Configure addresses and rerun the generator.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-5 py-10">
      <h1 className="text-3xl font-bold">Admin Controls</h1>
      <p className="text-base-content/70">
        Wallet: {account ?? "not connected"} · Only vault owners can execute administrative actions.
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        {cards.map(({ vault, network }) => (
          <AdminCard key={`${vault.id}-${network.chainId}`} vaultName={vault.name} network={network} />
        ))}
      </div>
    </div>
  );
};

const AdminCard = ({
  vaultName,
  network,
}: {
  vaultName: string;
  network: { chainId: number; chainName: string; address: HexAddress };
}) => {
  const { address: account } = useAccount();
  const connectedChainId = useChainId();
  const [newStrategy, setNewStrategy] = useState("");
  const [newFeeBps, setNewFeeBps] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data, refetch } = useReadContracts({
    allowFailure: false,
    query: { enabled: Boolean(network.address) },
    contracts: [
      {
        address: network.address,
        abi: trellisVaultAbi,
        functionName: "owner",
        chainId: network.chainId,
      },
      {
        address: network.address,
        abi: trellisVaultAbi,
        functionName: "paused",
        chainId: network.chainId,
      },
      {
        address: network.address,
        abi: trellisVaultAbi,
        functionName: "performanceFeeBps",
        chainId: network.chainId,
      },
      {
        address: network.address,
        abi: trellisVaultAbi,
        functionName: "strategy",
        chainId: network.chainId,
      },
    ],
  });

  const owner = (data?.[0] as HexAddress | undefined) ?? "0x0000000000000000000000000000000000000000";
  const paused = (data?.[1] as boolean | undefined) ?? false;
  const performanceFeeBps = (data?.[2] as number | undefined) ?? 0;
  const currentStrategy = (data?.[3] as HexAddress | undefined) ?? "0x0000000000000000000000000000000000000000";

  const isOwner = Boolean(account && owner && account.toLowerCase() === owner.toLowerCase());
  const networkMismatch = connectedChainId !== undefined && connectedChainId !== network.chainId;

  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();
  const send = (config: Parameters<typeof writeContract>[0]) => {
    setError(null);
    writeContract(config);
  };
  const {
    isLoading: isMining,
    isSuccess,
  } = useWaitForTransactionReceipt({ hash: txHash, chainId: network.chainId, query: { enabled: Boolean(txHash) } });

  useEffect(() => {
    if (isSuccess) {
      setError(null);
      setNewStrategy("");
      setNewFeeBps("");
      refetch();
    }
  }, [isSuccess, refetch]);

  useEffect(() => {
    if (writeError) setError(writeError.message);
    else setError(null);
  }, [writeError]);

  const handleSetStrategy = () => {
    if (!isAddress(newStrategy)) {
      setError("Invalid strategy address");
      return;
    }
    send({
      address: network.address,
      abi: trellisVaultAbi,
      functionName: "setStrategy",
      args: [newStrategy as HexAddress],
      chainId: network.chainId,
    });
  };

  const handleSetPerformanceFee = () => {
    const fee = Number(newFeeBps);
    if (!Number.isFinite(fee) || fee < 0 || fee > 2000) {
      setError("Performance fee must be between 0 and 2000 bps");
      return;
    }
    send({
      address: network.address,
      abi: trellisVaultAbi,
      functionName: "setPerformanceFee",
      args: [fee],
      chainId: network.chainId,
    });
  };

  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-base-300 bg-base-200/40 p-6">
      <div>
        <h2 className="text-xl font-semibold">{vaultName}</h2>
        <p className="text-sm text-base-content/70">
          Network {network.chainName} · Address <Address address={network.address} />
        </p>
      </div>
      <div className="grid gap-2 text-sm">
        <InfoRow label="Owner" value={<Address address={owner} />} />
        <InfoRow label="Strategy" value={<Address address={currentStrategy} />} />
        <InfoRow label="Performance Fee" value={`${(performanceFeeBps / 100).toFixed(2)}% (${performanceFeeBps} bps)`} />
        <InfoRow label="Status" value={paused ? "Paused" : "Active"} />
      </div>

      {!isOwner && (
        <div className="rounded-2xl border border-dashed border-warning bg-warning/10 p-3 text-sm text-warning">
          Connect the ops multisig ({owner}) to manage this vault.
        </div>
      )}

      {networkMismatch && (
        <div className="rounded-2xl border border-dashed border-info bg-info/10 p-3 text-sm">
          Switch wallet network to {network.chainName} (chain ID {network.chainId}) before executing actions.
        </div>
      )}

      {isOwner && !networkMismatch && (
        <>
          <div className="flex flex-wrap gap-3">
            <button
              className="btn btn-sm"
              disabled={isPending || isMining}
              onClick={() =>
                send({
                  address: network.address,
                  abi: trellisVaultAbi,
                  functionName: paused ? "unpause" : "pause",
                  args: [],
                  chainId: network.chainId,
                })
              }
            >
              {paused ? "Unpause" : "Pause"}
            </button>
            <button
              className="btn btn-sm btn-secondary"
              disabled={isPending || isMining}
              onClick={() =>
                send({
                  address: network.address,
                  abi: trellisVaultAbi,
                  functionName: "harvest",
                  args: [],
                  chainId: network.chainId,
                })
              }
            >
              Harvest
            </button>
            <button
              className="btn btn-sm btn-outline"
              disabled={isPending || isMining}
              onClick={() =>
                send({
                  address: network.address,
                  abi: trellisVaultAbi,
                  functionName: "withdrawAllFromStrategy",
                  args: [],
                  chainId: network.chainId,
                })
              }
            >
              Withdraw All from Strategy
            </button>
          </div>

          <div className="flex flex-col gap-3 text-sm">
            <label className="flex flex-col gap-2">
              <span>New Strategy Address</span>
              <input
                className="input input-bordered input-sm"
                placeholder="0x..."
                value={newStrategy}
                onChange={(event) => setNewStrategy(event.target.value)}
              />
              <button className="btn btn-sm btn-outline" disabled={isPending || isMining} onClick={handleSetStrategy}>
                Set Strategy
              </button>
            </label>
            <label className="flex flex-col gap-2">
              <span>Performance Fee (bps)</span>
              <input
                className="input input-bordered input-sm"
                placeholder="1000"
                value={newFeeBps}
                onChange={(event) => setNewFeeBps(event.target.value)}
              />
              <button className="btn btn-sm btn-outline" disabled={isPending || isMining} onClick={handleSetPerformanceFee}>
                Update Fee
              </button>
            </label>
          </div>
        </>
      )}

      {(isPending || isMining) && <p className="text-sm text-base-content/60">Transaction pending...</p>}
      {error && <p className="text-sm text-error">{error}</p>}
    </div>
  );
};

const InfoRow = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="flex justify-between gap-4">
    <span className="text-base-content/60">{label}</span>
    <span className="text-right font-medium">{value}</span>
  </div>
);

export default AdminPage;
