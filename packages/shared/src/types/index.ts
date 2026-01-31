// Re-export all types from schemas
export type {
  User,
  CreateUser,
  UpdateUser,
  UpsertTelegramUser,
} from '../schemas/user.js';

export type {
  Todo,
  CreateTodo,
  UpdateTodo,
  CompleteTodo,
  TodoQuery,
  TodoStatus,
  TodoSource,
} from '../schemas/todo.js';

export type {
  DiaryEntry,
  CreateDiaryEntry,
  UpdateDiaryEntry,
  DiaryQuery,
  DiarySource,
} from '../schemas/diary.js';

export type {
  MoodLog,
  CreateMoodLog,
  MoodQuery,
  MoodSource,
} from '../schemas/mood.js';

export type {
  LoginRequest,
  LoginResponse,
  RefreshTokenRequest,
  AuthError,
  JWTPayload,
} from '../schemas/auth.js';

export type {
  WSAuthMessage,
  WSAuthOkMessage,
  WSAuthErrorMessage,
  WSTodoCreateMessage,
  WSTodoUpdateMessage,
  WSTodoCompleteMessage,
  WSDiaryCreateMessage,
  WSMoodLogMessage,
  WSAckMessage,
  WSBroadcastEvent,
  WSClientMessage,
  WSServerMessage,
} from '../schemas/ws.js';

export type {
  RangeQuery,
  OverviewStats,
  TimeSeriesPoint,
  TodosTimeSeries,
  MoodTimeSeries,
  HeatmapDataPoint,
  HeatmapData,
} from '../schemas/stats.js';

// Additional utility types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// Auth context types
export type AuthType = 'jwt' | 'service_token';

export interface AuthContext {
  type: AuthType;
  userId: string;
  isServiceToken: boolean;
}
