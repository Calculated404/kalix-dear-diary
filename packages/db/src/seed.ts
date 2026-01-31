import 'dotenv/config';
import pg from 'pg';
import crypto from 'crypto';

const { Pool } = pg;

// Seed configuration
const SEED_CONFIG = {
  daysOfData: 90, // Generate 90 days of data
  todosPerDay: { min: 0, max: 5 },
  completionRate: 0.7, // 70% of todos get completed
  diaryEntriesPerDay: { min: 0, max: 2 },
  moodLogsPerDay: { min: 0, max: 3 },
};

// Sample data
const TODO_TITLES = [
  'Review project requirements',
  'Write unit tests',
  'Update documentation',
  'Fix bug in authentication',
  'Deploy to staging',
  'Code review for PR #42',
  'Schedule team meeting',
  'Buy groceries',
  'Call mom',
  'Pay bills',
  'Exercise for 30 minutes',
  'Read a chapter',
  'Clean the apartment',
  'Prepare presentation slides',
  'Send weekly report',
  'Backup important files',
  'Update dependencies',
  'Research new framework',
  'Plan weekend trip',
  'Water the plants',
];

const DIARY_ENTRIES = [
  'Today was productive. I managed to complete most of my tasks and felt accomplished.',
  'Had a great meeting with the team. We brainstormed some exciting ideas for the next sprint.',
  'Feeling a bit tired today. Need to get more sleep and take better care of myself.',
  'Learned something new about TypeScript generics. The type system is really powerful.',
  'Went for a long walk in the park. Nature really helps clear the mind.',
  'Spent quality time with family. These moments are precious.',
  'Struggled with a difficult bug for hours. Finally fixed it after taking a break.',
  'Started reading a new book about productivity. Some interesting concepts so far.',
  'Cooked a new recipe today. It turned out better than expected!',
  'Reflecting on my goals for the month. Need to stay focused and consistent.',
  'Had a video call with an old friend. Great to catch up after so long.',
  'The weather was beautiful today. Perfect for working from the balcony.',
  'Feeling grateful for the little things in life.',
  'Made progress on my side project. Excited to see it come together.',
  'Today I learned about WebSocket optimization. Fascinating stuff.',
];

const MOOD_NOTES = [
  'Feeling energized and ready to tackle the day',
  'A bit stressed about deadlines',
  'Calm and focused',
  'Happy after a good workout',
  'Tired but satisfied',
  'Feeling creative today',
  'Need more coffee',
  'Grateful for good health',
  null, // Sometimes no note
  null,
  null,
];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function randomDate(daysAgo: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(randomInt(6, 23), randomInt(0, 59), randomInt(0, 59));
  return date;
}

async function seed() {
  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    console.log('Starting seed...');

    // Create demo user
    const passwordHash = crypto.createHash('sha256').update('demo123').digest('hex');
    
    const userResult = await pool.query(
      `INSERT INTO dear_diary.users 
       (telegram_user_id, username, email, password_hash, display_name, timezone)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (telegram_user_id) DO UPDATE SET
         username = EXCLUDED.username,
         display_name = EXCLUDED.display_name
       RETURNING id`,
      [123456789, 'demo_user', 'demo@kalix.local', passwordHash, 'Demo User', 'Europe/Berlin']
    );

    const userId = userResult.rows[0].id;
    console.log(`Created/updated demo user: ${userId}`);
    console.log('  Email: demo@kalix.local');
    console.log('  Password: demo123');
    console.log('  Telegram ID: 123456789');

    // Clear existing data for this user
    await pool.query('DELETE FROM dear_diary.todos WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM dear_diary.diary_entries WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM dear_diary.mood_logs WHERE user_id = $1', [userId]);
    console.log('Cleared existing data');

    // Generate data for each day
    let totalTodos = 0;
    let totalDiary = 0;
    let totalMoods = 0;

    for (let daysAgo = SEED_CONFIG.daysOfData; daysAgo >= 0; daysAgo--) {
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);
      const localDate = date.toISOString().split('T')[0];

      // Create todos
      const numTodos = randomInt(SEED_CONFIG.todosPerDay.min, SEED_CONFIG.todosPerDay.max);
      for (let i = 0; i < numTodos; i++) {
        const createdAt = randomDate(daysAgo);
        const isCompleted = Math.random() < SEED_CONFIG.completionRate;
        const completedAt = isCompleted ? new Date(createdAt.getTime() + randomInt(1, 24) * 3600000) : null;
        
        await pool.query(
          `INSERT INTO dear_diary.todos 
           (user_id, title, status, priority, local_date, tags, source, created_at, completed_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            userId,
            randomChoice(TODO_TITLES),
            isCompleted ? 'done' : 'open',
            randomInt(0, 3),
            localDate,
            Math.random() > 0.5 ? ['work'] : ['personal'],
            randomChoice(['telegram', 'web', 'api']),
            createdAt,
            completedAt,
          ]
        );
        totalTodos++;
      }

      // Create diary entries
      const numDiary = randomInt(SEED_CONFIG.diaryEntriesPerDay.min, SEED_CONFIG.diaryEntriesPerDay.max);
      for (let i = 0; i < numDiary; i++) {
        const createdAt = randomDate(daysAgo);
        
        await pool.query(
          `INSERT INTO dear_diary.diary_entries 
           (user_id, raw_text, local_date, tags, source, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            userId,
            randomChoice(DIARY_ENTRIES),
            localDate,
            Math.random() > 0.7 ? ['reflection'] : [],
            randomChoice(['telegram', 'web']),
            createdAt,
          ]
        );
        totalDiary++;
      }

      // Create mood logs
      const numMoods = randomInt(SEED_CONFIG.moodLogsPerDay.min, SEED_CONFIG.moodLogsPerDay.max);
      for (let i = 0; i < numMoods; i++) {
        const createdAt = randomDate(daysAgo);
        // Mood tends to be better on weekends
        const dayOfWeek = date.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const baseMood = isWeekend ? 3.5 : 3;
        const moodScore = Math.min(5, Math.max(1, Math.round(baseMood + (Math.random() - 0.5) * 3)));
        
        await pool.query(
          `INSERT INTO dear_diary.mood_logs 
           (user_id, mood_score, note, local_date, source, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            userId,
            moodScore,
            randomChoice(MOOD_NOTES),
            localDate,
            randomChoice(['telegram', 'web']),
            createdAt,
          ]
        );
        totalMoods++;
      }
    }

    console.log(`\nSeed completed!`);
    console.log(`  Todos created: ${totalTodos}`);
    console.log(`  Diary entries created: ${totalDiary}`);
    console.log(`  Mood logs created: ${totalMoods}`);
    console.log(`  Date range: last ${SEED_CONFIG.daysOfData} days`);

  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
