import { createPublicClient, http, defineChain } from "viem";
import factoryAbiJson from "../abi/SWL444Factory.json";
import erc20AbiJson from "../abi/ERC20Minimal.json";
import diamondGateAbiJson from "../abi/DiamondHandGate.json";
import swl444TokenAbiJson from "../abi/SWL444Token.json";
import nftMinterAbiJson from "../abi/SWL444NFTMinter.json";

export const SWL444_FACTORY_ABI = factoryAbiJson as const;
export const ERC20_MINIMAL_ABI = erc20AbiJson as const;
export const DIAMOND_GATE_ABI = diamondGateAbiJson as const;
// Living Meme fields (creator/metadataUri/updateMetadataUri/...) not covered
// by the generic ERC20_MINIMAL_ABI — both ABIs target the same token address.
export const SWL444_TOKEN_ABI = swl444TokenAbiJson as const;
export const NFT_MINTER_ABI = nftMinterAbiJson as const;

// Uniswap V2 router/factory are the same fork deployed at the same addresses
// on both networks (see contracts-rh/script/Deploy.s.sol and DeployMainnet.s.sol).
const UNISWAP_V2_ROUTER = "0x89e5DB8B5aA49aA85AC63f691524311AEB649eba" as const;
const UNISWAP_V2_FACTORY = "0x8bcEaA40B9AcdfAedF85AdF4FF01F5Ad6517937f" as const;

function chainIdHex(id: number): `0x${string}` {
  return `0x${id.toString(16)}`;
}

// Factory/gate/nftMinter addresses change every redeploy (fresh factory =
// zero pools) — read them from env so swapping in a new deployment doesn't
// require an edit here.
const MAINNET_CONFIG = {
  chainId: 4663,
  chainIdHex: chainIdHex(4663),
  rpc: "https://rpc.mainnet.chain.robinhood.com",
  explorer: "https://robinhoodchain.blockscout.com",
  chainName: "Robinhood Chain",
  factory: (process.env.NEXT_PUBLIC_RH_MAINNET_FACTORY_ADDRESS ?? "0xAfC073888E781D57720099607479Af505201AA45") as `0x${string}`,
  gate: (process.env.NEXT_PUBLIC_RH_MAINNET_GATE_ADDRESS ?? "0x07D090955a5eb70Ba81c75a65A48DBa64BD01f19") as `0x${string}`,
  nftMinter: (process.env.NEXT_PUBLIC_RH_MAINNET_NFT_MINTER_ADDRESS ?? "0xC7852c96a8CDb7C1bc2a6c03022011a9c68de274") as `0x${string}`,
  uniswapRouter: UNISWAP_V2_ROUTER,
  uniswapFactory: UNISWAP_V2_FACTORY,
  // Mirrors INIT_VIRTUAL_ETH in SWL444Factory.sol (mainnet value — 2.2 ETH
  // graduation raise, 400M/444M BONDING_SUPPLY split, ~102x price
  // multiplier). Keep in sync with the contract constant.
  initVirtualEth: 239_580_000_000_000_000n, // 0.23958 ether
} as const;

const TESTNET_CONFIG = {
  chainId: 46630,
  chainIdHex: chainIdHex(46630),
  rpc: "https://rpc.testnet.chain.robinhood.com",
  explorer: "https://explorer.testnet.chain.robinhood.com",
  chainName: "Robinhood Chain Testnet",
  factory: (process.env.NEXT_PUBLIC_RH_FACTORY_ADDRESS ?? "0xF7c1df930e94eFF20C925Df26757f2cAe9a2C77f") as `0x${string}`,
  gate: (process.env.NEXT_PUBLIC_RH_GATE_ADDRESS ?? "0xB1e7B284A05626795274879fBf54AB7b412580dd") as `0x${string}`,
  nftMinter: (process.env.NEXT_PUBLIC_RH_NFT_MINTER_ADDRESS ?? "0xe3e8076BaF2e2B32FaedA7cE87fC51DE8B082048") as `0x${string}`,
  uniswapRouter: UNISWAP_V2_ROUTER,
  uniswapFactory: UNISWAP_V2_FACTORY,
  // Mirrors INIT_VIRTUAL_ETH in SWL444Factory.sol (testnet value — ~0.01 ETH
  // graduation raise, sized for cheap testing). Keep in sync with the
  // contract constant.
  initVirtualEth: 90_000_000_000_000_000n, // 0.09 ether
} as const;

// Defaults to mainnet unless explicitly opted into testnet — so a deploy
// that forgets to set this env var ships pointed at the real chain, not a
// silently-wrong testnet. Set NEXT_PUBLIC_RH_NETWORK=testnet for local/dev
// work against the testnet deployment.
export const IS_ROBINHOOD_MAINNET = process.env.NEXT_PUBLIC_RH_NETWORK !== "testnet";

export const RH_CONFIG = IS_ROBINHOOD_MAINNET ? MAINNET_CONFIG : TESTNET_CONFIG;

// Mirrors INIT_VIRTUAL_ETH in SWL444Factory.sol for the active network — the
// bonding curve's phantom starting reserve. Keep in sync with the contract
// constant (see RH_CONFIG.initVirtualEth above for both networks' values).
export const INIT_VIRTUAL_ETH = RH_CONFIG.initVirtualEth;

export const robinhoodChain = defineChain({
  id: RH_CONFIG.chainId,
  name: RH_CONFIG.chainName,
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RH_CONFIG.rpc] } },
  blockExplorers: {
    default: { name: "Explorer", url: RH_CONFIG.explorer },
  },
});

export const robinhoodPublicClient = createPublicClient({
  chain: robinhoodChain,
  transport: http(),
  // Robinhood Chain doesn't have a multicall3 contract deployed — viem's
  // default batching tries to use it for any concurrent reads, which throws
  // "does not support contract multicall3". Individual eth_call requests
  // instead.
  batch: { multicall: false },
});

// Graduation is automatic and immediate — bonding sells out and liquidity
// migrates to Uniswap in the same transaction, so there's no internal-AMM
// phase to represent (mirrors PoolPhase in SWL444Factory.sol).
export const POOL_PHASE = ["Bonding", "Graduated"] as const;
export type PoolPhase = (typeof POOL_PHASE)[number];

export const TOTAL_SUPPLY = 444_000_000n * 10n ** 18n;
// Mirrors BONDING_SUPPLY in SWL444Factory.sol — 400M (90%) sold through the
// curve, up from the old 44M (10%), for a ~102x start->graduation price
// multiplier instead of ~1.2x. Keep in sync with the contract constant.
export const BONDING_SUPPLY = 400_000_000n * 10n ** 18n;

// Mirrors LOCK_AMOUNT in SWL444NFTMinter.sol — tokens locked to mint a Living NFT.
export const NFT_LOCK_AMOUNT = 444_000n * 10n ** 18n;
