import type { Pool } from 'pg';
import type { CreateMoodLog, MoodQuery, MoodLog, PaginatedResponse } from '@kalix/shared';

export class MoodService {
  constructor(private pool: Pool) {}

  async create(userId: string, data: CreateMoodLog): Promise<MoodLog> {
    // Get user timezone for local_date calculation
    const userResult = await this.pool.query(
      `SELECT timezone FROM dear_diary.users WHERE id = $1`,
      [userId]
    );
    const timezone = userResult.rows[0]?.timezone || 'Europe/Berlin';

    // Use provided localDate or compute from current time
    const localDate = data.localDate || null;

    const result = await this.pool.query(
      `INSERT INTO dear_diary.mood_logs 
       (user_id, mood_score, note, source, telegram_message_id, local_date)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6::DATE, (NOW() AT TIME ZONE $7)::DATE))
       RETURNING *`,
      [
        userId,
        data.moodScore,
        data.note ?? null,
        data.source ?? 'api',
        data.telegramMessageId ?? null,
        localDate,
        timezone,
      ]
    );

    return this.mapRow(result.rows[0]);
  }

  async getById(userId: string, id: string): Promise<MoodLog | null> {
    const result = await this.pool.query(
      `SELECT * FROM dear_diary.mood_logs WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async list(userId: string, query: MoodQuery): Promise<PaginatedResponse<MoodLog>> {
    const { range, limit, offset } = query;

    // Build date filter
    let dateFilter = '';
    if (range === 'week') {
      dateFilter = `AND local_date >= CURRENT_DATE - INTERVAL '7 days'`;
    } else if (range === 'month') {
      dateFilter = `AND local_date >= CURRENT_DATE - INTERVAL '30 days'`;
    }

    // Get total count
    const countResult = await this.pool.query(
      `SELECT COUNT(*) as total FROM dear_diary.mood_logs 
       WHERE user_id = $1 ${dateFilter}`,
      [userId]
    );
    const total = parseInt(countResult.rows[0].total, 10);

    // Get items
    const result = await this.pool.query(
      `SELECT * FROM dear_diary.mood_logs 
       WHERE user_id = $1 ${dateFilter}
       ORDER BY local_date DESC, created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const items = result.rows.map(row => this.mapRow(row));

    return {
      items,
      total,
      limit,
      offset,
      hasMore: offset + items.length < total,
    };
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const result = await this.pool.query(
      `DELETE FROM dear_diary.mood_logs WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    return (result.rowCount ?? 0) > 0;
  }

  private mapRow(row: Record<string, unknown>): MoodLog {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      moodScore: row.mood_score as number,
      note: row.note as string | null,
      localDate: (row.local_date as Date).toISOString().split('T')[0]!,
      source: row.source as 'telegram' | 'web' | 'api',
      telegramMessageId: row.telegram_message_id as number | null,
      createdAt: (row.created_at as Date).toISOString(),
    };
  }
}
