import type { Pool } from 'pg';
import type { CreateDiaryEntry, DiaryQuery, DiaryEntry, PaginatedResponse } from '@kalix/shared';

export class DiaryService {
  constructor(private pool: Pool) {}

  async create(userId: string, data: CreateDiaryEntry): Promise<DiaryEntry> {
    // Get user timezone for local_date calculation
    const userResult = await this.pool.query(
      `SELECT timezone FROM dear_diary.users WHERE id = $1`,
      [userId]
    );
    const timezone = userResult.rows[0]?.timezone || 'Europe/Berlin';

    // Use provided localDate or compute from current time
    const localDate = data.localDate || null;

    const result = await this.pool.query(
      `INSERT INTO dear_diary.diary_entries 
       (user_id, raw_text, tags, source, telegram_message_id, local_date)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6::DATE, (NOW() AT TIME ZONE $7)::DATE))
       RETURNING *`,
      [
        userId,
        data.rawText,
        data.tags ?? [],
        data.source ?? 'api',
        data.telegramMessageId ?? null,
        localDate,
        timezone,
      ]
    );

    return this.mapRow(result.rows[0]);
  }

  async getById(userId: string, id: string): Promise<DiaryEntry | null> {
    const result = await this.pool.query(
      `SELECT * FROM dear_diary.diary_entries WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async list(userId: string, query: DiaryQuery): Promise<PaginatedResponse<DiaryEntry>> {
    const { range, search, tag, limit, offset } = query;

    // Build WHERE conditions
    const conditions: string[] = ['user_id = $1'];
    const values: unknown[] = [userId];
    let paramIndex = 2;

    // Date range filter
    if (range === 'week') {
      conditions.push(`local_date >= CURRENT_DATE - INTERVAL '7 days'`);
    } else if (range === 'month') {
      conditions.push(`local_date >= CURRENT_DATE - INTERVAL '30 days'`);
    }

    // Full-text search
    if (search) {
      conditions.push(`to_tsvector('english', raw_text) @@ plainto_tsquery('english', $${paramIndex})`);
      values.push(search);
      paramIndex++;
    }

    // Tag filter
    if (tag) {
      conditions.push(`$${paramIndex} = ANY(tags)`);
      values.push(tag);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Get total count
    const countResult = await this.pool.query(
      `SELECT COUNT(*) as total FROM dear_diary.diary_entries WHERE ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].total, 10);

    // Get items
    const result = await this.pool.query(
      `SELECT * FROM dear_diary.diary_entries 
       WHERE ${whereClause}
       ORDER BY local_date DESC, created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, limit, offset]
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
      `DELETE FROM dear_diary.diary_entries WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    return (result.rowCount ?? 0) > 0;
  }

  private mapRow(row: Record<string, unknown>): DiaryEntry {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      rawText: row.raw_text as string,
      wordCount: row.word_count as number,
      localDate: (row.local_date as Date).toISOString().split('T')[0]!,
      tags: row.tags as string[],
      source: row.source as 'telegram' | 'web' | 'api',
      telegramMessageId: row.telegram_message_id as number | null,
      createdAt: (row.created_at as Date).toISOString(),
      updatedAt: (row.updated_at as Date).toISOString(),
    };
  }
}
