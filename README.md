# Kalix Dear Diary

A personal diary and task management system with Telegram integration, n8n automation support, and a modern web dashboard.

## Features

- **Telegram Integration**: Create todos, diary entries, and mood logs via Telegram
- **n8n Workflows**: Automate your journaling with n8n integration
- **Web Dashboard**: Beautiful analytics with charts and statistics
- **Real-time Updates**: WebSocket support for live data synchronization
- **Multi-user Support**: Fully isolated user data with proper authentication

## Tech Stack

- **Backend**: Node.js, Fastify, TypeScript, PostgreSQL
- **Frontend**: React, Vite, TailwindCSS, Recharts, TanStack Query
- **Infrastructure**: Docker, docker-compose, nginx

## Project Structure

```
kalix-dear-diary/
├── apps/
│   ├── api/          # Fastify backend server
│   └── web/          # React frontend
├── packages/
│   ├── db/           # Database schema & migrations
│   └── shared/       # Shared Zod schemas & types
├── docs/             # Documentation
└── docker-compose.yml
```

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 8+
- Docker & Docker Compose

### Development Setup

1. **Clone and install dependencies**
   ```bash
   git clone <repo-url>
   cd kalix-dear-diary
   pnpm install
   ```

2. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env with your values (especially JWT_SECRET and SERVICE_TOKEN)
   ```

3. **Start the database**
   ```bash
   docker-compose up -d postgres
   ```

4. **Run database migrations and seed**
   ```bash
   pnpm db:migrate
   pnpm db:seed
   ```

5. **Start development servers**
   ```bash
   pnpm dev
   ```

   This starts:
   - API server at http://localhost:3001
   - Web app at http://localhost:3000
   - API docs at http://localhost:3001/docs

### Demo Credentials

After seeding, you can login with:
- **Email**: demo@kalix.local
- **Password**: demo123

### Production with Docker

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | - |
| `JWT_SECRET` | Secret for JWT signing | - |
| `SERVICE_TOKEN` | Token for n8n/service auth | - |
| `API_PORT` | API server port | 3001 |
| `DEFAULT_TIMEZONE` | Default user timezone | Europe/Berlin |

## API Documentation

See [docs/api.md](docs/api.md) for full API reference.

### Key Endpoints

- `GET /api/health` - Health check
- `POST /api/auth/login` - User authentication
- `GET /api/todos` - List todos
- `POST /api/todos` - Create todo
- `GET /api/stats/overview` - Dashboard statistics

### WebSocket

Connect to `/ws` and authenticate with JWT for real-time updates.

See [docs/api.md](docs/api.md#websocket) for message formats.

## n8n Integration

See [docs/n8n.md](docs/n8n.md) for workflow examples and setup instructions.

### Example Telegram Commands

- `todo: buy milk tomorrow` - Creates a todo
- `done: buy milk` - Marks a todo as complete
- `mood 4: felt productive` - Logs mood (1-5 scale)
- `diary: today I learned...` - Creates diary entry

## Database

See [docs/db.md](docs/db.md) for schema documentation.

The database uses the `dear_diary` schema with tables:
- `users` - User accounts with Telegram linking
- `todos` - Task management
- `diary_entries` - Diary/journal entries
- `mood_logs` - Mood tracking (1-5 scale)

## Deployment (Raspberry Pi)

1. Install Docker on your Pi
2. Clone the repository
3. Copy `.env.example` to `.env` and configure
4. Run `docker-compose up -d`
5. Set up nginx reverse proxy (optional)

See [docs/deployment.md](docs/deployment.md) for detailed instructions.

## License

MIT
