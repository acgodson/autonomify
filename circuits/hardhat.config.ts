import * as dotenv from "dotenv";
dotenv.config({ path: "../autonomify-app/.env" });
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-noir";
import { HardhatUserConfig } from "hardhat/config";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.29",
    settings: { optimizer: { enabled: true, runs: 100000000 } },
  },
  networks: {
    sepolia: {
      url: "https://rpc.sepolia.org",
      accounts: [process.env.DEPLOYER_PRIVATE_KEY!],
    },
  },
  noir: {
    version: "1.0.0-beta.11",
    skipNargoWorkspaceCheck: true
  },
};

export default config;
