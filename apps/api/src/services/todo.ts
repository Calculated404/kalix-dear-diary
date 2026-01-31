import type { Pool } from 'pg';
import type { CreateTodo, UpdateTodo, TodoQuery, Todo, PaginatedResponse } from '@kalix/shared';

export class TodoService {
  constructor(private pool: Pool) {}

  async create(userId: string, data: CreateTodo): Promise<Todo> {
    // Get user timezone for local_date calculation
    const userResult = await this.pool.query(
      `SELECT timezone FROM dear_diary.users WHERE id = $1`,
      [userId]
    );
    const timezone = userResult.rows[0]?.timezone || 'Europe/Berlin';

    const result = await this.pool.query(
      `INSERT INTO dear_diary.todos 
       (user_id, title, description, priority, due_date, due_time, tags, source, telegram_message_id, local_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, (NOW() AT TIME ZONE $10)::DATE)
       RETURNING *`,
      [
        userId,
        data.title,
        data.description ?? null,
        data.priority ?? 0,
        data.dueDate ?? null,
        data.dueTime ?? null,
        data.tags ?? [],
        data.source ?? 'api',
        data.telegramMessageId ?? null,
        timezone,
      ]
    );

    return this.mapRow(result.rows[0]);
  }

  async getById(userId: string, id: string): Promise<Todo | null> {
    const result = await this.pool.query(
      `SELECT * FROM dear_diary.todos WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async list(userId: string, query: TodoQuery): Promise<PaginatedResponse<Todo>> {
    const { range, status, limit, offset } = query;

    // Build date filter
    let dateFilter = '';
    if (range === 'week') {
      dateFilter = `AND local_date >= CURRENT_DATE - INTERVAL '7 days'`;
    } else if (range === 'month') {
      dateFilter = `AND local_date >= CURRENT_DATE - INTERVAL '30 days'`;
    }

    // Build status filter
    let statusFilter = '';
    if (status === 'open') {
      statusFilter = `AND status = 'open'`;
    } else if (status === 'done') {
      statusFilter = `AND status = 'done'`;
    }

    // Get total count
    const countResult = await this.pool.query(
      `SELECT COUNT(*) as total FROM dear_diary.todos 
       WHERE user_id = $1 ${dateFilter} ${statusFilter}`,
      [userId]
    );
    const total = parseInt(countResult.rows[0].total, 10);

    // Get items
    const result = await this.pool.query(
      `SELECT * FROM dear_diary.todos 
       WHERE user_id = $1 ${dateFilter} ${statusFilter}
       ORDER BY 
         CASE WHEN status = 'open' THEN 0 ELSE 1 END,
         COALESCE(due_date, '9999-12-31') ASC,
         priority DESC,
         created_at DESC
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

  async update(userId: string, id: string, data: UpdateTodo): Promise<Todo | null> {
    // Build dynamic update query
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (data.title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(data.title);
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(data.description);
    }
    if (data.priority !== undefined) {
      updates.push(`priority = $${paramIndex++}`);
      values.push(data.priority);
    }
    if (data.dueDate !== undefined) {
      updates.push(`due_date = $${paramIndex++}`);
      values.push(data.dueDate);
    }
    if (data.dueTime !== undefined) {
      updates.push(`due_time = $${paramIndex++}`);
      values.push(data.dueTime);
    }
    if (data.tags !== undefined) {
      updates.push(`tags = $${paramIndex++}`);
      values.push(data.tags);
    }
    if (data.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(data.status);
      
      // If marking as done, set completed_at
      if (data.status === 'done') {
        updates.push(`completed_at = NOW()`);
      } else {
        updates.push(`completed_at = NULL`);
      }
    }

    if (updates.length === 0) {
      return this.getById(userId, id);
    }

    values.push(id, userId);
    const result = await this.pool.query(
      `UPDATE dear_diary.todos 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND user_id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async complete(userId: string, id: string): Promise<Todo | null> {
    const result = await this.pool.query(
      `UPDATE dear_diary.todos 
       SET status = 'done', completed_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, userId]
    );

    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const result = await this.pool.query(
      `DELETE FROM dear_diary.todos WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    return (result.rowCount ?? 0) > 0;
  }

  private mapRow(row: Record<string, unknown>): Todo {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      title: row.title as string,
      description: row.description as string | null,
      status: row.status as 'open' | 'done' | 'cancelled',
      priority: row.priority as number,
      dueDate: row.due_date ? (row.due_date as Date).toISOString().split('T')[0]! : null,
      dueTime: row.due_time as string | null,
      completedAt: row.completed_at ? (row.completed_at as Date).toISOString() : null,
      localDate: (row.local_date as Date).toISOString().split('T')[0]!,
      tags: row.tags as string[],
      source: row.source as 'telegram' | 'web' | 'api',
      telegramMessageId: row.telegram_message_id as number | null,
      createdAt: (row.created_at as Date).toISOString(),
      updatedAt: (row.updated_at as Date).toISOString(),
    };
  }
}
