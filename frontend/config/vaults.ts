import { base, baseSepolia } from "viem/chains";

type HexAddress = `0x${string}`;

export type VaultNetworkConfig = {
  chainId: number;
  chainName: string;
  address?: HexAddress;
};

export type VaultConfig = {
  id: string;
  name: string;
  symbol: string;
  assetSymbol: string;
  performanceFeeBps: number;
  networks: VaultNetworkConfig[];
};

const maybeAddress = (value?: string | null): HexAddress | undefined =>
  value && value.startsWith("0x") && value.length === 42 ? (value as HexAddress) : undefined;

const defaultVaultAddress = maybeAddress(process.env.NEXT_PUBLIC_DEFAULT_VAULT_ADDRESS);
const defaultVaultSepoliaAddress = maybeAddress(process.env.NEXT_PUBLIC_DEFAULT_VAULT_SEPOLIA_ADDRESS);

export const VAULTS: VaultConfig[] = [
  {
    id: "usdt-euler",
    name: "USDT Euler Earn Vault",
    symbol: "tvUSDT",
    assetSymbol: "USDT",
    performanceFeeBps: 1_000,
    networks: [
      {
        chainId: baseSepolia.id,
        chainName: baseSepolia.name,
        address: defaultVaultSepoliaAddress,
      },
      {
        chainId: base.id,
        chainName: base.name,
        address: defaultVaultAddress,
      },
    ],
  },
];

export const getVaultByChain = (chainId: number) =>
  VAULTS.map((vault) => ({
    ...vault,
    networks: vault.networks.filter((network) => network.chainId === chainId && network.address),
  })).filter((vault) => vault.networks.length > 0);
