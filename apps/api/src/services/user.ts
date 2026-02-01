import type { Pool } from 'pg';
import crypto from 'crypto';
import type { UpsertTelegramUser } from '@kalix/shared';

export interface DbUser {
  id: string;
  telegramUserId: number | null;
  username: string | null;
  email: string | null;
  passwordHash: string | null;
  displayName: string | null;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
  isActive: boolean;
}

export class UserService {
  constructor(private pool: Pool) {}

  async getById(id: string): Promise<DbUser | null> {
    const result = await this.pool.query(
      `SELECT id, telegram_user_id, username, email, password_hash,
              display_name, timezone, created_at, updated_at, last_login_at, is_active
       FROM dear_diary.users WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) return null;

    return this.mapRow(result.rows[0]);
  }

  async getByTelegramId(telegramUserId: number): Promise<DbUser | null> {
    const result = await this.pool.query(
      `SELECT id, telegram_user_id, username, email, password_hash,
              display_name, timezone, created_at, updated_at, last_login_at, is_active
       FROM dear_diary.users WHERE telegram_user_id = $1`,
      [telegramUserId]
    );

    if (result.rows.length === 0) return null;

    return this.mapRow(result.rows[0]);
  }

  async getByEmail(email: string): Promise<DbUser | null> {
    const result = await this.pool.query(
      `SELECT id, telegram_user_id, username, email, password_hash,
              display_name, timezone, created_at, updated_at, last_login_at, is_active
       FROM dear_diary.users WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) return null;

    return this.mapRow(result.rows[0]);
  }

  async upsertByTelegramId(data: UpsertTelegramUser): Promise<DbUser> {
    const result = await this.pool.query(
      `INSERT INTO dear_diary.users (telegram_user_id, username, display_name, timezone)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (telegram_user_id) 
       DO UPDATE SET 
         username = COALESCE($2, dear_diary.users.username),
         display_name = COALESCE($3, dear_diary.users.display_name),
         updated_at = NOW()
       RETURNING id, telegram_user_id, username, email, password_hash,
                 display_name, timezone, created_at, updated_at, last_login_at, is_active`,
      [
        data.telegramUserId,
        data.username ?? null,
        data.displayName ?? null,
        process.env['DEFAULT_TIMEZONE'] || 'Europe/Berlin',
      ]
    );

    return this.mapRow(result.rows[0]);
  }

  async verifyPassword(email: string, password: string): Promise<DbUser | null> {
    const user = await this.getByEmail(email);
    if (!user || !user.passwordHash) return null;

    // Simple bcrypt-style comparison (in production, use proper bcrypt)
    const inputHash = crypto.createHash('sha256').update(password).digest('hex');
    
    // NOTE: In production, use bcrypt.compare instead
    if (inputHash !== user.passwordHash) return null;

    return user;
  }

  async verifyLoginCode(code: string): Promise<DbUser | null> {
    const result = await this.pool.query(
      `UPDATE dear_diary.login_codes 
       SET used_at = NOW()
       WHERE code = $1 
         AND used_at IS NULL 
         AND expires_at > NOW()
       RETURNING user_id`,
      [code]
    );

    if (result.rows.length === 0) return null;

    return this.getById(result.rows[0].user_id);
  }

  async createLoginCode(userId: string): Promise<string> {
    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await this.pool.query(
      `INSERT INTO dear_diary.login_codes (user_id, code, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, code, expiresAt]
    );

    return code;
  }

  async storeRefreshToken(userId: string, tokenHash: string, expiresInSeconds: number): Promise<void> {
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    await this.pool.query(
      `INSERT INTO dear_diary.refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, tokenHash, expiresAt]
    );
  }

  async verifyRefreshToken(userId: string, tokenHash: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT id FROM dear_diary.refresh_tokens
       WHERE user_id = $1 
         AND token_hash = $2 
         AND expires_at > NOW()
         AND revoked_at IS NULL`,
      [userId, tokenHash]
    );

    return result.rows.length > 0;
  }

  async revokeAllRefreshTokens(userId: string): Promise<void> {
    await this.pool.query(
      `UPDATE dear_diary.refresh_tokens 
       SET revoked_at = NOW()
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId]
    );
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.pool.query(
      `UPDATE dear_diary.users SET last_login_at = NOW() WHERE id = $1`,
      [userId]
    );
  }

  async updateTimezone(userId: string, timezone: string): Promise<void> {
    await this.pool.query(
      `UPDATE dear_diary.users SET timezone = $1 WHERE id = $2`,
      [timezone, userId]
    );
  }

  async updateDisplayName(userId: string, displayName: string | null): Promise<void> {
    await this.pool.query(
      `UPDATE dear_diary.users SET display_name = $1 WHERE id = $2`,
      [displayName, userId]
    );
  }

  private mapRow(row: Record<string, unknown>): DbUser {
    return {
      id: row.id as string,
      telegramUserId: row.telegram_user_id as number | null,
      username: row.username as string | null,
      email: row.email as string | null,
      passwordHash: row.password_hash as string | null,
      displayName: row.display_name as string | null,
      timezone: row.timezone as string,
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
      lastLoginAt: row.last_login_at as Date | null,
      isActive: row.is_active as boolean,
    };
  }
}
