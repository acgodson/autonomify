import "dotenv/config"
import { db, delegations } from "../src/lib/db"
import { eq } from "drizzle-orm"

async function main() {
  const result = await db.select().from(delegations).where(eq(delegations.userAddress, '0x16e0e7141261bbf34b4707ced40ef0bb2f2a3720'))
  console.log(JSON.stringify(result, null, 2))
  process.exit(0)
}
main()
