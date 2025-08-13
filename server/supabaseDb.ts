import { createClient } from '@supabase/supabase-js';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from "@shared/schema";

// Validate environment variables
if (!process.env.SUPABASE_URL) {
  throw new Error("SUPABASE_URL must be set. Please check your .env file.");
}

if (!process.env.SUPABASE_SERVICE_KEY) {
  throw new Error("SUPABASE_SERVICE_KEY must be set. Please check your .env file.");
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a Supabase database?");
}

// Create Supabase client for auth and realtime features
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Create postgres connection for Drizzle ORM
const connectionString = process.env.DATABASE_URL;
const sql = postgres(connectionString, { 
  max: 1,
  ssl: 'require'
});

// Create Drizzle instance
export const db = drizzle(sql, { schema });

// Export a function to close the connection gracefully
export const closeConnection = async () => {
  await sql.end();
};