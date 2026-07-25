import type { Database, TaskPriority } from './database.types'

export type { TaskStatus, TaskPriority } from './database.types'

type Tables = Database['public']['Tables']

// Row types (what a select returns)
export type Team = Tables['teams']['Row']
export type Task = Tables['tasks']['Row']
export type Member = Tables['members']['Row']

// A task with its assigned people joined in (used on the board cards)
export type TaskWithAssignees = Task & { assignees: Member[] }

// A team with its people joined in (used in the sidebar)
export type TeamWithMembers = Team & { members: Member[] }

// In-progress task being composed before it hits the board.
export interface TaskDraft {
  title: string
  description: string
  priority: TaskPriority
  due_date: string
  assignees: Member[]
}
