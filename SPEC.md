# Task Board — Project Spec

Working spec for the Next Play Games SDE internship assessment. Built incrementally, section by section.

## 1. Overview

A Kanban-style task board (Asana/Linear/Notion-inspired) where guest users create tasks and drag them across four columns: To Do, In Progress, In Review, Done. Each guest sees only their own tasks. Tasks persist in Supabase behind Row Level Security.

**Success criteria (from the assessment):** polished design, smooth drag-and-drop, real Supabase persistence with RLS, guest auth isolation, clear loading/error states, and a deployed live URL.

## 2. Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React (web) + TypeScript | Fastest path to a hosted live URL; TS gives type safety across the data model and drag-and-drop state. |
| Backend | None — Supabase called directly from the frontend | Supabase JS client + RLS is sufficient for this scope; skips building/hosting a separate API. |
| Database & Auth | Supabase (Postgres, Anonymous Auth, RLS) | Required by the assessment. |
| Hosting | Vercel | Free tier, zero-config for a Vite/Next React app. |
| Drag-and-drop | `@dnd-kit` | Actively maintained, accessible, works well with column-based Kanban layouts (lighter and more flexible than `react-beautiful-dnd`, which is unmaintained). |
| Styling | Tailwind CSS | Fast to build a cohesive design system (spacing, color, type scale) without hand-rolling CSS. |
| Build tool | Vite | Fast dev server, simple Vercel deploy, no need for Next.js's server features here. |

Bonus features committed for v1: **team members & assignees**, **due date indicators**.

## 3. Database Schema

Five tables total: `tasks` (required), `teams`, `team_members`, `task_assignees` (bonus: team members & assignees), plus `auth.users` supplied by Supabase's built-in anonymous auth. Members are grouped under teams so the sidebar can show multiple collapsible teams.

### `teams`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK, default `gen_random_uuid()` | unique team identifier |
| `name` | text, not null | team display name |
| `user_id` | uuid, not null, default `auth.uid()`, references `auth.users` | ties team to guest session; what RLS checks |
| `created_at` | timestamptz, default `now()` | |

### `tasks`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK, default `gen_random_uuid()` | unique task identifier |
| `title` | text, not null | required field |
| `description` | text, nullable | bonus field |
| `status` | text, not null, default `'todo'`, check-constrained | `todo` / `in_progress` / `in_review` / `done` — drives column placement |
| `priority` | text, not null, default `'normal'`, check-constrained | `low` / `normal` / `high` (no distinct "unset" state) |
| `due_date` | date, nullable | powers due-date badges; compared client-side against browser-local today |
| `user_id` | uuid, not null, default `auth.uid()`, references `auth.users` | ties task to guest session; what RLS checks |
| `created_at` | timestamptz, default `now()` | auto-set |
| `updated_at` | timestamptz, default `now()`, trigger-bumped | auto-updates on every edit/move; enables recency sorting & optimistic-concurrency checks |

### `team_members`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK, default `gen_random_uuid()` | unique member identifier |
| `name` | text, not null | display name |
| `color` | text, nullable | optional avatar color |
| `team_id` | uuid, not null, references `teams(id)` on delete cascade | which team the member belongs to |
| `user_id` | uuid, not null, default `auth.uid()`, references `auth.users` | ties roster to guest session; what RLS checks |
| `created_at` | timestamptz, default `now()` | |

**Assignment scope:** tasks are *not* scoped to a team — a single task may have assignees drawn from multiple teams (intentional; matches the free-form "drag any member onto a task" UI). Owner columns default to `auth.uid()` so client hooks never hand-stamp `user_id`; RLS `with check` remains the enforcement.

### `task_assignees` (join table)

| Column | Type | Notes |
|---|---|---|
| `task_id` | uuid, not null, references `tasks(id)` on delete cascade | which task |
| `team_member_id` | uuid, not null, references `team_members(id)` on delete cascade | which member |
| `created_at` | timestamptz, default `now()` | when assigned |

Primary key: `(task_id, team_member_id)` — supports multiple assignees per task, prevents duplicate assignment of the same member. No direct `user_id` — scope is inherited via `task_id`'s join back to `tasks`.

## 4. Row Level Security

All tables have RLS enabled. Since auth is anonymous, `auth.uid()` returns a stable per-guest-session UUID and is the sole basis for every policy — no roles, no shared data.

### `tasks`, `teams`, and `team_members`

All three carry a direct `user_id` column, so all get the same four policies:

| Operation | Rule |
|---|---|
| SELECT | `user_id = auth.uid()` |
| INSERT | `WITH CHECK (user_id = auth.uid())` |
| UPDATE | `USING (user_id = auth.uid())` |
| DELETE | `USING (user_id = auth.uid())` |

**`team_members` extra check:** its INSERT and UPDATE policies *also* verify the target `team_id` belongs to the guest (`EXISTS … teams WHERE id = team_id AND user_id = auth.uid()`), so a member row can never be attached to another guest's team. The direct `user_id` column is a deliberate denormalization (flat, indexed RLS reads without a join through `teams`); this extra check is what keeps the two sources of truth from ever disagreeing.

### `task_assignees`

No `user_id` column of its own — scope is inherited by checking that *both* the task and the team member being linked belong to the requesting guest, so a guest can't link their task to someone else's team member (or vice versa) even by guessing a UUID:

```sql
USING (
  EXISTS (SELECT 1 FROM tasks WHERE tasks.id = task_assignees.task_id AND tasks.user_id = auth.uid())
  AND
  EXISTS (SELECT 1 FROM team_members WHERE team_members.id = task_assignees.team_member_id AND team_members.user_id = auth.uid())
)
```
Applied to SELECT/INSERT/UPDATE/DELETE alike.

## 5. Guest Auth Flow

Authentication is entirely anonymous — no login screen, no signup form. The app opens straight into the board.

### First launch

On load, check for an existing Supabase session. If none exists, call `supabase.auth.signInAnonymously()`, which creates a new `auth.users` row and returns a session. `auth.uid()` is then available for every query and RLS check from the first render.

### Returning guests

The Supabase JS client persists the anonymous session in `localStorage` by default, so a returning guest reuses the same session and the same `user_id` automatically — same tasks, same team members, every time on that device. The board is only lost if the user clears browser storage or switches browsers.

### Start fresh

An explicit **Start fresh** button (in a menu/settings area) lets a guest wipe their board and begin with a new identity:

1. Show a confirmation dialog — this is a one-way, unrecoverable action.
2. Delete the current guest's rows: `tasks` and `team_members` (their `task_assignees` rows cascade away automatically).
3. Call `signInAnonymously()` again to mint a brand-new guest identity.
4. Land on an empty board.

**Note on "deleting" accounts:** the anon key cannot delete an `auth.users` row (that requires the service-role key, which must stay out of the frontend). So "start fresh" deletes the guest's *data* rows; the old anonymous auth user is orphaned but harmless. Because the old identity is discarded and the anon key can't log back into it, the old board is unrecoverable — hence the confirmation dialog.

## 6. Frontend Architecture

### Data layer

- **Supabase client** in `lib/supabase.ts` — single instance, anon key only.
- **TanStack Query** manages all server state: caching, loading/error states, refetching, and optimistic updates with automatic rollback.
- Components never call Supabase directly — they call hooks: `useTasks()`, `useCreateTask()`, `useUpdateTask()`, `useUpdateTaskStatus()`, `useDeleteTask()`, `useTeamMembers()`, `useCreateTeamMember()`, etc. Each mutation hook wraps a Supabase call and invalidates/optimistically updates the relevant query.

### Sync model

**Update on drop / on action** — the board updates locally on each drop, create, or edit and persists to Supabase immediately. Drag-and-drop uses an optimistic update: the card moves instantly, and TanStack Query rolls it back if the DB write fails. No Realtime subscriptions in v1 (free on Supabase, but adds subscription lifecycle + reconciliation complexity for little payoff in a single-owner board). Can be layered in later as polish.

### Component tree

```
App
├── QueryClientProvider        (TanStack Query context)
├── AuthGate                   (ensures anon session exists before rendering board)
└── BoardPage
    ├── BoardHeader            (title, "Start fresh", team member management entry)
    ├── Board                  (DndContext lives here — owns drag state)
    │   └── Column  ×4          (droppable; todo / in_progress / in_review / done)
    │       └── TaskCard  ×N    (draggable; title, priority, due-date badge, assignee avatars)
    ├── NewTaskDialog           (create task: title, description, priority, due date, assignees)
    ├── TaskDetailPanel         (view/edit a task)
    └── TeamMemberManager       (add/remove team members: name + color)
```

### Drag-and-drop

`@dnd-kit`'s `DndContext` lives in `Board`. Columns are droppable zones keyed by status; cards are draggable. On drop, the handler reads the target column's status and fires `useUpdateTaskStatus()` optimistically.

## 7. Design System & UI

### Layout

A two-region layout:

- **Left sidebar** — team & task workspace:
  - View and create **teams**. Each team is **collapsible** to save vertical space.
  - Under each team, add and see its **members** (name + color avatar).
  - **Create new task** flow lives here (see "Task draft flow" below).
- **Main area** — the Kanban board with the four columns (To Do, In Progress, In Review, Done).

### Task draft flow (signature interaction)

Task creation is a two-stage, drag-driven flow rather than a plain form:

1. User starts a new task in the sidebar (enters title, optional description, priority, due date).
2. To assign people, the user **drags a member from a team section onto the task draft** — the member "attaches" to the draft (shows as an avatar chip on it). Multiple members can be attached (multi-assignee, per our `task_assignees` join table).
3. When done, the user clicks **"Task ready"** — only then does the task become a real board card that can be dragged into a column. On "Task ready", the task is persisted to Supabase with `status = 'todo'` and its assignees written to `task_assignees`.

This uses two distinct `@dnd-kit` drag interactions: (a) member → task draft (assignment), and (b) task card → column (status change). Both are optimistic.

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
- **Empty** — thoughtful empty states: empty column ("Nothing here yet"), empty board on first launch, empty team.
- **Error** — clear inline error surfaces with a retry affordance, driven by TanStack Query error states.

### Responsive

Board is horizontally scrollable on narrow screens; sidebar collapses to a toggle on mobile. Responsive is a "plus" per the assessment, targeted but not over-invested.

## 8. SQL Migration

The full, runnable schema lives in [`schema.sql`](./schema.sql) — paste into the Supabase SQL Editor and run. It creates all four app tables, indexes, enables RLS on each, and defines owner-only policies (plus the join-table's inherited-scope policies).

Details worth noting in the DDL beyond the tables/RLS already spec'd:

- **`check` constraints** on `tasks.status` (`todo`/`in_progress`/`in_review`/`done`) and `tasks.priority` (`low`/`normal`/`high`) — enforces the allowed values at the DB level, not just in the UI.
- **`on delete cascade`** on every FK to `auth.users`, so "Start fresh" (deleting a guest's rows) cleans up teams, tasks, members, and assignments consistently. Cascades also flow teams → members and tasks/members → assignees.
- **Indexes** on all `user_id` columns plus the join/lookup keys, since every query filters by the guest's id.
- **`default auth.uid()`** on every owner `user_id` column, so client hooks never supply it; RLS `with check` is the sole enforcement rather than also a client footgun.
- **`updated_at` trigger** on `tasks` (`set_updated_at()` bumps it `before update`), enabling recency sort and future optimistic-concurrency checks without a full activity log.
- Policies are dropped-and-recreated so the script can be re-run safely during development.
- **Run-once on a clean project.** The file uses `create table if not exists` and assumes a fresh Supabase project — running it once builds the full schema. It is not written to reconcile column/constraint changes onto tables that already exist; if the schema evolves later, apply changes with explicit `alter table` migrations.

This is the first buildable artifact. The schema can be applied to Supabase and verified independently before any frontend code exists.

---
*Next section to define: project scaffolding / repo structure (Vite + React + TS + Tailwind + Supabase client).*
