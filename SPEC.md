# Task Board — Project Spec

Working spec for the Task Board project. Written before the code and updated as the build progressed, section by section.

## 1. Overview

A Kanban-style task board (Asana/Linear/Notion-inspired) where guest users create tasks and drag them across four columns: To Do, In Progress, In Review, Done. Each guest sees only their own tasks. Tasks persist in Supabase behind Row Level Security.

**What it has to get right:** polished design, smooth drag-and-drop, real Supabase persistence with RLS, guest auth isolation, clear loading/error states, and a deployed live URL.

## 2. Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React (web) + TypeScript | Fastest path to a hosted live URL; TS gives type safety across the data model and drag-and-drop state. |
| Backend | None — Supabase called directly from the frontend | Supabase JS client + RLS is sufficient for this scope; skips building/hosting a separate API. |
| Database & Auth | Supabase (Postgres, Anonymous Auth, RLS) | Managed Postgres with authorization in the database, so the frontend can talk to it directly with no API layer to build or host. |
| Hosting | Vercel | Free tier, zero-config for a Vite/Next React app. |
| Drag-and-drop | `@dnd-kit` | Actively maintained, accessible, works well with column-based Kanban layouts (lighter and more flexible than `react-beautiful-dnd`, which is unmaintained). |
| Styling | Tailwind CSS | Fast to build a cohesive design system (spacing, color, type scale) without hand-rolling CSS. |
| Build tool | Vite | Fast dev server, simple Vercel deploy, no need for Next.js's server features here. |

Bonus features committed for v1: **team members & assignees**, **due date indicators**.

## 3. Database Schema

Six tables total: `tasks` and `teams` (core), `members`, `team_members`, `task_assignees` (bonus: team members & assignees), plus `auth.users` supplied by Supabase's built-in anonymous auth. `members` is the canonical roster of people (unique name per guest); `team_members` is a many-to-many join linking people to teams; `task_assignees` links tasks directly to people. Assignment follows the *person*, not the team — a member can belong to several teams, or none, and still be assignable to any task.

### `teams`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK, default `gen_random_uuid()` | unique team identifier |
| `name` | text, not null | team display name |
| `user_id` | uuid, not null, default `auth.uid()`, references `auth.users` on delete cascade | ties team to guest session; what RLS checks |
| `created_at` | timestamptz, not null, default `now()` | |

### `tasks`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK, default `gen_random_uuid()` | unique task identifier |
| `title` | text, not null | required field |
| `description` | text, nullable | bonus field |
| `status` | text, not null, default `'todo'`, check-constrained | `todo` / `in_progress` / `in_review` / `done` — drives column placement |
| `priority` | text, not null, default `'normal'`, check-constrained | `low` / `normal` / `high` (no distinct "unset" state) |
| `due_date` | date, nullable | powers due-date badges; compared client-side against browser-local today |
| `position` | double precision, not null, default `extract(epoch from clock_timestamp())` | fractional sort key within a column, so drag-and-drop reordering computes a value between two neighbors instead of renumbering every row on every move; the client (`lib/position.ts`) always sets this explicitly on create/move, the column default is just a same-convention (epoch-seconds) fallback |
| `user_id` | uuid, not null, default `auth.uid()`, references `auth.users` on delete cascade | ties task to guest session; what RLS checks |
| `created_at` | timestamptz, not null, default `now()` | auto-set |

### `members` (canonical roster)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK, default `gen_random_uuid()` | unique person identifier |
| `name` | text, not null | display name; `unique (user_id, name)` — no duplicate names within one guest's roster |
| `color` | text, nullable | avatar color |
| `user_id` | uuid, not null, default `auth.uid()`, references `auth.users` on delete cascade | ties roster entry to guest session; what RLS checks |
| `created_at` | timestamptz, not null, default `now()` | |

A person is one row here no matter how many teams they're on or tasks they're assigned to — `team_members` and `task_assignees` both point back to this single identity rather than duplicating name/color per relationship.

### `team_members` (join: person ↔ team)

| Column | Type | Notes |
|---|---|---|
| `team_id` | uuid, not null, references `teams(id)` on delete cascade | which team |
| `member_id` | uuid, not null, references `members(id)` on delete cascade | which person |
| `created_at` | timestamptz, not null, default `now()` | when added to the team |

Primary key: `(team_id, member_id)` — a person appears at most once per team, but the same person can belong to multiple teams (many-to-many). No `user_id` column — same as `task_assignees`, scope is inherited entirely through the `teams` and `members` rows it links (see RLS below).

### `task_assignees` (join: task ↔ person)

| Column | Type | Notes |
|---|---|---|
| `task_id` | uuid, not null, references `tasks(id)` on delete cascade | which task |
| `member_id` | uuid, not null, references `members(id)` on delete cascade | which person |
| `created_at` | timestamptz, not null, default `now()` | when assigned |

Primary key: `(task_id, member_id)` — supports multiple assignees per task, prevents duplicate assignment of the same person. No `user_id` column at all — scope is inherited entirely through the `tasks` and `members` rows it links (see RLS below).

**Assignment scope:** tasks are *not* scoped to a team — a single task may have assignees drawn from multiple teams, or from no team at all (intentional; matches the free-form "drag any member onto a task" UI, and the fact that assignment goes through `members` rather than `team_members`). Owner columns default to `auth.uid()` so client hooks never hand-stamp `user_id`; RLS `with check` remains the enforcement.

## 4. Row Level Security

All tables have RLS enabled. Since auth is anonymous, `auth.uid()` returns a stable per-guest-session UUID and is the sole basis for every policy — no roles, no shared data.

### `teams`, `tasks`, and `members`

All three carry a direct `user_id` column and get the same four policies:

| Operation | Rule |
|---|---|
| SELECT | `user_id = auth.uid()` |
| INSERT | `WITH CHECK (user_id = auth.uid())` |
| UPDATE | `USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())` |
| DELETE | `USING (user_id = auth.uid())` |

### `team_members`

Three policies only — SELECT / INSERT / DELETE. There's no UPDATE policy because there's nothing to update on a pure link row; changing who's on a team means deleting one link and inserting another. The policies check that *both* the team and the person being linked belong to the guest:

```sql
EXISTS (SELECT 1 FROM teams t WHERE t.id = team_members.team_id AND t.user_id = auth.uid())
AND
EXISTS (SELECT 1 FROM members m WHERE m.id = team_members.member_id AND m.user_id = auth.uid())
```

So a guest can never link their team to someone else's roster entry, or vice versa, even by guessing a UUID. This table has no `user_id` column of its own — same as `task_assignees` below, scope is inherited entirely through the tables it links.

### `task_assignees`

Same shape as `team_members` — SELECT / INSERT / DELETE only, no `user_id` column at all, scope inherited by checking that *both* the task and the person being linked belong to the requesting guest:

```sql
EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_assignees.task_id AND t.user_id = auth.uid())
AND
EXISTS (SELECT 1 FROM members m WHERE m.id = task_assignees.member_id AND m.user_id = auth.uid())
```

Applied to SELECT/INSERT/DELETE alike — a guest can't link their task to someone else's roster entry, or someone else's task to their own roster entry.

## 5. Guest Auth Flow

Authentication is entirely anonymous — no login screen, no signup form. The app opens straight into the board.

### First launch

On load, check for an existing Supabase session. If none exists, call `supabase.auth.signInAnonymously()`, which creates a new `auth.users` row and returns a session. `auth.uid()` is then available for every query and RLS check from the first render.

### Returning guests

The Supabase JS client persists the anonymous session in `localStorage` by default, so a returning guest reuses the same session and the same `user_id` automatically — same tasks, same team members, every time on that device. The board is only lost if the user clears browser storage or switches browsers. There's no in-app reset/"start fresh" action in v1 — clearing storage is the only way to begin a new guest identity.

## 6. Frontend Architecture

### Data layer

- **Supabase client** in `lib/supabase.ts` — single instance, anon key only.
- **TanStack Query** manages all server state: caching, loading/error states, refetching, and optimistic updates with automatic rollback.
- Components never call Supabase directly — they call hooks: tasks (`useTasks`, `useCreateTask`, `useMoveTask`, `useDeleteTask`, `useAddAssignees`, `useRemoveAssignee`), teams (`useTeams`, `useCreateTeam`, `useDeleteTeam`, `useAddMemberToTeam`, `useRemoveMemberFromTeam`), and the roster (`useMembers`, `useCreateMember`, `useDeleteMember`). Each mutation hook wraps a Supabase call and invalidates/optimistically updates the relevant query; failures also surface a toast (`context/ToastContext.tsx`).

### Sync model

**Update on drop / on action** — the board updates locally on each drop, create, or edit and persists to Supabase immediately. Drag-and-drop uses an optimistic update: the card moves instantly, and TanStack Query rolls it back if the DB write fails. No Realtime subscriptions in v1 (free on Supabase, but adds subscription lifecycle + reconciliation complexity for little payoff in a single-owner board). Can be layered in later as polish.

### Component tree

```
main.tsx
└── QueryClientProvider         (TanStack Query context)
    └── AuthProvider            (anon session: loading / ready / error)
        └── App
            └── AuthGate                    (renders children once the session is ready)
                └── ToastProvider           (mutation-failure toasts)
                    └── WinsProvider        (completed-task tally, persisted in localStorage)
                        └── NewTaskProvider     (in-progress task-draft state)
                            └── Workspace       (DndContext lives here — owns drag state)
                                ├── Sidebar
                                │   ├── MembersSection          (roster: add/remove people)
                                │   └── TeamSection  ×N          (collapsible; add/remove people per team)
                                │       └── DraggableMember  ×N
                                └── Board
                                    └── Column  ×4                (droppable; todo / in_progress / in_review / done)
                                        ├── AddTaskCard            (To Do column only — new-task draft + drop target)
                                        └── DraggableTaskCard  ×N
                                            └── TaskCard            (title, badges, assignees; reused in the DragOverlay)
```

### Drag-and-drop

`@dnd-kit`'s `DndContext` lives in `Workspace` (`App.tsx`), not in `Board`. Three draggable types share it — `task`, `member`, `team` — routed through one custom `collisionDetection` that filters valid drop targets by drag type: tasks target columns/other cards (reorder); members/teams target team sections, the new-task draft, or an open task's assignee zone. Reordering uses fractional positions (`lib/position.ts`) so a move only ever touches the one row being moved, never renumbers a column. On mobile, the sidebar is an overlay drawer sharing screen space with the board, so drop targets are also gated by what's actually visible — board targets are excluded while the drawer's open, and once a member/team drag has moved right of its pickup point it's treated as irreversibly headed for the board for the rest of that drag, so it can never land back on a team it happens to pass over. Hovering a collapsed task card for ~550ms auto-expands it mid-drag, with an explicit `measureDroppableContainers` call to re-measure its drop zone after the resize (dnd-kit doesn't reliably pick that up on its own).

## 7. Design System & UI

### Layout

A two-region layout:

- **Left sidebar** — team & roster workspace:
  - A top-level **Members** roster, independent of any team.
  - View and create **teams**. Each team is **collapsible** to save vertical space; add/remove roster members to/from it.
- **Main area** — the Kanban board with the four columns (To Do, In Progress, In Review, Done). The **new-task draft** lives at the top of the To Do column, not the sidebar.

### Task draft flow (signature interaction)

Task creation is a two-stage, drag-driven flow rather than a plain form:

1. User starts a new task at the top of the To Do column (enters title, optional description, priority, due date).
2. To assign people, the user **drags a member — from the roster or a team — or an entire team at once, onto the task draft**; each attaches as an avatar chip. Multiple members/teams can be attached (multi-assignee, per the `task_assignees` join table).
3. When done, the user clicks **"Add task"** — only then does the task become a real board card that can be dragged into a column. On submit, the task is persisted to Supabase with `status = 'todo'` and its assignees written to `task_assignees`.

This spans several distinct `@dnd-kit` drag interactions, all optimistic: member → team (roster to team), member/team → the task draft or an open task's assignee zone (assignment), and task card → column or another card (status change / reorder).

### Color palette

**Saturated pastel** — pastel hues with enough saturation to feel intentional and modern, not washed out. Direction:

- Soft but vivid base tints for surfaces (e.g. warm off-white / pale lilac background, white cards with subtle tinted borders).
- A small set of saturated-pastel accent hues used consistently: one per column (so To Do / In Progress / In Review / Done are color-coded), plus member avatar colors drawn from the same family.
- Priority and due-date badges reuse palette accents (e.g. saturated coral for high priority / overdue, soft amber for due-soon).
- Exact hex values to be locked when we build tokens; defined once as CSS variables / Tailwind theme extension so the palette stays cohesive.

### Typography

- **Instrument Serif** (Google Fonts, 400 + Italic) — the signature display face. Used for the app title, team names, task titles, column headers, and large headings. Loaded via Google Fonts.
- **Inter** (or system sans) — UI/body text: buttons, labels, metadata, dates, form fields, small text where the display serif would hurt readability.
- This pairing keeps the serif as the distinctive look everywhere it carries weight, while small functional text stays crisp.

### Due-date indicators (bonus feature)

Task cards show a due-date badge driven by `due_date` vs. today:

- **Overdue** — saturated warning tint (e.g. coral) + icon.
- **Due soon** (e.g. within 2 days) — amber tint.
- **Later / no date** — neutral or hidden.

### States (graded)

- **Loading** — skeleton cards/columns while `useTasks()` is fetching, not a bare spinner.
- **Empty** — thoughtful, column-specific copy instead of a generic placeholder: "All quiet. Time to get rolling." (In Progress), "Nothing to nitpick — yet." (In Review), "No wins here yet. Go bag one." (Done); plus empty-roster ("No people yet...") and empty-team ("No teams yet...", "Drag people here from Members.") states in the sidebar.
- **Error** — clear inline error surfaces with a retry affordance, driven by TanStack Query error states.

### Responsive

Board is horizontally scrollable on narrow screens; sidebar collapses to a toggle on mobile. Responsive is a secondary goal here — targeted, but deliberately not over-invested in.

## 8. SQL Migration

The full, runnable schema lives in [`schema.sql`](./schema.sql) — paste into the Supabase SQL Editor and run. It creates all five app tables, indexes, enables RLS on each, and defines owner-only policies (plus the join tables' inherited-scope policies).

Details worth noting in the DDL beyond the tables/RLS already spec'd:

- **`check` constraints** on `tasks.status` (`todo`/`in_progress`/`in_review`/`done`) and `tasks.priority` (`low`/`normal`/`high`) — enforces the allowed values at the DB level, not just in the UI.
- **`on delete cascade`** on every FK to `auth.users`, so deleting a guest's `auth.users` row (e.g. from the Supabase dashboard) cleans up their teams, tasks, members, and assignments consistently. Cascades also flow through the join tables: deleting a team or a member removes the matching `team_members` link rows (not the member itself); deleting a task or a member removes the matching `task_assignees` link rows.
- **Indexes** on `tasks.user_id`, `teams.user_id`, and `members.user_id`, plus both join tables' lookup keys (`team_members.member_id`, `task_assignees.member_id`) — every query filters by one of these.
- **`default auth.uid()`** on every owner `user_id` column, so client hooks never supply it; RLS `with check` is the sole enforcement rather than also a client footgun.
- Policies are dropped-and-recreated so the script can be re-run safely during development.
- **Run-once on a clean project.** The file uses `create table if not exists` and assumes a fresh Supabase project — running it once builds the full schema. It is not written to reconcile column/constraint changes onto tables that already exist; if the schema evolves later, apply changes with explicit `alter table` migrations.

This is the first buildable artifact. The schema can be applied to Supabase and verified independently before any frontend code exists.

## 9. Project Scaffolding

Repo layout — one git repo at the root, app isolated in `web/`:

```
Task-Board-Project/        (git repo root)
├── .gitignore             (root: OS junk, env safety net)
├── .mailmap               (collapses two git identities onto one author)
├── README.md              (what it is, setup from a clean clone, known gaps)
├── SPEC.md                (this file)
├── schema.sql             (Supabase migration)
└── web/                   (Vite app; Vercel Root Directory = web)
    ├── .env.local         (real Supabase URL + publishable key; gitignored)
    ├── .env.example       (committed placeholder template)
    ├── index.html         (Google Fonts: Instrument Serif + Inter)
    ├── vite.config.ts     (React + @tailwindcss/vite plugins)
    └── src/
        ├── index.css       (Tailwind v4 @import + @theme design tokens; card/glow animations)
        ├── App.tsx         (DndContext, collision routing, mobile sidebar state)
        ├── main.tsx        (QueryClientProvider + AuthProvider root)
        ├── auth/
        │   └── AuthProvider.tsx   (anon session bootstrap)
        ├── context/
        │   ├── NewTaskContext.tsx (in-progress task-draft state)
        │   └── ToastContext.tsx   (mutation-failure toasts)
        ├── components/     (UI building blocks — Sidebar, Board, Column, TaskCard, etc.)
        ├── hooks/          (TanStack Query data hooks — tasks/teams/members)
        ├── lib/
        │   ├── supabase.ts       (single typed createClient<Database> instance)
        │   ├── position.ts       (+ position.test.ts — fractional drag-order math)
        │   ├── columns.ts        (column defs; move/hover tint class literals)
        │   ├── dueDate.ts        (overdue / soon / later classification)
        │   ├── avatarColors.ts   (palette + initials)
        │   ├── supabaseErrors.ts (Postgres unique-violation check)
        │   └── queryClient.ts    (shared TanStack Query client)
        └── types/
            ├── database.types.ts  (mirrors schema.sql; literal-union status/priority)
            └── index.ts           (Task, Team, Member, TaskWithAssignees, TeamWithMembers, TaskDraft)
```

Key versions: React 19, Vite 8, TypeScript 6, Tailwind v4 (CSS-first `@theme`), Node 24 (matches Vercel). Data deps: `@supabase/supabase-js`, `@tanstack/react-query`, `@dnd-kit/{core,sortable,utilities}`, `lucide-react`, `date-fns`. Test deps: `vitest`.

Env vars are `VITE_`-prefixed so Vite exposes them to the client; the publishable key is safe in the frontend (RLS enforces access), and the `service_role` key is never used. Verified: `npm install` + `npm run build` compile clean, `tsc` passes on the typed client and `Database` type, and `npm test` (Vitest) passes the position-math unit tests.

## 10. Links

- **GitHub:** https://github.com/milanj08/Task-Board-Project
- **Supabase project URL:** https://zkkyzysekugsivmbkqjg.supabase.co
- **Live frontend (Vercel):** https://task-board-project-theta.vercel.app/
