import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useToast } from '../context/ToastContext'
import { AVATAR_COLORS } from '../lib/avatarColors'
import type { TaskPriority, TaskStatus } from '../types'

// A first-time visitor lands on an empty board, which shows off none of the
// work. This fills it with a small, realistic sample so the columns, badges,
// avatars and drag targets all have something to be.

const SAMPLE_PEOPLE = ['Tyrion Lannister', 'Daenerys Targaryen', 'Jon Snow', 'Arya Stark']
const SAMPLE_TEAM = 'Small Council'

// PostgREST refuses an unfiltered delete, so this is how you say "every row I'm
// allowed to touch" — RLS already limits that to the current guest's own rows.
const NO_TASK_ID = '00000000-0000-0000-0000-000000000000'

// Dates are relative to today so the overdue and due-soon badges always have
// something to show, no matter when the button is pressed.
function dayOffset(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

interface SampleTask {
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  due_date: string | null
  // Names, not indexes — the roster comes back from the insert in whatever
  // order Postgres feels like, so everything is matched up by name below.
  assignees: string[]
}

// Built on each call rather than once at import, so the due dates are computed
// when the button is pressed instead of when the tab was opened.
function sampleTasks(): SampleTask[] {
  return [
    {
      title: 'Draft terms for the Northern alliance',
      description: 'Three houses in, four to go. Bring the map.',
      status: 'todo',
      priority: 'normal',
      due_date: dayOffset(9),
      assignees: ['Jon Snow'],
    },
    {
      title: 'Audit the Iron Bank repayment schedule',
      description: null,
      status: 'todo',
      priority: 'low',
      due_date: null,
      assignees: ['Tyrion Lannister'],
    },
    {
      title: 'Repair the gate at Castle Black',
      description: 'The winch has been jammed since the last raid.',
      status: 'in_progress',
      priority: 'high',
      due_date: dayOffset(-2),
      assignees: ['Jon Snow', 'Arya Stark'],
    },
    {
      title: 'Secure grain shipments before winter',
      description: null,
      status: 'in_progress',
      priority: 'normal',
      due_date: dayOffset(1),
      assignees: ['Tyrion Lannister', 'Daenerys Targaryen'],
    },
    {
      title: "Review the dragon flight path over King's Landing",
      description: 'The smallfolk have filed complaints. Again.',
      status: 'in_review',
      priority: 'high',
      due_date: dayOffset(2),
      assignees: ['Daenerys Targaryen'],
    },
    {
      title: 'Circulate the Small Council minutes',
      description: null,
      status: 'done',
      priority: 'normal',
      due_date: dayOffset(-6),
      assignees: ['Tyrion Lannister'],
    },
    {
      title: 'Replace the throne room banners',
      description: null,
      status: 'done',
      priority: 'low',
      due_date: null,
      assignees: ['Arya Stark', 'Daenerys Targaryen'],
    },
  ]
}

export function useLoadSampleBoard() {
  const qc = useQueryClient()
  const { notify } = useToast()
  return useMutation({
    mutationFn: async () => {
      // Roster first — the tasks and the team both need these ids.
      const { data: members, error: membersError } = await supabase
        .from('members')
        .insert(
          SAMPLE_PEOPLE.map((name, i) => ({
            name,
            color: AVATAR_COLORS[i % AVATAR_COLORS.length],
          })),
        )
        .select()
      if (membersError) throw membersError
      const memberIdByName = new Map(members.map((m) => [m.name, m.id]))

      const { data: team, error: teamError } = await supabase
        .from('teams')
        .insert({ name: SAMPLE_TEAM })
        .select()
        .single()
      if (teamError) throw teamError

      const { error: rosterError } = await supabase
        .from('team_members')
        .insert(members.map((m) => ({ team_id: team.id, member_id: m.id })))
      if (rosterError) throw rosterError

      // One position per card, spaced a second apart, so they keep the order
      // they're listed in above. Same epoch-seconds unit as everything else.
      const base = Date.now() / 1000
      const specs = sampleTasks()
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .insert(
          specs.map((s, i) => ({
            title: s.title,
            description: s.description,
            status: s.status,
            priority: s.priority,
            due_date: s.due_date,
            position: base + i,
          })),
        )
        .select()
      if (tasksError) throw tasksError
      const taskIdByTitle = new Map(tasks.map((t) => [t.title, t.id]))

      const links = specs.flatMap((s) => {
        const taskId = taskIdByTitle.get(s.title)
        if (!taskId) return []
        return s.assignees.flatMap((name) => {
          const memberId = memberIdByName.get(name)
          return memberId ? [{ task_id: taskId, member_id: memberId }] : []
        })
      })
      const { error: assigneesError } = await supabase.from('task_assignees').insert(links)
      if (assigneesError) throw assigneesError
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tasks'] })
      void qc.invalidateQueries({ queryKey: ['teams'] })
      void qc.invalidateQueries({ queryKey: ['members'] })
    },
    onError: (e) => {
      console.error('Load sample board failed:', e)
      notify('Could not load the sample board. Try again.')
    },
  })
}

export function useClearBoard() {
  const qc = useQueryClient()
  const { notify } = useToast()
  return useMutation({
    mutationFn: async () => {
      // Only these three tables need deleting — team_members and task_assignees
      // cascade from the rows they link. RLS scopes each delete to this guest.
      for (const table of ['tasks', 'teams', 'members'] as const) {
        const { error } = await supabase.from(table).delete().neq('id', NO_TASK_ID)
        if (error) throw error
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tasks'] })
      void qc.invalidateQueries({ queryKey: ['teams'] })
      void qc.invalidateQueries({ queryKey: ['members'] })
    },
    onError: (e) => {
      console.error('Clear board failed:', e)
      notify('Could not clear the board. Try again.')
    },
  })
}
