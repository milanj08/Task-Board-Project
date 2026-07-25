import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useToast } from '../context/ToastContext'
import { computeTop } from '../lib/position'
import type {
  Task,
  TaskStatus,
  TaskPriority,
  Member,
  TaskWithAssignees,
} from '../types'

const TASKS_KEY = ['tasks'] as const

// Shape of the nested select before we flatten assignees.
type TaskRow = Task & {
  task_assignees: { members: Member | null }[] | null
}

// Fetch the guest's tasks, each with its assigned people joined in.
export function useTasks() {
  return useQuery({
    queryKey: TASKS_KEY,
    queryFn: async (): Promise<TaskWithAssignees[]> => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*, task_assignees(members(*))')
        .order('position', { ascending: true })
      if (error) throw error
      return ((data ?? []) as unknown as TaskRow[]).map((row) => {
        const { task_assignees, ...task } = row
        const assignees = (task_assignees ?? [])
          .map((ta) => ta.members)
          .filter((m): m is Member => m !== null)
        return { ...task, assignees }
      })
    },
  })
}

// Create a task and (optionally) its assignee links. user_id defaults to auth.uid().
export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      title: string
      status: TaskStatus
      description?: string | null
      priority?: TaskPriority
      due_date?: string | null
      assigneeIds?: string[]
    }): Promise<Task> => {
      const existing = qc.getQueryData<TaskWithAssignees[]>(TASKS_KEY) ?? []
      const { data: task, error } = await supabase
        .from('tasks')
        .insert({
          title: input.title,
          status: input.status,
          description: input.description ?? null,
          priority: input.priority ?? 'normal',
          due_date: input.due_date ?? null,
          position: computeTop(existing),
        })
        .select()
        .single()
      if (error) throw error

      const ids = input.assigneeIds ?? []
      if (ids.length > 0) {
        const rows = ids.map((member_id) => ({ task_id: task.id, member_id }))
        const { error: assignErr } = await supabase.from('task_assignees').insert(rows)
        if (assignErr) throw assignErr
      }
      return task
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: TASKS_KEY }),
    onError: (e) => console.error('Create task failed:', e),
  })
}

// Delete a task. Optimistic: removes it from the board immediately.
export function useDeleteTask() {
  const qc = useQueryClient()
  const { notify } = useToast()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id)
      if (error) throw error
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: TASKS_KEY })
      const previous = qc.getQueryData<TaskWithAssignees[]>(TASKS_KEY)
      qc.setQueryData<TaskWithAssignees[]>(TASKS_KEY, (old) => old?.filter((t) => t.id !== id))
      return { previous }
    },
    onError: (err, _id, ctx) => {
      console.error('Delete task failed:', err)
      if (ctx?.previous) qc.setQueryData(TASKS_KEY, ctx.previous)
      notify('Could not delete that task. Try again.')
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: TASKS_KEY }),
  })
}

// Move a task to a status + position (drag reorder / cross-column / the card's
// "move forward" button — all go through this one hook now). Optimistic.
export function useMoveTask() {
  const qc = useQueryClient()
  const { notify } = useToast()
  return useMutation({
    mutationFn: async ({ id, status, position }: { id: string; status: TaskStatus; position: number }) => {
      const { error } = await supabase.from('tasks').update({ status, position }).eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, status, position }) => {
      await qc.cancelQueries({ queryKey: TASKS_KEY })
      const previous = qc.getQueryData<TaskWithAssignees[]>(TASKS_KEY)
      qc.setQueryData<TaskWithAssignees[]>(TASKS_KEY, (old) =>
        old?.map((t) => (t.id === id ? { ...t, status, position } : t)),
      )
      return { previous }
    },
    onError: (err, _vars, ctx) => {
      console.error('Move task failed:', err)
      if (ctx?.previous) qc.setQueryData(TASKS_KEY, ctx.previous)
      notify('Could not move that task. Try again.')
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: TASKS_KEY }),
  })
}

// Add one or more assignees to an existing task (ignores anyone already on it).
export function useAddAssignees() {
  const qc = useQueryClient()
  const { notify } = useToast()
  return useMutation({
    mutationFn: async ({ taskId, memberIds }: { taskId: string; memberIds: string[] }) => {
      if (memberIds.length === 0) return
      const rows = memberIds.map((member_id) => ({ task_id: taskId, member_id }))
      const { error } = await supabase
        .from('task_assignees')
        .upsert(rows, { onConflict: 'task_id,member_id', ignoreDuplicates: true })
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: TASKS_KEY }),
    onError: (e) => {
      console.error('Add assignees failed:', e)
      notify('Could not assign that person. Try again.')
    },
  })
}

// Remove a single assignee link from a task.
export function useRemoveAssignee() {
  const qc = useQueryClient()
  const { notify } = useToast()
  return useMutation({
    mutationFn: async ({ taskId, memberId }: { taskId: string; memberId: string }) => {
      const { error } = await supabase
        .from('task_assignees')
        .delete()
        .eq('task_id', taskId)
        .eq('member_id', memberId)
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: TASKS_KEY }),
    onError: (e) => {
      console.error('Remove assignee failed:', e)
      notify('Could not remove that assignee. Try again.')
    },
  })
}
