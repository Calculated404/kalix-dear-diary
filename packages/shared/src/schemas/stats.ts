import { z } from 'zod';

export const rangeQuerySchema = z.object({
  range: z.enum(['week', 'month', 'year']).default('week'),
});

// Overview stats
export const overviewStatsSchema = z.object({
  todosCreated: z.number().int().min(0),
  todosCompleted: z.number().int().min(0),
  completionRate: z.number().min(0).max(1), // 0-1 percentage
  diaryEntryCount: z.number().int().min(0),
  wordCount: z.number().int().min(0),
  moodAvg: z.number().min(1).max(5).nullable(),
  moodDistribution: z.object({
    '1': z.number().int().min(0),
    '2': z.number().int().min(0),
    '3': z.number().int().min(0),
    '4': z.number().int().min(0),
    '5': z.number().int().min(0),
  }),
});

// Time series data point
export const timeSeriesPointSchema = z.object({
  date: z.string(), // YYYY-MM-DD
  value: z.number(),
});

// Todos time series
export const todosTimeSeriesSchema = z.object({
  created: z.array(timeSeriesPointSchema),
  completed: z.array(timeSeriesPointSchema),
});

// Mood time series
export const moodTimeSeriesSchema = z.object({
  average: z.array(z.object({
    date: z.string(),
    value: z.number().nullable(),
  })),
});

// Heatmap data (year in pixels style)
export const heatmapDataPointSchema = z.object({
  date: z.string(), // YYYY-MM-DD
  value: z.number(), // Can be completion count, mood, etc.
  level: z.number().int().min(0).max(4), // 0-4 intensity level for coloring
});

export const heatmapDataSchema = z.object({
  type: z.enum(['todos_completed', 'mood', 'activity']),
  data: z.array(heatmapDataPointSchema),
});

// Types
export type RangeQuery = z.infer<typeof rangeQuerySchema>;
export type OverviewStats = z.infer<typeof overviewStatsSchema>;
export type TimeSeriesPoint = z.infer<typeof timeSeriesPointSchema>;
export type TodosTimeSeries = z.infer<typeof todosTimeSeriesSchema>;
export type MoodTimeSeries = z.infer<typeof moodTimeSeriesSchema>;
export type HeatmapDataPoint = z.infer<typeof heatmapDataPointSchema>;
export type HeatmapData = z.infer<typeof heatmapDataSchema>;
