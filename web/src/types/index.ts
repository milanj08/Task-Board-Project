import type { Database } from './database.types'

export type { Database } from './database.types'
export type { TaskStatus, TaskPriority } from './database.types'

type Tables = Database['public']['Tables']

// Row types (what a select returns)
export type Team = Tables['teams']['Row']
export type Task = Tables['tasks']['Row']
export type TeamMember = Tables['team_members']['Row']
export type TaskAssignee = Tables['task_assignees']['Row']

// Insert types (what create() accepts)
export type TeamInsert = Tables['teams']['Insert']
export type TaskInsert = Tables['tasks']['Insert']
export type TeamMemberInsert = Tables['team_members']['Insert']
export type TaskAssigneeInsert = Tables['task_assignees']['Insert']

// A task with its assigned members joined in (used on the board cards)
export type TaskWithAssignees = Task & { assignees: TeamMember[] }
