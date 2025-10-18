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
├── login/
│   ├── _components/   # Login-specific components (not routable)
│   └── page.tsx       # Login page
├── signup/            # Signup page
└── types/             # TypeScript type definitions

prisma/
├── schema.prisma      # Database schema
└── migrations/        # Database migration files
```

**Component Organization:**
- Use `_components` directories within route folders to store page-specific components that should not be routable
- The underscore prefix (`_`) prevents Next.js from treating the directory as a route segment
- Example: `app/login/_components/SuccessMessage.tsx` is used by `app/login/page.tsx` but is not accessible via routing

## Design System and Styling

### Theme Colors

This application uses an **orange-based color theme** to create a warm and approachable interface suitable for nursery school staff. Always use these theme colors when implementing UI components:

**Primary Colors (Orange):**
- `bg-primary` / `text-primary`: Main orange (#FF6B35) - Use for primary buttons, CTAs, and important highlights
- `bg-primary-dark` / `text-primary-dark`: Dark orange (#E85D2F) - Use for hover states
- `bg-primary-light` / `text-primary-light`: Light orange (#FF8C5A) - Use for subtle highlights
- `bg-primary-pale` / `text-primary-pale`: Pale orange (#FFE5D9) - Use for backgrounds and badges

**Accent Colors:**
- `text-accent-blue`: Blue (#4A90E2) - Use for links and informational elements
- `text-accent`: Peach orange (#FFB347) - Use for secondary highlights

**Status Colors:**
- `text-success`: Green (#10B981) - Use for success messages
- `text-error`: Red (#EF4444) - Use for error messages
- `text-warning`: Yellow (#F59E0B) - Use for warnings

**Background/Text:**
- `bg-background` / `text-foreground`: Automatically adapts to light/dark mode

### Dark Mode

- Dark mode is implemented using a `.dark` class on the `<html>` element
- All theme colors automatically adjust for dark mode
- Use Tailwind's `dark:` variant for dark mode-specific styles
- Theme toggle component is available in the top-right corner (`app/components/ThemeToggle.tsx`)

### Styling Guidelines

1. **Prioritize theme colors**: Always use custom theme colors over default Tailwind colors for brand consistency
2. **Use semantic naming**: Choose colors based on their purpose (primary for main actions, success for confirmations, etc.)
3. **Maintain contrast**: Ensure sufficient contrast ratios for accessibility
4. **Consistent hover states**: Use `hover:bg-primary-dark` for orange buttons

## Code Style and Linting

This project uses **Biome** (not ESLint/Prettier) for linting and formatting:
- Configuration: `biome.json`
- Indentation: 2 spaces
- Import organization: automatically enabled
- Next.js and React domains are enabled with recommended rules
- **Type imports**: Always use `import type` for type-only imports (enforced by Biome's `useImportType` rule)

**Important**: A PostToolUse hook automatically formats TypeScript files with Biome after Write/Edit operations.

## Technology Stack

- **Framework**: Next.js 15.5.4 (App Router) with React 19 and Turbopack enabled
- **Database**: PostgreSQL + Prisma ORM
- **Authentication**: NextAuth v5 beta (Credentials Provider)
- **UI**: React 19 + Tailwind CSS
- **State Management**: React Server Components + Client Components
- **Linting/Formatting**: Biome

## Security Considerations

All features must adhere to the following security principles:

1. **Authentication**: All API calls must include authentication checks using `auth()` from NextAuth
2. **Authorization**: Users can only access and modify data they own (checked via `userId` in database queries)
3. **Input Validation**: Implement validation on both client-side (user experience) and server-side (security)
4. **SQL Injection Prevention**: Prisma automatically escapes queries; always use Prisma query builders, never raw SQL

**Example authorization pattern:**
```typescript
const session = await auth();
const data = await prisma.someModel.findMany({
  where: { userId: session.user.id } // Always filter by userId
});
```

## Performance Considerations

1. **Server Components First**: Prefer Server Components for data fetching to leverage automatic caching and reduce client bundle size
2. **Data Scoping**: Always fetch data with appropriate filters (e.g., by month for shifts, by userId for multi-tenant isolation)
3. **Caching Strategy**:
   - Server Components provide automatic caching for GET requests
   - Use `router.refresh()` after mutations to revalidate cached data
4. **Optimistic UI Updates**: For interactive features, update UI immediately and handle API calls in the background
5. **API Optimization**: Use UPSERT operations to reduce unnecessary GET requests

**Data fetching pattern:**
```typescript
// Server Component (automatic caching)
export default async function Page() {
  const data = await prisma.model.findMany({
    where: { userId: session.user.id, date: { gte: startOfMonth } }
  });
  return <ClientComponent data={data} />;
}
```

## Accessibility

1. **Keyboard Navigation**: Ensure all interactive elements are keyboard accessible with proper focus management
2. **Screen Reader Support**: Use appropriate ARIA labels and semantic HTML
3. **Color Independence**: Never rely solely on color to convey information; always include text labels or icons
4. **Focus Management**: Properly manage focus in modals and dynamic UI elements

## Key Implementation Notes

1. **Database URL**: Expects `DATABASE_URL` environment variable for PostgreSQL connection
2. **NextAuth version**: Using v5 beta (API differs from v4)
3. **Cascading deletes**: User deletion cascades to Members, WorkTimeTypes, and their related Shifts
4. **Date handling**: Shifts use `@db.Date` type for date-only storage (no time component)
5. **useSearchParams**: In Next.js 15, components using `useSearchParams()` must be wrapped in a `<Suspense>` boundary. Extract such components into separate files and wrap them with Suspense in the parent component.
