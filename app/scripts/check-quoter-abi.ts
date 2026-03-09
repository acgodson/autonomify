import "dotenv/config"
import { db } from "../src/lib/db"
import { autonomifiedContracts } from "../src/lib/db/schema"
import { eq } from "drizzle-orm"

async function main() {
  const [contract] = await db
    .select()
    .from(autonomifiedContracts)
    .where(eq(autonomifiedContracts.address, "0xc5290058841028f1614f3a6f0f5816cad0df5e27"))

  if (!contract) {
    console.log("Contract not found")
    return
  }

  const abi = contract.abi as any[]
  console.log("Total ABI entries:", abi.length)

  // Find all functions with tuple inputs
  const tupleFns = abi.filter(
    (f) =>
      f.type === "function" &&
      f.inputs?.some((i: any) => i.type === "tuple" || i.type?.includes("tuple"))
  )
  console.log("\nFunctions with tuple inputs:")
  tupleFns.forEach((fn) => {
    console.log("- " + fn.name)
    fn.inputs.forEach((i: any) => {
      const hasComponents = i.components && i.components.length > 0
      console.log(`  Input: ${i.name} ${i.type} ${hasComponents ? "(has components)" : "(NO components!)"}`)
      if (hasComponents) {
        i.components.forEach((c: any) => {
          console.log(`    - ${c.name}: ${c.type}`)
        })
      }
    })
  })

  process.exit(0)
}
main()
