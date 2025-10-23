"use client";

import { useEffect, useMemo, useState } from "react";
import { notFound, useParams } from "next/navigation";
import { formatUnits, isAddress, parseUnits } from "viem";
import { useAccount, useChainId, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { Address } from "~~/components/scaffold-eth";
import { findVaultByAddress, findStrategyForVault } from "~~/config/vaults";
import { VaultOverviewCard } from "~~/components/vaults/VaultOverviewCard";
import { useVaultMetrics } from "~~/hooks/useVaultMetrics";
import { useVaultInfo } from "~~/hooks/useVaultInfo";
import { useVaultUserState } from "~~/hooks/useVaultUserState";
import { useUsdPrice } from "~~/hooks/useUsdPrice";
import { trellisVaultAbi } from "~~/contracts/abi";
import { erc20Abi } from "viem";

type HexAddress = `0x${string}`;

const parseAddressParam = (value: string): HexAddress | null => {
  const address = value.startsWith("0x") ? value : `0x${value}`;
  if (isAddress(address)) return address as HexAddress;
  return null;
};

const hasMismatchedNetwork = (connected?: number, expected?: number) =>
  Boolean(connected && expected && connected !== expected);

const useStrategyAddress = (chainId?: number) => useMemo(() => (chainId ? findStrategyForVault(chainId) : undefined), [chainId]);
const parseEnvAddress = (value?: string) => (value && isAddress(value) ? (value as HexAddress) : undefined);

const DepositCard = ({
  vaultAddress,
  assetAddress,
  chainId,
  assetSymbol,
  assetDecimals,
  allowance,
  refetchAllowance,
  onComplete,
}: {
  vaultAddress: HexAddress;
  assetAddress: HexAddress;
  chainId: number;
  assetSymbol: string;
  assetDecimals: number;
  allowance: bigint;
  refetchAllowance: () => Promise<unknown>;
  onComplete: () => Promise<void> | void;
}) => {
  const { address: account } = useAccount();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const parsedAmount = useMemo(() => {
    try {
      if (!amount) return 0n;
      return parseUnits(amount, assetDecimals);
    } catch {
      return null;
    }
  }, [amount, assetDecimals]);

  const currentAllowance = allowance ?? 0n;
  const needsApproval = parsedAmount !== null && account && parsedAmount > 0n && currentAllowance < parsedAmount;

  const {
    writeContract: writeApprove,
    data: approveHash,
    isPending: isApprovePending,
    error: approveError,
  } = useWriteContract();
  const {
    isLoading: isApproveMining,
    isSuccess: approveSuccess,
  } = useWaitForTransactionReceipt({ hash: approveHash, chainId, query: { enabled: Boolean(approveHash) } });

  const {
    writeContract: writeDeposit,
    data: depositHash,
    isPending: isDepositPending,
    error: depositError,
  } = useWriteContract();
  const {
    isLoading: isDepositMining,
    isSuccess: depositSuccess,
  } = useWaitForTransactionReceipt({ hash: depositHash, chainId, query: { enabled: Boolean(depositHash) } });

  useEffect(() => {
    if (approveSuccess) {
      void refetchAllowance();
    }
  }, [approveSuccess, refetchAllowance]);

  useEffect(() => {
    if (depositSuccess) {
      setAmount("");
      void onComplete();
    }
  }, [depositSuccess, onComplete]);

  useEffect(() => {
    if (approveError) setError(approveError.message);
    else if (depositError) setError(depositError.message);
    else setError(null);
  }, [approveError, depositError]);

  const handleApprove = () => {
    if (!account || parsedAmount === null) return;
    writeApprove({
      address: assetAddress,
      abi: erc20Abi,
      functionName: "approve",
      args: [vaultAddress, parsedAmount],
      chainId,
    });
  };

  const handleDeposit = () => {
    if (!account || parsedAmount === null) return;
    writeDeposit({
      address: vaultAddress,
      abi: trellisVaultAbi,
      functionName: "deposit",
      args: [parsedAmount, account],
      chainId,
    });
  };

  return (
    <div className="rounded-3xl border border-base-300 bg-base-200/40 p-6">
      <h3 className="text-lg font-semibold">Deposit</h3>
      <p className="mt-1 text-sm text-base-content/70">Supply {assetSymbol} into the vault.</p>
      <div className="mt-4 flex flex-col gap-3">
        <input
          className="input input-bordered input-primary"
          placeholder={`Amount in ${assetSymbol}`}
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
        {error && <p className="text-sm text-error">{error}</p>}
        <div className="flex flex-wrap gap-3">
          {needsApproval && (
            <button
              className="btn btn-outline btn-sm"
              disabled={isApprovePending || isApproveMining || parsedAmount === null}
              onClick={handleApprove}
            >
              {isApprovePending || isApproveMining ? "Approving..." : `Approve ${assetSymbol}`}
            </button>
          )}
          <button
            className="btn btn-primary btn-sm"
            disabled={!account || parsedAmount === null || parsedAmount === 0n || isDepositPending || isDepositMining || needsApproval}
            onClick={handleDeposit}
          >
            {isDepositPending || isDepositMining ? "Depositing..." : "Deposit"}
          </button>
        </div>
      </div>
    </div>
  );
};

const WithdrawCard = ({
  vaultAddress,
  assetSymbol,
  assetDecimals,
  chainId,
  onComplete,
}: {
  vaultAddress: HexAddress;
  assetSymbol: string;
  assetDecimals: number;
  chainId: number;
  onComplete: () => Promise<void> | void;
}) => {
  const { address: account } = useAccount();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const parsedAmount = useMemo(() => {
    try {
      if (!amount) return 0n;
      return parseUnits(amount, assetDecimals);
    } catch {
      return null;
    }
  }, [amount, assetDecimals]);

  const {
    writeContract: writeWithdraw,
    data: withdrawHash,
    isPending: isWithdrawPending,
    error: withdrawError,
  } = useWriteContract();
  const {
    isLoading: isWithdrawMining,
    isSuccess: withdrawSuccess,
  } = useWaitForTransactionReceipt({ hash: withdrawHash, chainId, query: { enabled: Boolean(withdrawHash) } });

  useEffect(() => {
    if (withdrawSuccess) {
      setAmount("");
      void onComplete();
    }
  }, [withdrawSuccess, onComplete]);

  useEffect(() => {
    if (withdrawError) setError(withdrawError.message);
    else setError(null);
  }, [withdrawError]);

  const handleWithdraw = () => {
    if (!account || parsedAmount === null) return;
    writeWithdraw({
      address: vaultAddress,
      abi: trellisVaultAbi,
      functionName: "withdraw",
      args: [parsedAmount, account, account],
      chainId,
    });
  };

  return (
    <div className="rounded-3xl border border-base-300 bg-base-200/40 p-6">
      <h3 className="text-lg font-semibold">Withdraw</h3>
      <p className="mt-1 text-sm text-base-content/70">Redeem vault shares back into {assetSymbol}.</p>
      <div className="mt-4 flex flex-col gap-3">
        <input
          className="input input-bordered input-primary"
          placeholder={`Amount in ${assetSymbol}`}
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
        {error && <p className="text-sm text-error">{error}</p>}
        <button
          className="btn btn-secondary btn-sm"
          disabled={!account || parsedAmount === null || parsedAmount === 0n || isWithdrawPending || isWithdrawMining}
          onClick={handleWithdraw}
        >
          {isWithdrawPending || isWithdrawMining ? "Withdrawing..." : "Withdraw"}
        </button>
      </div>
    </div>
  );
};

const VaultPage = () => {
  const params = useParams<{ address: string }>();
  const { address: connectedWallet } = useAccount();
  const connectedChainId = useChainId();
  const { switchChainAsync } = useSwitchChain();

  const paramAddress = parseAddressParam(params.address);
  if (!paramAddress) notFound();

  const matchingVault = findVaultByAddress(paramAddress);
  if (!matchingVault) notFound();

  const { vault, network } = matchingVault;
  const expectedChainId = network.chainId;

  const { assetAddress, assetDecimals, assetSymbol } = useVaultInfo({
    address: network.address,
    chainId: expectedChainId,
  });

  const { metrics, isLoading: metricsLoading, refetch: refetchMetrics } = useVaultMetrics({
    address: network.address,
    chainId: expectedChainId,
    decimals: assetDecimals,
  });

  const { userShares, walletBalance, allowance, formattedBalance, refetch: refetchUser } = useVaultUserState({
    vaultAddress: network.address,
    assetAddress,
    chainId: expectedChainId,
    assetDecimals,
  });

  const strategyAddress = useStrategyAddress(expectedChainId);
  const usdFeed = parseEnvAddress(process.env.NEXT_PUBLIC_CHAINLINK_USD_FEED);
  const staleSecondsEnv = Number(process.env.NEXT_PUBLIC_CHAINLINK_STALE_AFTER ?? "");
  const staleSeconds = Number.isFinite(staleSecondsEnv) && staleSecondsEnv > 0 ? staleSecondsEnv : undefined;
  const usdPrice = useUsdPrice({ feed: usdFeed, chainId: expectedChainId, staleAfterSeconds: staleSeconds });

  const totalAssetsFormatted = metrics ? formatUnits(metrics.totalAssets, assetDecimals) : "0";
  const totalSupplyFormatted = metrics ? formatUnits(metrics.totalSupply, assetDecimals) : "0";
  const userSharesFormatted = formatUnits(userShares, assetDecimals);
  const userAssets = metrics && metrics.totalSupply > 0n ? (metrics.totalAssets * userShares) / metrics.totalSupply : 0n;
  const userAssetsFormatted = formatUnits(userAssets, assetDecimals);
  const tvlUsd = usdPrice && metrics ? (usdPrice * Number(formatUnits(metrics.totalAssets, assetDecimals))) : undefined;

  const refetchAll = async () => {
    await Promise.all([refetchMetrics(), refetchUser()]);
  };

  const networkMismatch = hasMismatchedNetwork(connectedChainId, expectedChainId);

  return (
    <div className="flex flex-col gap-8 px-5 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">{vault.name}</h1>
        <p className="text-base-content/70">
          {vault.assetSymbol} · Performance fee {vault.performanceFeeBps / 100}% · Network {network.chainName}
        </p>
        <div className="flex items-center gap-2 text-sm text-base-content/70">
          <span>Vault Address:</span>
          <Address address={network.address} />
        </div>
        {strategyAddress && (
          <div className="flex items-center gap-2 text-sm text-base-content/70">
            <span>Strategy Adapter:</span>
            <Address address={strategyAddress} />
          </div>
        )}
        {usdPrice && (
          <p className="text-sm text-base-content/70">
            Latest USD price: {usdPrice.toFixed(4)} · TVL (USD): {tvlUsd?.toFixed(2) ?? "n/a"}
          </p>
        )}
      </div>

      {networkMismatch && (
        <div className="rounded-3xl border border-warning bg-warning/10 p-4">
          <p className="text-sm">
            You are connected to chain ID {connectedChainId}. Switch to {network.chainName} to interact with this vault.
          </p>
          <button
            className="btn btn-sm mt-3"
            onClick={() => switchChainAsync?.({ chainId: expectedChainId })}
            disabled={!switchChainAsync}
          >
            Switch Network
          </button>
        </div>
      )}

      <VaultOverviewCard vault={vault} network={network} decimals={assetDecimals} />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-base-300 bg-base-200/40 p-6">
          <h3 className="text-lg font-semibold">Vault Metrics</h3>
          <div className="mt-4 grid gap-3 text-sm">
            <Stat label="Total Assets" value={`${totalAssetsFormatted} ${assetSymbol}`} loading={metricsLoading} />
            <Stat label="Total Supply (shares)" value={totalSupplyFormatted} loading={metricsLoading} />
            <Stat label="Share Price" value={metrics?.pricePerShare ?? "0"} loading={metricsLoading} />
            <Stat label="High Water Mark" value={metrics ? metrics.highWaterMark.toString() : "0"} loading={metricsLoading} />
          </div>
        </div>

        <div className="rounded-3xl border border-base-300 bg-base-200/40 p-6">
          <h3 className="text-lg font-semibold">Your Position</h3>
          <div className="mt-4 grid gap-3 text-sm">
            <Stat label="Wallet Balance" value={`${formattedBalance} ${assetSymbol}`} />
            <Stat label="Vault Shares" value={userSharesFormatted} />
            <Stat label="Vault Assets" value={`${userAssetsFormatted} ${assetSymbol}`} />
            <Stat label="Allowance" value={`${formatUnits(allowance ?? 0n, assetDecimals)} ${assetSymbol}`} />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {network.address && assetAddress && (
          <DepositCard
            vaultAddress={network.address}
            assetAddress={assetAddress}
            chainId={expectedChainId}
            assetSymbol={assetSymbol || vault.assetSymbol}
            assetDecimals={assetDecimals}
            allowance={allowance}
            refetchAllowance={refetchUser}
            onComplete={refetchAll}
          />
        )}
        {network.address && (
          <WithdrawCard
            vaultAddress={network.address}
            chainId={expectedChainId}
            assetSymbol={assetSymbol || vault.assetSymbol}
            assetDecimals={assetDecimals}
            onComplete={refetchAll}
          />
        )}
      </div>
    </div>
  );
};

const Stat = ({ label, value, loading }: { label: string; value: string; loading?: boolean }) => (
  <div className="flex justify-between">
    <span className="text-base-content/60">{label}</span>
    <span className="font-medium">{loading ? "Loading..." : value}</span>
  </div>
);

export default VaultPage;
