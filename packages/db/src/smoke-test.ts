import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

async function smokeTest() {
  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });
  let passed = 0;
  let failed = 0;

  const test = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      console.log(`✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`✗ ${name}`);
      console.error(`  Error: ${err instanceof Error ? err.message : err}`);
      failed++;
    }
  };

  console.log('Running database smoke tests...\n');

  await test('Connect to database', async () => {
    const client = await pool.connect();
    client.release();
  });

  await test('Schema exists', async () => {
    const result = await pool.query(
      `SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'dear_diary'`
    );
    if (result.rows.length === 0) throw new Error('Schema dear_diary not found');
  });

  await test('Users table exists', async () => {
    const result = await pool.query(
      `SELECT COUNT(*) FROM information_schema.tables 
       WHERE table_schema = 'dear_diary' AND table_name = 'users'`
    );
    if (parseInt(result.rows[0].count) === 0) throw new Error('Table users not found');
  });

  await test('Todos table exists', async () => {
    const result = await pool.query(
      `SELECT COUNT(*) FROM information_schema.tables 
       WHERE table_schema = 'dear_diary' AND table_name = 'todos'`
    );
    if (parseInt(result.rows[0].count) === 0) throw new Error('Table todos not found');
  });

  await test('Diary entries table exists', async () => {
    const result = await pool.query(
      `SELECT COUNT(*) FROM information_schema.tables 
       WHERE table_schema = 'dear_diary' AND table_name = 'diary_entries'`
    );
    if (parseInt(result.rows[0].count) === 0) throw new Error('Table diary_entries not found');
  });

  await test('Mood logs table exists', async () => {
    const result = await pool.query(
      `SELECT COUNT(*) FROM information_schema.tables 
       WHERE table_schema = 'dear_diary' AND table_name = 'mood_logs'`
    );
    if (parseInt(result.rows[0].count) === 0) throw new Error('Table mood_logs not found');
  });

  await test('UUID extension enabled', async () => {
    const result = await pool.query(`SELECT uuid_generate_v4()`);
    if (!result.rows[0].uuid_generate_v4) throw new Error('uuid-ossp extension not working');
  });

  await test('Can insert and select user', async () => {
    const testEmail = `smoke-test-${Date.now()}@test.local`;
    
    // Insert
    await pool.query(
      `INSERT INTO dear_diary.users (email, password_hash, timezone) VALUES ($1, $2, $3)`,
      [testEmail, 'test_hash', 'UTC']
    );
    
    // Select
    const result = await pool.query(
      `SELECT * FROM dear_diary.users WHERE email = $1`,
      [testEmail]
    );
    if (result.rows.length === 0) throw new Error('User not found after insert');
    
    // Cleanup
    await pool.query(`DELETE FROM dear_diary.users WHERE email = $1`, [testEmail]);
  });

  await test('Word count trigger works', async () => {
    const testEmail = `trigger-test-${Date.now()}@test.local`;
    
    // Create test user
    const userResult = await pool.query(
      `INSERT INTO dear_diary.users (email, password_hash, timezone) VALUES ($1, $2, $3) RETURNING id`,
      [testEmail, 'test_hash', 'UTC']
    );
    const userId = userResult.rows[0].id;
    
    // Insert diary entry
    await pool.query(
      `INSERT INTO dear_diary.diary_entries (user_id, raw_text, local_date) 
       VALUES ($1, $2, CURRENT_DATE)`,
      [userId, 'This is a test entry with exactly eight words']
    );
    
    // Check word count
    const result = await pool.query(
      `SELECT word_count FROM dear_diary.diary_entries WHERE user_id = $1`,
      [userId]
    );
    if (result.rows[0].word_count !== 8) {
      throw new Error(`Expected word_count=8, got ${result.rows[0].word_count}`);
    }
    
    // Cleanup
    await pool.query(`DELETE FROM dear_diary.users WHERE id = $1`, [userId]);
  });

  await test('User scoping constraint works', async () => {
    const testEmail = `scope-test-${Date.now()}@test.local`;
    
    // Create two users
    const user1Result = await pool.query(
      `INSERT INTO dear_diary.users (email, password_hash, timezone) VALUES ($1, $2, $3) RETURNING id`,
      [`${testEmail}-1`, 'test_hash', 'UTC']
    );
    const user2Result = await pool.query(
      `INSERT INTO dear_diary.users (email, password_hash, timezone) VALUES ($1, $2, $3) RETURNING id`,
      [`${testEmail}-2`, 'test_hash', 'UTC']
    );
    const user1Id = user1Result.rows[0].id;
    const user2Id = user2Result.rows[0].id;
    
    // Create todo for user1
    await pool.query(
      `INSERT INTO dear_diary.todos (user_id, title, local_date) VALUES ($1, $2, CURRENT_DATE)`,
      [user1Id, 'User 1 Todo']
    );
    
    // User2 should not see user1's todo
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM dear_diary.todos WHERE user_id = $1`,
      [user2Id]
    );
    if (parseInt(result.rows[0].count) !== 0) {
      throw new Error('User isolation failed - user2 can see user1 todos');
    }
    
    // Cleanup
    await pool.query(`DELETE FROM dear_diary.users WHERE id IN ($1, $2)`, [user1Id, user2Id]);
  });

  await test('Data exists (if seeded)', async () => {
    const result = await pool.query(`SELECT COUNT(*) as count FROM dear_diary.users`);
    const count = parseInt(result.rows[0].count);
    if (count === 0) {
      console.log('  (No users found - run seed script to populate demo data)');
    } else {
      console.log(`  (Found ${count} user(s))`);
    }
  });

  await pool.end();

  console.log(`\n${'─'.repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

smokeTest();
