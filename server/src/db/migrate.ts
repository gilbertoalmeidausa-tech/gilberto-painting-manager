import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { resolve } from 'path'
import { config } from 'dotenv'

config({ path: resolve(__dirname, '../../../.env'), override: false })

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

async function runMigrations() {
  const client = postgres(DATABASE_URL!, { max: 1 })
  const db = drizzle(client)

  console.log('Running migrations...')
  await migrate(db, { migrationsFolder: resolve(__dirname, '../../drizzle') })
  console.log('✅  Migrations complete.')

  await client.end()
}

runMigrations().catch((err: Error) => {
  console.error('❌  Migration failed:', err.message)
  process.exit(1)
})
