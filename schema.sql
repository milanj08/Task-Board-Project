-- ============================================================
-- Task Board — Supabase schema & RLS
-- Run in the Supabase SQL Editor. Safe to re-run (idempotent-ish).
-- Auth: anonymous sign-in; auth.uid() = per-guest-session user id.
-- ============================================================

-- ------------------------------------------------------------
-- Tables
-- ------------------------------------------------------------

create table if not exists public.teams (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  status      text not null default 'todo'
              check (status in ('todo', 'in_progress', 'in_review', 'done')),
  priority    text not null default 'normal'
              check (priority in ('low', 'normal', 'high')),
  due_date    date,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.team_members (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  color      text,
  team_id    uuid not null references public.teams (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.task_assignees (
  task_id        uuid not null references public.tasks (id) on delete cascade,
  team_member_id uuid not null references public.team_members (id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (task_id, team_member_id)
);

-- Helpful indexes for the common lookups
create index if not exists idx_tasks_user_id          on public.tasks (user_id);
create index if not exists idx_teams_user_id          on public.teams (user_id);
create index if not exists idx_team_members_user_id   on public.team_members (user_id);
create index if not exists idx_team_members_team_id   on public.team_members (team_id);
create index if not exists idx_task_assignees_member  on public.task_assignees (team_member_id);

-- ------------------------------------------------------------
-- updated_at trigger (tasks)
-- Auto-bumps tasks.updated_at on every row update.
-- ------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_tasks_updated_at on public.tasks;
create trigger trg_tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------

alter table public.teams          enable row level security;
alter table public.tasks          enable row level security;
alter table public.team_members   enable row level security;
alter table public.task_assignees enable row level security;

-- teams: owner-only
drop policy if exists "teams_select" on public.teams;
create policy "teams_select" on public.teams
  for select using (user_id = auth.uid());

drop policy if exists "teams_insert" on public.teams;
create policy "teams_insert" on public.teams
  for insert with check (user_id = auth.uid());

drop policy if exists "teams_update" on public.teams;
create policy "teams_update" on public.teams
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "teams_delete" on public.teams;
create policy "teams_delete" on public.teams
  for delete using (user_id = auth.uid());

-- tasks: owner-only
drop policy if exists "tasks_select" on public.tasks;
create policy "tasks_select" on public.tasks
  for select using (user_id = auth.uid());

drop policy if exists "tasks_insert" on public.tasks;
create policy "tasks_insert" on public.tasks
  for insert with check (user_id = auth.uid());

drop policy if exists "tasks_update" on public.tasks;
create policy "tasks_update" on public.tasks
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "tasks_delete" on public.tasks;
create policy "tasks_delete" on public.tasks
  for delete using (user_id = auth.uid());

-- team_members: owner-only
drop policy if exists "team_members_select" on public.team_members;
create policy "team_members_select" on public.team_members
  for select using (user_id = auth.uid());

-- insert/update also verify the target team_id belongs to the guest,
-- so a member row can never be attached to another guest's team.
drop policy if exists "team_members_insert" on public.team_members;
create policy "team_members_insert" on public.team_members
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from public.teams t
                where t.id = team_members.team_id and t.user_id = auth.uid())
  );

drop policy if exists "team_members_update" on public.team_members;
create policy "team_members_update" on public.team_members
  for update using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.teams t
                where t.id = team_members.team_id and t.user_id = auth.uid())
  );

drop policy if exists "team_members_delete" on public.team_members;
create policy "team_members_delete" on public.team_members
  for delete using (user_id = auth.uid());

-- task_assignees: no user_id of its own — scope inherited by checking BOTH
-- the task and the team member belong to the requesting guest.
drop policy if exists "task_assignees_select" on public.task_assignees;
create policy "task_assignees_select" on public.task_assignees
  for select using (
    exists (select 1 from public.tasks t
            where t.id = task_assignees.task_id and t.user_id = auth.uid())
    and exists (select 1 from public.team_members m
            where m.id = task_assignees.team_member_id and m.user_id = auth.uid())
  );

drop policy if exists "task_assignees_insert" on public.task_assignees;
create policy "task_assignees_insert" on public.task_assignees
  for insert with check (
    exists (select 1 from public.tasks t
            where t.id = task_assignees.task_id and t.user_id = auth.uid())
    and exists (select 1 from public.team_members m
            where m.id = task_assignees.team_member_id and m.user_id = auth.uid())
  );

drop policy if exists "task_assignees_update" on public.task_assignees;
create policy "task_assignees_update" on public.task_assignees
  for update using (
    exists (select 1 from public.tasks t
            where t.id = task_assignees.task_id and t.user_id = auth.uid())
    and exists (select 1 from public.team_members m
            where m.id = task_assignees.team_member_id and m.user_id = auth.uid())
  );

drop policy if exists "task_assignees_delete" on public.task_assignees;
create policy "task_assignees_delete" on public.task_assignees
  for delete using (
    exists (select 1 from public.tasks t
            where t.id = task_assignees.task_id and t.user_id = auth.uid())
    and exists (select 1 from public.team_members m
            where m.id = task_assignees.team_member_id and m.user_id = auth.uid())
  );
