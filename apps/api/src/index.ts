import 'dotenv/config';
import { buildServer } from './server.js';
import { createPool } from './db/pool.js';

const PORT = parseInt(process.env['API_PORT'] || '3001', 10);
const HOST = process.env['API_HOST'] || '0.0.0.0';

async function main() {
  // Create database pool
  const pool = createPool();

  // Verify database connection
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    console.log('✓ Database connection verified');
  } catch (err) {
    console.error('✗ Failed to connect to database:', err);
    process.exit(1);
  }

  // Build and start server
  const server = await buildServer({ pool });

  try {
    await server.listen({ port: PORT, host: HOST });
    console.log(`✓ Server listening on http://${HOST}:${PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received, shutting down...`);
    await server.close();
    await pool.end();
    console.log('Server closed');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
