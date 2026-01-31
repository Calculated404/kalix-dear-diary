import type { Pool } from 'pg';
import type { OverviewStats, TodosTimeSeries, MoodTimeSeries, HeatmapData } from '@kalix/shared';

type RangeType = 'week' | 'month' | 'year';

export class StatsService {
  constructor(private pool: Pool) {}

  private getRangeDays(range: RangeType): number {
    switch (range) {
      case 'week': return 7;
      case 'month': return 30;
      case 'year': return 365;
    }
  }

  async getOverview(userId: string, range: RangeType): Promise<OverviewStats> {
    const days = this.getRangeDays(range);

    // Get todos stats
    const todosResult = await this.pool.query(
      `SELECT 
         COUNT(*) FILTER (WHERE local_date >= CURRENT_DATE - $2::INT) as todos_created,
         COUNT(*) FILTER (WHERE status = 'done' AND completed_at >= CURRENT_DATE - $2::INT * INTERVAL '1 day') as todos_completed
       FROM dear_diary.todos
       WHERE user_id = $1`,
      [userId, days]
    );

    const todosCreated = parseInt(todosResult.rows[0].todos_created || '0', 10);
    const todosCompleted = parseInt(todosResult.rows[0].todos_completed || '0', 10);
    const completionRate = todosCreated > 0 ? todosCompleted / todosCreated : 0;

    // Get diary stats
    const diaryResult = await this.pool.query(
      `SELECT 
         COUNT(*) as diary_count,
         COALESCE(SUM(word_count), 0) as word_count
       FROM dear_diary.diary_entries
       WHERE user_id = $1 AND local_date >= CURRENT_DATE - $2::INT`,
      [userId, days]
    );

    const diaryEntryCount = parseInt(diaryResult.rows[0].diary_count || '0', 10);
    const wordCount = parseInt(diaryResult.rows[0].word_count || '0', 10);

    // Get mood stats
    const moodResult = await this.pool.query(
      `SELECT 
         AVG(mood_score)::NUMERIC(3,2) as mood_avg,
         COUNT(*) FILTER (WHERE mood_score = 1) as mood_1,
         COUNT(*) FILTER (WHERE mood_score = 2) as mood_2,
         COUNT(*) FILTER (WHERE mood_score = 3) as mood_3,
         COUNT(*) FILTER (WHERE mood_score = 4) as mood_4,
         COUNT(*) FILTER (WHERE mood_score = 5) as mood_5
       FROM dear_diary.mood_logs
       WHERE user_id = $1 AND local_date >= CURRENT_DATE - $2::INT`,
      [userId, days]
    );

    const moodAvg = moodResult.rows[0].mood_avg ? parseFloat(moodResult.rows[0].mood_avg) : null;

    return {
      todosCreated,
      todosCompleted,
      completionRate: Math.round(completionRate * 100) / 100,
      diaryEntryCount,
      wordCount,
      moodAvg,
      moodDistribution: {
        '1': parseInt(moodResult.rows[0].mood_1 || '0', 10),
        '2': parseInt(moodResult.rows[0].mood_2 || '0', 10),
        '3': parseInt(moodResult.rows[0].mood_3 || '0', 10),
        '4': parseInt(moodResult.rows[0].mood_4 || '0', 10),
        '5': parseInt(moodResult.rows[0].mood_5 || '0', 10),
      },
    };
  }

  async getTodosTimeseries(userId: string, range: RangeType): Promise<TodosTimeSeries> {
    const days = this.getRangeDays(range);

    // Generate date series and join with todos data
    const result = await this.pool.query(
      `WITH date_series AS (
         SELECT generate_series(
           CURRENT_DATE - $2::INT + 1,
           CURRENT_DATE,
           '1 day'::interval
         )::DATE as date
       ),
       created_counts AS (
         SELECT local_date, COUNT(*) as count
         FROM dear_diary.todos
         WHERE user_id = $1 AND local_date >= CURRENT_DATE - $2::INT
         GROUP BY local_date
       ),
       completed_counts AS (
         SELECT (completed_at AT TIME ZONE 
           (SELECT timezone FROM dear_diary.users WHERE id = $1))::DATE as date,
           COUNT(*) as count
         FROM dear_diary.todos
         WHERE user_id = $1 
           AND status = 'done'
           AND completed_at >= CURRENT_DATE - $2::INT * INTERVAL '1 day'
         GROUP BY 1
       )
       SELECT 
         ds.date,
         COALESCE(cc.count, 0) as created,
         COALESCE(cpc.count, 0) as completed
       FROM date_series ds
       LEFT JOIN created_counts cc ON ds.date = cc.local_date
       LEFT JOIN completed_counts cpc ON ds.date = cpc.date
       ORDER BY ds.date`,
      [userId, days]
    );

    const created = result.rows.map(row => ({
      date: row.date.toISOString().split('T')[0],
      value: parseInt(row.created, 10),
    }));

    const completed = result.rows.map(row => ({
      date: row.date.toISOString().split('T')[0],
      value: parseInt(row.completed, 10),
    }));

    return { created, completed };
  }

  async getMoodsTimeseries(userId: string, range: RangeType): Promise<MoodTimeSeries> {
    const days = this.getRangeDays(range);

    const result = await this.pool.query(
      `WITH date_series AS (
         SELECT generate_series(
           CURRENT_DATE - $2::INT + 1,
           CURRENT_DATE,
           '1 day'::interval
         )::DATE as date
       ),
       mood_avgs AS (
         SELECT local_date, AVG(mood_score)::NUMERIC(3,2) as avg_mood
         FROM dear_diary.mood_logs
         WHERE user_id = $1 AND local_date >= CURRENT_DATE - $2::INT
         GROUP BY local_date
       )
       SELECT 
         ds.date,
         ma.avg_mood
       FROM date_series ds
       LEFT JOIN mood_avgs ma ON ds.date = ma.local_date
       ORDER BY ds.date`,
      [userId, days]
    );

    const average = result.rows.map(row => ({
      date: row.date.toISOString().split('T')[0],
      value: row.avg_mood ? parseFloat(row.avg_mood) : null,
    }));

    return { average };
  }

  async getHeatmap(
    userId: string, 
    range: RangeType, 
    type: 'todos_completed' | 'mood' | 'activity'
  ): Promise<HeatmapData> {
    const days = this.getRangeDays(range);

    let query: string;
    
    if (type === 'todos_completed') {
      query = `
        WITH date_series AS (
          SELECT generate_series(
            CURRENT_DATE - $2::INT + 1,
            CURRENT_DATE,
            '1 day'::interval
          )::DATE as date
        ),
        completed AS (
          SELECT 
            (completed_at AT TIME ZONE (SELECT timezone FROM dear_diary.users WHERE id = $1))::DATE as date,
            COUNT(*) as count
          FROM dear_diary.todos
          WHERE user_id = $1 AND status = 'done' AND completed_at IS NOT NULL
          GROUP BY 1
        )
        SELECT 
          ds.date,
          COALESCE(c.count, 0) as value
        FROM date_series ds
        LEFT JOIN completed c ON ds.date = c.date
        ORDER BY ds.date`;
    } else if (type === 'mood') {
      query = `
        WITH date_series AS (
          SELECT generate_series(
            CURRENT_DATE - $2::INT + 1,
            CURRENT_DATE,
            '1 day'::interval
          )::DATE as date
        ),
        moods AS (
          SELECT local_date, AVG(mood_score)::NUMERIC(3,1) as avg
          FROM dear_diary.mood_logs
          WHERE user_id = $1
          GROUP BY local_date
        )
        SELECT 
          ds.date,
          COALESCE(m.avg, 0) as value
        FROM date_series ds
        LEFT JOIN moods m ON ds.date = m.local_date
        ORDER BY ds.date`;
    } else {
      // Activity: combination of todos + diary + moods
      query = `
        WITH date_series AS (
          SELECT generate_series(
            CURRENT_DATE - $2::INT + 1,
            CURRENT_DATE,
            '1 day'::interval
          )::DATE as date
        ),
        activity AS (
          SELECT local_date as date, COUNT(*) as count FROM dear_diary.todos WHERE user_id = $1 GROUP BY local_date
          UNION ALL
          SELECT local_date, COUNT(*) FROM dear_diary.diary_entries WHERE user_id = $1 GROUP BY local_date
          UNION ALL
          SELECT local_date, COUNT(*) FROM dear_diary.mood_logs WHERE user_id = $1 GROUP BY local_date
        ),
        daily_activity AS (
          SELECT date, SUM(count) as total FROM activity GROUP BY date
        )
        SELECT 
          ds.date,
          COALESCE(da.total, 0) as value
        FROM date_series ds
        LEFT JOIN daily_activity da ON ds.date = da.date
        ORDER BY ds.date`;
    }

    const result = await this.pool.query(query, [userId, days]);

    // Calculate levels (0-4) based on value distribution
    const values = result.rows.map(r => parseFloat(r.value));
    const maxValue = Math.max(...values.filter(v => v > 0), 1);

    const data = result.rows.map(row => {
      const value = parseFloat(row.value);
      let level: number;
      
      if (type === 'mood') {
        // For mood, level is based on mood score (1-5 -> 0-4)
        level = value > 0 ? Math.round(value) - 1 : 0;
      } else {
        // For counts, normalize to 0-4
        const normalized = value / maxValue;
        if (value === 0) level = 0;
        else if (normalized < 0.25) level = 1;
        else if (normalized < 0.5) level = 2;
        else if (normalized < 0.75) level = 3;
        else level = 4;
      }

      return {
        date: row.date.toISOString().split('T')[0],
        value,
        level: Math.min(4, Math.max(0, level)) as 0 | 1 | 2 | 3 | 4,
      };
    });

    return { type, data };
  }

  async getRecentActivity(userId: string, limit: number): Promise<Array<{
    type: 'todo' | 'diary' | 'mood';
    id: string;
    title: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
  }>> {
    const result = await this.pool.query(
      `(
        SELECT 
          'todo' as type,
          id,
          title,
          created_at as timestamp,
          jsonb_build_object('status', status, 'priority', priority) as metadata
        FROM dear_diary.todos
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      )
      UNION ALL
      (
        SELECT 
          'diary' as type,
          id,
          LEFT(raw_text, 100) as title,
          created_at as timestamp,
          jsonb_build_object('wordCount', word_count) as metadata
        FROM dear_diary.diary_entries
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      )
      UNION ALL
      (
        SELECT 
          'mood' as type,
          id,
          'Mood: ' || mood_score::text as title,
          created_at as timestamp,
          jsonb_build_object('score', mood_score, 'note', note) as metadata
        FROM dear_diary.mood_logs
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      )
      ORDER BY timestamp DESC
      LIMIT $2`,
      [userId, limit]
    );

    return result.rows.map(row => ({
      type: row.type as 'todo' | 'diary' | 'mood',
      id: row.id,
      title: row.title,
      timestamp: row.timestamp.toISOString(),
      metadata: row.metadata,
    }));
  }
}
