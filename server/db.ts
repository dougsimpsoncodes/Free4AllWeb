import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const client = new Client({ 
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

await client.connect();
export const db = drizzle(client, { 
  schema,
  logger: true 
});