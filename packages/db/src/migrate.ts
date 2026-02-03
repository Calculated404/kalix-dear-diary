import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    console.log('Running migrations...');

    // Read and execute schema file
    const schemaPath = path.join(__dirname, '..', 'init', '01-schema.sql');
    
    if (!fs.existsSync(schemaPath)) {
      console.error(`Schema file not found: ${schemaPath}`);
      process.exit(1);
    }

    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    
    await pool.query(schemaSql);
    
    console.log('✓ Schema migration completed');

  } catch (err: unknown) {
    const pgErr = err as { code?: string; message?: string };
    if (pgErr?.code === '3D000') {
      console.error('Migration error: database does not exist.');
      console.error('Check your .env: DATABASE_URL must use an existing database and the correct port.');
      console.error('  - Database name should be "kalix_diary" (see .env.example).');
      console.error('  - Use the same port you use with psql (e.g. if you use psql -p 5432, set DATABASE_URL with :5432/).');
      console.error('  - If using docker-compose, use POSTGRES_PORT in the URL (e.g. localhost:5433).');
    } else {
      console.error('Migration error:', err);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
