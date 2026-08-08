# Task Board

A Kanban board where you drag tasks across four columns — To Do, In Progress, In
Review, Done — and drag people onto tasks to assign them. React + TypeScript on
the front, Supabase (Postgres) behind it, with every table locked down by Row
Level Security so each visitor only ever sees their own data.

**Live:** https://task-board-project-theta.vercel.app/

No signup. The app calls Supabase's anonymous auth on first load, so you get a
session and a board immediately, and the same board again next time you open it
in that browser.

---

## What it does

- **Four-column board** with drag-and-drop between columns and reordering within
  a column.
- **A roster and teams in the sidebar.** People live in one canonical roster;
  teams are groups you drag people into. A person can be on several teams, or
  none.
- **Assignment by dragging.** Drag a person — or a whole team at once — onto a
  task and they attach as avatar chips. Tasks can have multiple assignees.
- **Two-stage task creation.** A new task starts as a draft at the top of To Do.
  You fill in title, description, priority and due date, drag assignees onto it,
  and only on "Add task" does it become a real card.
- **Due-date badges** — overdue, due soon (within two days), or later.
- **Loading, empty and error states.** Skeleton cards while tasks load,
  column-specific empty copy, and toasts when a write fails.
- **Mobile support.** The board scrolls horizontally and the sidebar becomes an
  overlay drawer.

---

## Running it locally

You need Node 22 or newer (Vercel builds this on Node 24) and a free Supabase
account. From a clean clone:

```bash
git clone https://github.com/milanj08/Task-Board-Project.git
cd Task-Board-Project
```

### 1. Create a Supabase project and apply the schema

Create a new project at [supabase.com](https://supabase.com). Once it's ready,
open the **SQL Editor**, paste in the contents of [`schema.sql`](./schema.sql),
and run it. That creates all five tables, their indexes, enables RLS on each,
and defines the policies.

Then enable anonymous sign-in: **Authentication → Sign In / Providers → Anonymous
sign-ins → on**. Without this the app cannot create a session and the board will
show a session error.

> `schema.sql` uses `create table if not exists` and expects a fresh project. It
> builds the whole schema in one run. It is not written to migrate an existing
> database — see [Known gaps](#known-gaps).

### 2. Configure the app

```bash
cd web
cp .env.example .env.local
```

Fill in `.env.local` from **Project Settings → Data API**:

- `VITE_SUPABASE_URL` — your project URL
- `VITE_SUPABASE_ANON_KEY` — the publishable (anon) key

The publishable key is meant to be in the browser; RLS is what protects the
data. The `service_role` key is never used here and must not go in this file.

### 3. Install and run

```bash
npm install
npm run dev
```

The board opens at the URL Vite prints. Other scripts:

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with HMR |
| `npm run build` | Type-check (`tsc -b`) then production build |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Oxlint |
| `npm test` | Vitest |

---

## How it's put together

```
.
├── schema.sql                Supabase migration — tables, indexes, RLS policies
├── SPEC.md                   data model and design reasoning
└── web/                      the Vite app (Vercel root directory = web)
    └── src/
        ├── main.tsx          QueryClientProvider + AuthProvider at the root
        ├── App.tsx           DndContext, collision routing, mobile sidebar
        ├── auth/             anonymous session bootstrap
        ├── components/       Sidebar, Board, Column, TaskCard, ...
        ├── context/          task draft, toasts, completed-task tally
        ├── hooks/            TanStack Query hooks — tasks, teams, members
        ├── lib/              supabase client, position math, due dates, palette
        └── types/            database types mirroring schema.sql
```

There is no backend service. The React app talks to Supabase directly and RLS
does the authorization, which is why the whole thing deploys as a static build.

### A few decisions worth explaining

**Ordering uses fractional positions, not integer indexes.** `tasks.position` is
a `double precision`. Dropping a card between two others sets its position to
the midpoint of its neighbours' (`lib/position.ts`), so a move writes exactly one
row instead of renumbering everything below it. Positions are all on one unit —
seconds since the epoch — which is also what the column's default uses, so a row
inserted by the database default still sorts correctly against rows positioned
by the client.

**Components never call Supabase.** Every read and write goes through a hook in
`hooks/`. Each mutation invalidates or optimistically updates the relevant
query, and failures surface as a toast. Drag-and-drop is optimistic: the card
moves the instant you drop it, and TanStack Query rolls it back if the write
fails.

**The join tables have no `user_id` column.** `team_members` and `task_assignees`
inherit their scope from the rows they link. Their policies check that *both*
sides belong to the current session:

```sql
exists (select 1 from tasks t   where t.id = task_assignees.task_id   and t.user_id = auth.uid())
and
exists (select 1 from members m where m.id = task_assignees.member_id and m.user_id = auth.uid())
```

So you can't attach your task to someone else's roster entry, or someone else's
task to yours, even by guessing a UUID. Adding a `user_id` column here would
have been simpler to query but would let those two facts drift apart — a link
row could claim an owner that disagrees with the rows it points at.

**Owner columns default to `auth.uid()`.** No hook ever sets `user_id` by hand,
so there's no client-side path to setting it wrong; the RLS `with check` is the
only thing that decides.

**No Realtime subscriptions.** Every board has exactly one owner, so there is no
second client to sync with. Subscriptions would add lifecycle and reconciliation
work for no behaviour change.

[`SPEC.md`](./SPEC.md) has the full schema, every RLS policy, and the reasoning
behind the data model.

---

## Tests

```bash
cd web && npm test
```

12 Vitest cases covering `lib/position.ts` — the fractional-ordering math behind
drag-and-drop. That's the part with real edge cases: dropping at the top of a
column, at the bottom, between two neighbours, and onto a different column.

---

## Known gaps

Things I know are missing or imperfect, and why:

- **No CI.** The tests exist but nothing runs them on push. This is the next
  thing I'd add.
- **Test coverage is narrow.** Only `position.ts` is covered. `dueDate.ts`,
  `avatarColors.ts` and `supabaseErrors.ts` are pure functions and equally
  testable — I just haven't written them. There are no component or
  integration tests at all.
- **A new board starts completely empty.** A first-time visitor sees four empty
  columns and has to build everything by hand to see the app work. A "load a
  sample board" button on the empty state would fix this.
- **A gap between two cards can run out of room.** Positions are doubles and
  each drop halves the gap, so dropping into the same one about fifty times
  exhausts it. The board detects that and refuses the drop — the card animates
  back where it came from rather than taking a duplicate position and sorting
  unpredictably. Refusing is the safe answer, not the right one; the real fix is
  renumbering that column so the drop can succeed.
- **RLS is not tested automatically.** The policies were verified by hand in the
  Supabase SQL editor — querying as one session and confirming another
  session's rows were invisible. Nothing re-checks that on change.
- **`schema.sql` is run-once, not a migration.** Applying it to a project that
  already has these tables won't reconcile column or constraint changes. Real
  migrations would need explicit `alter table` steps.
- **There's no way to start a new board.** The anonymous session persists in
  `localStorage`, so the only way to get a fresh identity is to clear browser
  storage or switch browsers. An in-app reset would be a small addition.
- **Sessions are per-browser.** Anonymous auth means no account, so a board
  can't follow you to another device. Real auth would change that, and the
  schema wouldn't need to change — `user_id` already carries the ownership.
- **Deleting a member is not undoable.** Removal is behind a two-step confirm,
  but once it's gone, the cascade removes their team links and task
  assignments with it.
- **It ships as one 540 kB bundle** (155 kB gzipped) and the build warns about
  it. Everything loads up front with no code splitting. Fine at this size, but
  route- or component-level `import()` is where I'd start if it grew.

---

## Built with

React 19 · TypeScript 6 · Vite 8 · Tailwind v4 · Supabase (Postgres, anonymous
auth, RLS) · TanStack Query · @dnd-kit · date-fns · lucide-react · Vitest ·
deployed on Vercel with `web/` as the root directory.
