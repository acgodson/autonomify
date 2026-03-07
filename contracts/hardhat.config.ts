import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config({ path: "../app/.env" });

const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001";
const BSCSCAN_API_KEY = process.env.BSCSCAN_API_KEY || "";
const TENDERLY_VIRTUAL_TESTNET_RPC = process.env.TENDERLY_VIRTUAL_TESTNET_RPC || "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.27",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    sepolia: {
      url: "https://rpc.sepolia.org",
      chainId: 11155111,
      accounts: [PRIVATE_KEY],
    },
    baseSepolia: {
      url: "https://sepolia.base.org",
      chainId: 84532,
      accounts: [PRIVATE_KEY],
    },
    bscTestnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
      accounts: [PRIVATE_KEY],
    },
    bscMainnet: {
      url: "https://bsc-dataseed.binance.org/",
      chainId: 56,
      accounts: [PRIVATE_KEY],
    },
    // Tenderly Virtual TestNet - forked from Base Sepolia with real protocol state
    tenderlyVirtual: {
      url: TENDERLY_VIRTUAL_TESTNET_RPC,
      chainId: 99984532,
      accounts: [PRIVATE_KEY],
    },
  },
  paths: {
    root: "..",
    sources: "./contracts/src",
    tests: "./contracts/test",
    cache: "./contracts/cache",
    artifacts: "./contracts/artifacts",
  },
  etherscan: {
    apiKey: {
      bscTestnet: BSCSCAN_API_KEY,
      bsc: BSCSCAN_API_KEY,
    },
  },
};

export default config;
