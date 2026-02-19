#!/usr/bin/env node

/**
 * create-autonomify CLI
 *
 * Scaffolds a new Autonomify agent project with your choice of:
 * - Vercel AI SDK
 * - OpenAI SDK
 *
 * Usage:
 *   npx create-autonomify
 *   npx create-autonomify --agent <agentId>
 *   npx create-autonomify my-agent --template vercel-ai
 */

import { program } from "commander"
import prompts from "prompts"
import chalk from "chalk"
import ora from "ora"
import fs from "fs/promises"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

interface AutonomifyConfig {
  version: string
  agentId?: string
  agentName?: string
  chain: {
    id: number
    name: string
    rpc: string
  }
  contracts: Record<string, unknown>
}

const AUTONOMIFY_API = process.env.AUTONOMIFY_API || "https://autonomify.dev"

const BANNER = `
${chalk.hex("#f59e0b")("╔═══════════════════════════════════════════════════════════╗")}
${chalk.hex("#f59e0b")("║")}                                                           ${chalk.hex("#f59e0b")("║")}
${chalk.hex("#f59e0b")("║")}   ${chalk.bold.white("⚡ AUTONOMIFY")}                                           ${chalk.hex("#f59e0b")("║")}
${chalk.hex("#f59e0b")("║")}   ${chalk.gray("Turn any contract into an AI agent")}                     ${chalk.hex("#f59e0b")("║")}
${chalk.hex("#f59e0b")("║")}                                                           ${chalk.hex("#f59e0b")("║")}
${chalk.hex("#f59e0b")("╚═══════════════════════════════════════════════════════════╝")}
`

const TEMPLATES = {
  "vercel-ai": {
    name: "Vercel AI SDK",
    description: "Modern AI SDK with streaming support",
    color: "#000000",
  },
  openai: {
    name: "OpenAI SDK",
    description: "Direct OpenAI API integration",
    color: "#10a37f",
  },
} as const

type TemplateKey = keyof typeof TEMPLATES

async function fetchAgentConfig(agentId: string): Promise<AutonomifyConfig | null> {
  try {
    const response = await fetch(`${AUTONOMIFY_API}/api/agents/${agentId}/export`)
    const json = await response.json() as { ok?: boolean; data?: AutonomifyConfig }
    if (json.ok && json.data) {
      return json.data
    }
    return null
  } catch {
    return null
  }
}

async function copyTemplate(
  templateName: TemplateKey,
  destDir: string,
  config: AutonomifyConfig | null,
  projectName: string
): Promise<void> {
  const templateDir = path.join(__dirname, "templates", templateName)

  // Check if template exists and has files
  let useEmbedded = false
  try {
    const files = await fs.readdir(templateDir)
    if (files.length === 0) {
      useEmbedded = true
    }
  } catch {
    useEmbedded = true
  }

  if (useEmbedded) {
    // Template doesn't exist or is empty, create from embedded content
    await createTemplateFromEmbedded(templateName, destDir, config, projectName)
    return
  }

  // Copy template files
  await copyDir(templateDir, destDir)

  // Replace placeholders in files
  await replaceInFiles(destDir, {
    "{{PROJECT_NAME}}": projectName,
    "{{AGENT_ID}}": config?.agentId || "0x" + "0".repeat(64),
    "{{AGENT_NAME}}": config?.agentName || projectName,
    "{{CHAIN_NAME}}": config?.chain?.name || "BSC Testnet",
    "{{CHAIN_ID}}": String(config?.chain?.id || 97),
  })

  // Write config file if we have agent data
  if (config) {
    await fs.writeFile(
      path.join(destDir, "autonomify.json"),
      JSON.stringify(config, null, 2)
    )
  }
}

async function copyDir(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true })
  const entries = await fs.readdir(src, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath)
    } else {
      await fs.copyFile(srcPath, destPath)
    }
  }
}

async function replaceInFiles(
  dir: string,
  replacements: Record<string, string>
): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      await replaceInFiles(fullPath, replacements)
    } else if (
      entry.name.endsWith(".ts") ||
      entry.name.endsWith(".tsx") ||
      entry.name.endsWith(".js") ||
      entry.name.endsWith(".json") ||
      entry.name.endsWith(".md")
    ) {
      let content = await fs.readFile(fullPath, "utf-8")
      for (const [key, value] of Object.entries(replacements)) {
        content = content.replaceAll(key, value)
      }
      await fs.writeFile(fullPath, content)
    }
  }
}

async function createTemplateFromEmbedded(
  templateName: TemplateKey,
  destDir: string,
  config: AutonomifyConfig | null,
  projectName: string
): Promise<void> {
  // Resolve to absolute path
  const absoluteDestDir = path.resolve(destDir)
  await fs.mkdir(absoluteDestDir, { recursive: true })

  const agentId = config?.agentId || "0x" + "0".repeat(64)
  const agentName = config?.agentName || projectName
  const chainName = config?.chain?.name || "BSC Testnet"

  // Use just the folder name, not full path
  const folderName = path.basename(absoluteDestDir)

  if (templateName === "vercel-ai") {
    await createVercelAITemplate(absoluteDestDir, folderName, agentId, agentName, chainName, config)
  } else {
    await createOpenAITemplate(absoluteDestDir, folderName, agentId, agentName, chainName, config)
  }
}

async function createVercelAITemplate(
  destDir: string,
  projectName: string,
  agentId: string,
  agentName: string,
  chainName: string,
  config: AutonomifyConfig | null
): Promise<void> {
  try {
    // Ensure destDir exists
    await fs.mkdir(destDir, { recursive: true })

    // package.json
    const pkgJson = {
      name: projectName,
      version: "0.1.0",
      private: true,
      type: "module",
      scripts: {
        dev: "tsx watch src/index.ts",
        start: "tsx src/index.ts",
        build: "tsc",
      },
      dependencies: {
        ai: "^3.4.0",
        "@ai-sdk/openai": "^0.0.70",
        "autonomify-sdk": "^0.1.0",
        viem: "^2.21.0",
        dotenv: "^16.4.0",
      },
      devDependencies: {
        "@types/node": "^22.0.0",
        tsx: "^4.19.0",
        typescript: "^5.6.0",
      },
    }
    await fs.writeFile(path.join(destDir, "package.json"), JSON.stringify(pkgJson, null, 2))

  // tsconfig.json
  await fs.writeFile(
    path.join(destDir, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "ESNext",
          moduleResolution: "bundler",
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          outDir: "./dist",
          rootDir: "./src",
          resolveJsonModule: true,
        },
        include: ["src/**/*", "autonomify.json"],
        exclude: ["node_modules"],
      },
      null,
      2
    )
  )

  // .env.example
  await fs.writeFile(
    path.join(destDir, ".env.example"),
    `# OpenAI API Key
OPENAI_API_KEY=sk-...

# Your wallet private key (for signing transactions)
# WARNING: Never commit this file with real keys!
PRIVATE_KEY=0x...
`
  )

  // .gitignore
  await fs.writeFile(
    path.join(destDir, ".gitignore"),
    `node_modules/
dist/
.env
.env.local
`
  )

  // README.md
  await fs.writeFile(
    path.join(destDir, "README.md"),
    `# ${agentName}

An AI agent powered by [Autonomify](https://autonomify.vercel.app) for ${chainName}.

## Setup

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Copy \`.env.example\` to \`.env\` and add your keys:
   \`\`\`bash
   cp .env.example .env
   \`\`\`

3. Run the agent:
   \`\`\`bash
   npm run dev
   \`\`\`

## Agent ID

\`\`\`
${agentId}
\`\`\`

## Available Contracts

${config ? Object.entries(config.contracts).map(([addr, c]: [string, any]) => `- **${c.name}** (\`${addr}\`)`).join("\n") : "No contracts configured yet."}

## How It Works

This agent uses the Autonomify SDK to:
1. Parse your natural language commands
2. Identify the correct contract and function
3. Encode the transaction
4. Sign and submit via your wallet

All transactions go through the Autonomify Executor for audit trails.
`
  )

  // src/index.ts
  await fs.mkdir(path.join(destDir, "src"), { recursive: true })
  await fs.writeFile(
    path.join(destDir, "src/index.ts"),
    `/**
 * ${agentName}
 *
 * Autonomify AI Agent for ${chainName}
 * Generated by create-autonomify
 */

import "dotenv/config"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import { createWalletClient, http } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { bscTestnet } from "viem/chains"
import {
  createAutonomifyTool,
  buildSystemPrompt,
  type AutonomifyExport,
  type UnsignedTransaction,
} from "autonomify-sdk"

// Load your agent configuration
import config from "../autonomify.json" assert { type: "json" }

const AGENT_ID = "${agentId}" as \`0x\${string}\`

async function main() {
  // Validate environment
  if (!process.env.OPENAI_API_KEY) {
    console.error("Missing OPENAI_API_KEY in environment")
    process.exit(1)
  }

  if (!process.env.PRIVATE_KEY) {
    console.error("Missing PRIVATE_KEY in environment")
    process.exit(1)
  }

  // Setup wallet
  const account = privateKeyToAccount(process.env.PRIVATE_KEY as \`0x\${string}\`)
  const walletClient = createWalletClient({
    account,
    chain: bscTestnet,
    transport: http(),
  })

  console.log("\\n⚡ ${agentName} started")
  console.log(\`   Wallet: \${account.address}\`)
  console.log(\`   Chain: ${chainName}\\n\`)

  // Create the signing function
  const signAndSend = async (tx: UnsignedTransaction): Promise<string> => {
    const hash = await walletClient.sendTransaction({
      to: tx.to,
      data: tx.data,
      value: tx.value,
    })
    return hash
  }

  // Create the Autonomify tool
  const autonomifyTool = createAutonomifyTool({
    export: config as AutonomifyExport,
    agentId: AGENT_ID,
    signAndSend,
  })

  // Example: Run a single command
  const userMessage = process.argv[2] || "What contracts are available?"

  console.log(\`User: \${userMessage}\\n\`)

  const { text, toolCalls } = await generateText({
    model: openai("gpt-4o"),
    system: buildSystemPrompt(config as AutonomifyExport),
    prompt: userMessage,
    tools: {
      autonomify_execute: autonomifyTool,
    },
    maxSteps: 5,
  })

  console.log(\`Agent: \${text}\`)

  if (toolCalls && toolCalls.length > 0) {
    console.log("\\nTool calls made:")
    for (const call of toolCalls) {
      console.log(\`  - \${call.toolName}(\${JSON.stringify(call.args)})\`)
    }
  }
}

main().catch(console.error)
`
  )

  // Write config if available
  if (config) {
    await fs.writeFile(
      path.join(destDir, "autonomify.json"),
      JSON.stringify(config, null, 2)
    )
  } else {
    // Write placeholder config
    await fs.writeFile(
      path.join(destDir, "autonomify.json"),
      JSON.stringify(
        {
          version: "1.0",
          executor: {
            address: "0xC62AeB774DF09a6C2554dC19f221BDc4DFfAD93C",
            abi: [],
          },
          chain: {
            id: 97,
            name: "BSC Testnet",
            rpc: "https://data-seed-prebsc-1-s1.binance.org:8545",
          },
          contracts: {},
          agentId: agentId,
          agentName: agentName,
        },
        null,
        2
      )
    )
  }
  } catch (err) {
    throw new Error(`Failed to create Vercel AI template: ${err instanceof Error ? err.message : String(err)}`)
  }
}

async function createOpenAITemplate(
  destDir: string,
  projectName: string,
  agentId: string,
  agentName: string,
  chainName: string,
  config: AutonomifyConfig | null
): Promise<void> {
  // Ensure destDir exists
  await fs.mkdir(destDir, { recursive: true })

  // package.json
  await fs.writeFile(
    path.join(destDir, "package.json"),
    JSON.stringify(
      {
        name: projectName,
        version: "0.1.0",
        private: true,
        type: "module",
        scripts: {
          dev: "tsx watch src/index.ts",
          start: "tsx src/index.ts",
          build: "tsc",
        },
        dependencies: {
          openai: "^4.70.0",
          "autonomify-sdk": "^0.1.0",
          viem: "^2.21.0",
          dotenv: "^16.4.0",
        },
        devDependencies: {
          "@types/node": "^22.0.0",
          tsx: "^4.19.0",
          typescript: "^5.6.0",
        },
      },
      null,
      2
    )
  )

  // tsconfig.json
  await fs.writeFile(
    path.join(destDir, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "ESNext",
          moduleResolution: "bundler",
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          outDir: "./dist",
          rootDir: "./src",
          resolveJsonModule: true,
        },
        include: ["src/**/*", "autonomify.json"],
        exclude: ["node_modules"],
      },
      null,
      2
    )
  )

  // .env.example
  await fs.writeFile(
    path.join(destDir, ".env.example"),
    `# OpenAI API Key
OPENAI_API_KEY=sk-...

# Your wallet private key (for signing transactions)
# WARNING: Never commit this file with real keys!
PRIVATE_KEY=0x...
`
  )

  // .gitignore
  await fs.writeFile(
    path.join(destDir, ".gitignore"),
    `node_modules/
dist/
.env
.env.local
`
  )

  // README.md
  await fs.writeFile(
    path.join(destDir, "README.md"),
    `# ${agentName}

An AI agent powered by [Autonomify](https://autonomify.vercel.app) for ${chainName}.

## Setup

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Copy \`.env.example\` to \`.env\` and add your keys:
   \`\`\`bash
   cp .env.example .env
   \`\`\`

3. Run the agent:
   \`\`\`bash
   npm run dev
   \`\`\`

## Agent ID

\`\`\`
${agentId}
\`\`\`

## Available Contracts

${config ? Object.entries(config.contracts).map(([addr, c]: [string, any]) => `- **${c.name}** (\`${addr}\`)`).join("\n") : "No contracts configured yet."}
`
  )

  // src/index.ts
  await fs.mkdir(path.join(destDir, "src"), { recursive: true })
  await fs.writeFile(
    path.join(destDir, "src/index.ts"),
    `/**
 * ${agentName}
 *
 * Autonomify AI Agent for ${chainName}
 * Generated by create-autonomify
 */

import "dotenv/config"
import OpenAI from "openai"
import { createWalletClient, http } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { bscTestnet } from "viem/chains"
import {
  createOpenAITool,
  buildSystemPrompt,
  type AutonomifyExport,
  type UnsignedTransaction,
} from "autonomify-sdk"

// Load your agent configuration
import config from "../autonomify.json" assert { type: "json" }

const AGENT_ID = "${agentId}" as \`0x\${string}\`

async function main() {
  // Validate environment
  if (!process.env.OPENAI_API_KEY) {
    console.error("Missing OPENAI_API_KEY in environment")
    process.exit(1)
  }

  if (!process.env.PRIVATE_KEY) {
    console.error("Missing PRIVATE_KEY in environment")
    process.exit(1)
  }

  const openai = new OpenAI()

  // Setup wallet
  const account = privateKeyToAccount(process.env.PRIVATE_KEY as \`0x\${string}\`)
  const walletClient = createWalletClient({
    account,
    chain: bscTestnet,
    transport: http(),
  })

  console.log("\\n⚡ ${agentName} started")
  console.log(\`   Wallet: \${account.address}\`)
  console.log(\`   Chain: ${chainName}\\n\`)

  // Create the signing function
  const signAndSend = async (tx: UnsignedTransaction): Promise<string> => {
    const hash = await walletClient.sendTransaction({
      to: tx.to,
      data: tx.data,
      value: tx.value,
    })
    return hash
  }

  // Create the OpenAI-compatible tool
  const { tools, handler } = createOpenAITool({
    export: config as AutonomifyExport,
    agentId: AGENT_ID,
    signAndSend,
  })

  // Example: Run a single command
  const userMessage = process.argv[2] || "What contracts are available?"

  console.log(\`User: \${userMessage}\\n\`)

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: buildSystemPrompt(config as AutonomifyExport) },
      { role: "user", content: userMessage },
    ],
    tools,
  })

  const message = response.choices[0].message

  // Handle tool calls if any
  if (message.tool_calls && message.tool_calls.length > 0) {
    console.log("Executing tool calls...")
    for (const toolCall of message.tool_calls) {
      const result = await handler(toolCall)
      console.log(\`  Tool: \${toolCall.function.name}\`)
      console.log(\`  Result: \${JSON.stringify(result)}\\n\`)
    }
  }

  if (message.content) {
    console.log(\`Agent: \${message.content}\`)
  }
}

main().catch(console.error)
`
  )

  // Write config if available
  if (config) {
    await fs.writeFile(
      path.join(destDir, "autonomify.json"),
      JSON.stringify(config, null, 2)
    )
  } else {
    await fs.writeFile(
      path.join(destDir, "autonomify.json"),
      JSON.stringify(
        {
          version: "1.0",
          executor: {
            address: "0xC62AeB774DF09a6C2554dC19f221BDc4DFfAD93C",
            abi: [],
          },
          chain: {
            id: 97,
            name: "BSC Testnet",
            rpc: "https://data-seed-prebsc-1-s1.binance.org:8545",
          },
          contracts: {},
          agentId: agentId,
          agentName: agentName,
        },
        null,
        2
      )
    )
  }
}

async function run() {
  console.log(BANNER)

  program
    .name("create-autonomify")
    .description("Scaffold an Autonomify AI agent project")
    .version("0.1.0")
    .argument("[project-name]", "Name of the project directory")
    .option("-a, --agent <id>", "Agent ID to fetch configuration for")
    .option("-t, --template <template>", "Template to use (vercel-ai or openai)")
    .option("--api <url>", "Autonomify API URL", AUTONOMIFY_API)
    .action(async (projectNameArg, options) => {
      let projectName = projectNameArg
      let template: TemplateKey | undefined = options.template
      let agentId: string | undefined = options.agent
      let config: AutonomifyConfig | null = null

      // Interactive prompts if not provided
      if (!projectName) {
        const response = await prompts({
          type: "text",
          name: "projectName",
          message: "Project name:",
          initial: "my-autonomify-agent",
        })
        projectName = response.projectName
        if (!projectName) {
          console.log(chalk.red("Project name is required"))
          process.exit(1)
        }
      }

      // Ask for agent ID if not provided (unless --no-agent flag used)
      const skipAgent = agentId === "skip" || agentId === "none" || agentId === ""
      if (!agentId && agentId !== "") {
        const response = await prompts({
          type: "text",
          name: "agentId",
          message: "Agent ID (from Autonomify dashboard, or press enter to skip):",
        })
        agentId = response.agentId
      }

      // Fetch agent config if we have a valid ID
      if (agentId && !skipAgent) {
        const spinner = ora("Fetching agent configuration...").start()
        config = await fetchAgentConfig(agentId)
        if (config) {
          spinner.succeed(
            `Loaded configuration for ${chalk.cyan(config.agentName || "agent")}`
          )
        } else {
          spinner.warn("Could not fetch agent config, using defaults")
        }
      }

      // Ask for template if not provided
      if (!template) {
        const response = await prompts({
          type: "select",
          name: "template",
          message: "Choose a template:",
          choices: [
            {
              title: `${chalk.bold("Vercel AI SDK")} ${chalk.gray("- Modern AI SDK with streaming")}`,
              value: "vercel-ai",
            },
            {
              title: `${chalk.bold("OpenAI SDK")} ${chalk.gray("- Direct OpenAI integration")}`,
              value: "openai",
            },
          ],
        })
        template = response.template
        if (!template) {
          console.log(chalk.red("Template selection is required"))
          process.exit(1)
        }
      }

      // Validate template
      if (!TEMPLATES[template]) {
        console.log(chalk.red(`Invalid template: ${template}`))
        console.log(chalk.gray(`Available: ${Object.keys(TEMPLATES).join(", ")}`))
        process.exit(1)
      }

      const destDir = path.resolve(process.cwd(), projectName)

      // Check if directory exists
      try {
        await fs.access(destDir)
        const response = await prompts({
          type: "confirm",
          name: "overwrite",
          message: `Directory ${projectName} already exists. Overwrite?`,
          initial: false,
        })
        if (!response.overwrite) {
          console.log(chalk.yellow("Cancelled"))
          process.exit(0)
        }
        await fs.rm(destDir, { recursive: true })
      } catch {
        // Directory doesn't exist, which is good
      }

      // Create project
      const spinner = ora(
        `Creating ${chalk.cyan(projectName)} with ${TEMPLATES[template].name}...`
      ).start()

      try {
        await copyTemplate(template, destDir, config, projectName)

        // Verify files were created
        const files = await fs.readdir(destDir)
        if (files.length === 0) {
          throw new Error("No files were created in the destination directory")
        }

        spinner.succeed(`Created ${chalk.cyan(projectName)}`)
      } catch (error) {
        spinner.fail("Failed to create project")
        console.error(error)
        process.exit(1)
      }

      // Success message
      console.log()
      console.log(chalk.green("✨ Project created successfully!"))
      console.log()
      console.log("Next steps:")
      console.log(chalk.cyan(`  cd ${projectName}`))
      console.log(chalk.cyan("  npm install"))
      console.log(chalk.cyan("  cp .env.example .env"))
      console.log(chalk.gray("  # Add your OPENAI_API_KEY and PRIVATE_KEY"))
      console.log(chalk.cyan("  npm run dev"))
      console.log()

      if (config) {
        console.log(chalk.gray("Agent configuration loaded from Autonomify:"))
        console.log(chalk.gray(`  Agent: ${config.agentName}`))
        console.log(chalk.gray(`  Chain: ${config.chain.name}`))
        console.log(
          chalk.gray(`  Contracts: ${Object.keys(config.contracts).length}`)
        )
        console.log()
      }
    })

  await program.parseAsync()
}

run().catch(console.error)
