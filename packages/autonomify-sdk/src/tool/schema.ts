import { z, type ZodType } from "zod"
import type { FunctionExport, FunctionParam } from "../types"

export function solidityTypeToZod(type: string): ZodType {
  if (type.endsWith("[]")) {
    const baseType = type.slice(0, -2)
    return z.array(solidityTypeToZod(baseType))
  }

  if (type === "address") {
    return z.string().regex(/^0x[a-fA-F0-9]{40}$/)
  }

  if (type.startsWith("uint") || type.startsWith("int")) {
    return z.string().regex(/^\d+$/)
  }

  if (type === "bool") {
    return z.boolean()
  }

  if (type.startsWith("bytes")) {
    return z.string().regex(/^0x[a-fA-F0-9]*$/)
  }

  if (type === "string") {
    return z.string()
  }

  if (type === "tuple" || type.startsWith("tuple")) {
    return z.record(z.unknown())
  }

  return z.unknown()
}

export function buildArgsSchema(inputs: FunctionParam[]): z.ZodObject<Record<string, ZodType>> {
  const shape: Record<string, ZodType> = {}

  for (const input of inputs) {
    const name = input.name || `arg${inputs.indexOf(input)}`
    shape[name] = solidityTypeToZod(input.type)
  }

  return z.object(shape)
}

export function buildCallSchema(fn: FunctionExport, contractAddress: `0x${string}`) {
  const argsSchema = buildArgsSchema(fn.inputs)

  const base = z.object({
    contractAddress: z.literal(contractAddress),
    functionName: z.literal(fn.name),
    args: argsSchema,
  })

  if (fn.stateMutability === "payable") {
    return base.extend({ value: z.string().optional() })
  }

  return base
}

export const executeSchema = z.object({
  contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  functionName: z.string(),
  args: z.record(z.unknown()),
  value: z.string().optional(),
})

export type ExecuteSchema = z.infer<typeof executeSchema>
