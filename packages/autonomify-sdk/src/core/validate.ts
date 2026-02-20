import { getAddress } from "viem"
import type { AutonomifyExport, StructuredCall, FunctionExport } from "../types"
import { findFunction } from "./utils"

export interface ValidationError {
  field: string
  message: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  function?: FunctionExport
}

function isValidAddress(address: string): boolean {
  try {
    getAddress(address)
    return true
  } catch {
    return false
  }
}

function validateType(value: unknown, type: string, paramName: string): ValidationError | null {
  if (type.endsWith("[]")) {
    if (!Array.isArray(value)) {
      return { field: paramName, message: `Expected array for ${type}` }
    }
    const baseType = type.slice(0, -2)
    for (let i = 0; i < value.length; i++) {
      const err = validateType(value[i], baseType, `${paramName}[${i}]`)
      if (err) return err
    }
    return null
  }

  if (type === "address") {
    if (typeof value !== "string" || !isValidAddress(value)) {
      return { field: paramName, message: `Invalid address format` }
    }
    return null
  }

  if (type.startsWith("uint") || type.startsWith("int")) {
    if (typeof value !== "string" || !/^\d+$/.test(value)) {
      return { field: paramName, message: `Expected numeric string for ${type}` }
    }
    return null
  }

  if (type === "bool") {
    if (typeof value !== "boolean") {
      return { field: paramName, message: `Expected boolean` }
    }
    return null
  }

  if (type.startsWith("bytes")) {
    if (typeof value !== "string" || !/^0x[a-fA-F0-9]*$/.test(value)) {
      return { field: paramName, message: `Expected hex string for ${type}` }
    }
    return null
  }

  if (type === "string") {
    if (typeof value !== "string") {
      return { field: paramName, message: `Expected string` }
    }
    return null
  }

  return null
}

export function validateCall(
  call: StructuredCall,
  exportData: AutonomifyExport
): ValidationResult {
  const errors: ValidationError[] = []

  if (!call.contractAddress) {
    errors.push({ field: "contractAddress", message: "Contract address is required" })
    return { valid: false, errors }
  }

  if (!isValidAddress(call.contractAddress)) {
    errors.push({ field: "contractAddress", message: "Invalid contract address format" })
    return { valid: false, errors }
  }

  if (!call.functionName) {
    errors.push({ field: "functionName", message: "Function name is required" })
    return { valid: false, errors }
  }

  let normalizedAddress: `0x${string}`
  try {
    normalizedAddress = getAddress(call.contractAddress) as `0x${string}`
  } catch {
    errors.push({ field: "contractAddress", message: "Invalid contract address" })
    return { valid: false, errors }
  }

  const found = findFunction(exportData, normalizedAddress, call.functionName)

  if (!found) {
    const contract = exportData.contracts[normalizedAddress]
    if (!contract) {
      errors.push({
        field: "contractAddress",
        message: `Contract ${normalizedAddress} not found in export`,
      })
    } else {
      errors.push({
        field: "functionName",
        message: `Function "${call.functionName}" not found on ${contract.name}`,
      })
    }
    return { valid: false, errors }
  }

  const fn = found.fn

  for (const input of fn.inputs) {
    const paramName = input.name || `arg${fn.inputs.indexOf(input)}`
    const value = call.args[paramName]

    if (value === undefined) {
      errors.push({
        field: `args.${paramName}`,
        message: `Missing required argument "${paramName}" (${input.type})`,
      })
      continue
    }

    const typeError = validateType(value, input.type, `args.${paramName}`)
    if (typeError) {
      errors.push(typeError)
    }
  }

  const expectedParams = new Set(fn.inputs.map((i) => i.name || `arg${fn.inputs.indexOf(i)}`))
  for (const key of Object.keys(call.args)) {
    if (!expectedParams.has(key)) {
      errors.push({
        field: `args.${key}`,
        message: `Unexpected argument "${key}"`,
      })
    }
  }

  if (call.value !== undefined) {
    if (fn.stateMutability !== "payable") {
      errors.push({
        field: "value",
        message: `Function "${fn.name}" is not payable, remove value`,
      })
    } else if (typeof call.value !== "string" || !/^\d*\.?\d+$/.test(call.value)) {
      errors.push({
        field: "value",
        message: "Value must be a numeric string (in native token units)",
      })
    }
  }

  if (fn.stateMutability === "payable" && !call.value) {
    // Not an error, just a note - payable functions can be called with 0 value
  }

  return {
    valid: errors.length === 0,
    errors,
    function: fn,
  }
}
