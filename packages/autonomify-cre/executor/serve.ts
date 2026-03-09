/// <reference types="bun-types" />
/**
 * Local HTTP Server for CRE Workflow
 *
 * Wraps the CRE CLI for local development. Each request spawns a new
 * CRE process in --non-interactive mode.
 *
 * For production, deploy to Chainlink CRE network where it runs persistently.
 */

import { execSync } from "child_process"

const PORT = 8080
const CRE_PATH = process.env.CRE_PATH || "~/bin/cre"

Bun.serve({
  port: PORT,
  async fetch(req: Request) {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      })
    }

    const url = new URL(req.url)
    if (url.pathname !== "/trigger") {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      })
    }

    try {
      const payload = await req.json()
      const payloadStr = JSON.stringify(payload).replace(/'/g, "'\\''")

      console.log(`[${new Date().toISOString()}] Request for: ${payload.userAddress}`)
      console.log(`[${new Date().toISOString()}] Mode: ${payload.simulateOnly ? "SIMULATION" : "EXECUTION"}`)

      const cwd = import.meta.dir
      const cmd = `${CRE_PATH} workflow simulate "${cwd}" -T staging-settings --broadcast -R "${cwd}" --non-interactive --trigger-index 0 --http-payload '${payloadStr}' 2>&1`

      const output = execSync(cmd, {
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024,
        timeout: 180000,
        shell: "/bin/bash",
      })

      // Extract JSON result from CRE output
      const resultMatch = output.match(/✓ Workflow Simulation Result:\s*"(.+)"/s)
      if (resultMatch) {
        const result = JSON.parse(resultMatch[1].replace(/\\"/g, '"'))
        console.log(`[${new Date().toISOString()}] Result: ${result.success ? "SUCCESS" : "FAILED"}`)
        return new Response(JSON.stringify(result, null, 2), {
          headers: { "Content-Type": "application/json" },
        })
      }

      // Check for error in output
      const errorMatch = output.match(/\[USER LOG\].*FAILED: (.+)/m)
      if (errorMatch) {
        return new Response(JSON.stringify({
          success: false,
          error: errorMatch[1]
        }), {
          headers: { "Content-Type": "application/json" },
        })
      }

      return new Response(JSON.stringify({
        success: false,
        error: "Failed to parse CRE output",
        raw: output.slice(-2000)
      }), {
        headers: { "Content-Type": "application/json" },
      })

    } catch (err: any) {
      // execSync throws when exit code != 0, but tx may have succeeded
      const output = err.stdout?.toString() || err.stderr?.toString() || ""

      // Check if transaction actually succeeded despite error
      const txSuccessMatch = output.match(/\[CHAIN\] Transaction status: SUCCESS/)
      const txHashMatch = output.match(/\[CHAIN\] Tx hash: (0x[a-fA-F0-9]{64})/)
      const nullifierMatch = output.match(/Nullifier: (0x[a-fA-F0-9]+)/)

      if (txSuccessMatch && txHashMatch) {
        // Transaction succeeded - return success even if Tenderly verification failed
        console.log(`[${new Date().toISOString()}] TX succeeded despite CRE error: ${txHashMatch[1]}`)
        return new Response(JSON.stringify({
          success: true,
          mode: "execution",
          txStatus: 2,
          txStatusName: "SUCCESS",
          txHash: txHashMatch[1],
          nullifier: nullifierMatch?.[1],
          warning: "Tenderly verification skipped due to rate limit"
        }), {
          headers: { "Content-Type": "application/json" },
        })
      }

      const message = err instanceof Error ? err.message : "Unknown error"
      console.error(`[${new Date().toISOString()}] Error:`, message)
      return new Response(JSON.stringify({
        success: false,
        error: message
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }
  },
})

console.log(`
╔════════════════════════════════════════════════════════════╗
║   Autonomify CRE Local Server                              ║
║   http://localhost:${PORT}/trigger                            ║
║                                                            ║
║   Each request spawns CRE in --non-interactive mode.       ║
║   For production, deploy to Chainlink CRE network.         ║
╚════════════════════════════════════════════════════════════╝
`)
