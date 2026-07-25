import { createContext, useContext, useState } from 'react'
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import type { TaskDraft, Member } from '../types'
import { useCreateTask } from '../hooks/useTasks'

const emptyDraft: TaskDraft = {
  title: '',
  description: '',
  priority: 'normal',
  due_date: '',
  assignees: [],
}

interface NewTaskValue {
  draft: TaskDraft
  setDraft: Dispatch<SetStateAction<TaskDraft>>
  addAssignees: (members: Member[]) => void
  removeAssignee: (id: string) => void
  submit: () => void
  reset: () => void
  pending: boolean
  error: Error | null
}

const NewTaskContext = createContext<NewTaskValue | undefined>(undefined)

export function NewTaskProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<TaskDraft>(emptyDraft)
  const createTask = useCreateTask()

  function addAssignees(members: Member[]) {
    setDraft((d) => {
      const existing = new Set(d.assignees.map((a) => a.id))
      const toAdd = members.filter((m) => !existing.has(m.id))
      return toAdd.length ? { ...d, assignees: [...d.assignees, ...toAdd] } : d
    })
  }

  function removeAssignee(id: string) {
    setDraft((d) => ({ ...d, assignees: d.assignees.filter((a) => a.id !== id) }))
  }

  function reset() {
    setDraft(emptyDraft)
  }

  function submit() {
    const title = draft.title.trim()
    if (!title) return
    createTask.mutate(
      {
        title,
        status: 'todo',
        description: draft.description.trim() || null,
        priority: draft.priority,
        due_date: draft.due_date || null,
        assigneeIds: draft.assignees.map((a) => a.id),
      },
      { onSuccess: reset },
    )
  }

  return (
    <NewTaskContext.Provider
      value={{
        draft,
        setDraft,
        addAssignees,
        removeAssignee,
        submit,
        reset,
        pending: createTask.isPending,
        error: createTask.error,
      }}
    >
      {children}
    </NewTaskContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNewTask(): NewTaskValue {
  const ctx = useContext(NewTaskContext)
  if (!ctx) throw new Error('useNewTask must be used within a NewTaskProvider')
  return ctx
}
