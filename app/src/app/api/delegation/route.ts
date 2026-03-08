import { NextRequest, NextResponse } from "next/server"
import { getDelegation, saveDelegation } from "@/lib/agent"
import { getExecutorAddress } from "autonomify-sdk"
import { DEFAULT_CHAIN_ID } from "@/lib/chains"

interface CheckResponse {
  hasDelegation: boolean
  executorAddress: string
  signedDelegation?: string
}

export async function GET(request: NextRequest) {
  const userAddress = request.headers.get("x-user-address")

  if (!userAddress) {
    return NextResponse.json(
      { ok: false, error: "Missing user address" },
      { status: 401 }
    )
  }

  const chainId = DEFAULT_CHAIN_ID
  const delegation = await getDelegation(userAddress, chainId)

  const response: CheckResponse = {
    hasDelegation: !!delegation,
    executorAddress: getExecutorAddress(chainId),
    signedDelegation: delegation?.signedDelegation,
  }

  return NextResponse.json({ ok: true, data: response })
}

interface SaveDelegationBody {
  userAddress: string
  delegationHash: string
  signedDelegation: string
  chainId?: number
}

export async function POST(request: NextRequest) {
  let body: SaveDelegationBody

  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    )
  }

  if (!body.userAddress || !body.delegationHash || !body.signedDelegation) {
    return NextResponse.json(
      { ok: false, error: "Missing required fields" },
      { status: 400 }
    )
  }

  const chainId = body.chainId || DEFAULT_CHAIN_ID
  const executorAddress = getExecutorAddress(chainId)

  try {
    await saveDelegation({
      userAddress: body.userAddress,
      delegationHash: body.delegationHash,
      signedDelegation: body.signedDelegation,
      executorAddress,
      chainId,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save delegation"
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    )
  }
}
