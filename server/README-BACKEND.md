# EWF Emergency Call Service - Backend API

Backend API server for the EWF Emergency Call Service mobile application. Handles incident management, on-call routing, user authentication, and technician dispatch..

## Features

- **Incident Management**: Create, track, and resolve emergency incidents
- **On-Call Routing**: Automated technician routing with escalation ladder
- **User Authentication**: JWT-based auth with role-based access control
- **Technician Availability**: Real-time availability tracking and management
- **Incident Reports**: Time tracking, billable hours, and report generation
- **Building ID Tracking**: Associate incidents with specific buildings
- **Manual Incident Creation**: Admins can create incidents manually
- **Health Monitoring**: `/api/trpc/health.check` endpoint for uptime monitoring

## Tech Stack

- **Runtime**: Node.js 22.x
- **Framework**: Express.js
- **API**: tRPC v11 with TypeScript
- **Database**: MySQL with Drizzle ORM
- **Authentication**: JWT tokens
- **Telephony**: Twilio integration for on-call routing

## Environment Variables

Required environment variables:

```bash
# Server
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=mysql://user:password@host:port/database

# Authentication
JWT_SECRET=your-secret-key-here

# Manus Platform (for AI features)
BUILT_IN_FORGE_API_URL=https://api.manus.im
BUILT_IN_FORGE_API_KEY=your-manus-api-key

# OAuth (optional)
OAUTH_SERVER_URL=https://api.manus.im
OWNER_OPEN_ID=your-owner-id
```

## Installation

```bash
# Install dependencies
pnpm install

# Run database migrations
pnpm db:push

# Build for production
pnpm build

# Start production server
pnpm start
```

## Development

```bash
# Start development server with hot reload
pnpm dev

# Run tests
pnpm test

# Type checking
pnpm check

# Lint code
pnpm lint
```

## API Endpoints

### Health Check
```
GET /api/trpc/health.check
```

Returns server and database health status.

### Authentication
```
POST /api/auth/login
GET /api/auth/me
POST /api/auth/logout
```

### tRPC Routes
All tRPC routes are available at `/api/trpc/*`:

- `incidents.*` - Incident management
- `users.*` - User and technician management
- `config.*` - Configuration management
- `reports.*` - Incident reports
- `health.*` - Health monitoring

## Database Schema

Main tables:
- `users` - Technicians and administrators
- `incidents` - Emergency incidents
- `incident_events` - Incident timeline and audit log
- `call_attempts` - On-call routing attempts
- `incident_reports` - Detailed incident reports
- `sites` - Building/site information
- `config` - System configuration

## Deployment

### Railway

1. Fork/clone this repository
2. Create new project on Railway
3. Connect GitHub repository
4. Add MySQL database
5. Set environment variables
6. Deploy

Railway will automatically:
- Install dependencies
- Run build command
- Start server on assigned PORT
- Run health checks

### Render

1. Create new Web Service
2. Connect repository
3. Set build command: `pnpm install && pnpm build`
4. Set start command: `pnpm start`
5. Add environment variables
6. Deploy

## Health Monitoring

The `/api/trpc/health.check` endpoint returns:

```json
{
  "result": {
    "data": {
      "json": {
        "status": "healthy",
        "database": "connected",
        "timestamp": "2026-02-07T18:00:00.000Z"
      }
    }
  }
}
```

Use this endpoint with monitoring services like:
- UptimeRobot
- Pingdom
- StatusCake
- Railway health checks

## Security

- All passwords are hashed with bcrypt
- JWT tokens expire after 7 days
- CORS configured for mobile app origins
- Environment variables for sensitive data
- SQL injection protection via Drizzle ORM
- Rate limiting recommended for production

## Support

For issues or questions:
- Check the main project README
- Review DEPLOYMENT.md for deployment help
- Contact: support@ewandf.ca

## License

Proprietary - EWF Emergency Call Service
