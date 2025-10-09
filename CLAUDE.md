# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a nursing calendar application built with Next.js 15, designed to manage shift schedules for nursery school staff. The application uses NextAuth v5 for authentication with credentials provider and Prisma as the ORM with PostgreSQL.

## Development Commands

**Development server:**
```bash
npm run dev
```

**Build:**
```bash
npm run build
```

**Linting and formatting:**
```bash
npm run lint          # Check code with Biome
npm run format        # Format code with Biome
```

**Database commands:**
```bash
npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate   # Run database migrations
npm run prisma:studio    # Open Prisma Studio GUI
```

## Architecture

### Database Schema (Prisma)

The application uses a multi-tenant architecture where each User manages their own set of data:

- **User**: The authenticated user (single login user per account)
- **Member**: Nursery staff members managed by a user (including themselves via `isSelf` flag)
- **WorkTimeType**: Custom shift time types (e.g., "07:00-16:00") with colors for calendar display
- **Shift**: Daily shift assignments linking members to work time types and dates

Key relationships:
- User → Members (one-to-many): A user manages multiple staff members
- User → WorkTimeTypes (one-to-many): A user defines custom shift types
- Member → Shifts (one-to-many): Each member has multiple shift entries
- WorkTimeType → Shifts (one-to-many): Shift types are reused across shifts
- Shifts have unique constraint: one shift per member per date

### Prisma Client Location

The Prisma client is generated to a **custom location**: `app/generated/prisma` (not the default `node_modules/.prisma/client`). Import it via `app/lib/prisma.ts`:

```typescript
import { prisma } from "./lib/prisma";
```

### Authentication (NextAuth v5)

- **Strategy**: JWT-based sessions with Credentials Provider
- **Configuration**: `app/lib/auth.ts` exports `{ handlers, signIn, signOut, auth }`
- **Login flow**: Email/password authentication with bcrypt password hashing
- **API routes**: `/api/auth/[...nextauth]/route.ts` handles NextAuth endpoints
- **Signup**: Custom API route at `/api/auth/signup/route.ts`
- **Session management**: Client-side provider in `app/components/SessionProvider.tsx`

### Project Structure

```
app/
├── api/auth/           # Authentication API routes
├── components/         # React components
├── generated/prisma/   # Generated Prisma client (custom location)
├── lib/
│   ├── auth.ts        # NextAuth configuration
│   └── prisma.ts      # Prisma client singleton
├── login/             # Login page
├── signup/            # Signup page
└── types/             # TypeScript type definitions

prisma/
├── schema.prisma      # Database schema
└── migrations/        # Database migration files
```

## Code Style and Linting

This project uses **Biome** (not ESLint/Prettier) for linting and formatting:
- Configuration: `biome.json`
- Indentation: 2 spaces
- Import organization: automatically enabled
- Next.js and React domains are enabled with recommended rules

**Important**: A PostToolUse hook automatically formats TypeScript files with Biome after Write/Edit operations.

## Key Implementation Notes

1. **Database URL**: Expects `DATABASE_URL` environment variable for PostgreSQL connection
2. **NextAuth version**: Using v5 beta (API differs from v4)
3. **Next.js version**: 15.5.4 with React 19 and Turbopack enabled
4. **Cascading deletes**: User deletion cascades to Members, WorkTimeTypes, and their related Shifts
5. **Date handling**: Shifts use `@db.Date` type for date-only storage (no time component)
