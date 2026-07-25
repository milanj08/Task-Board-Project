import { describe, expect, it } from 'vitest'
import { computeEnd, computeMove, computeTop } from './position'
import type { TaskStatus, TaskWithAssignees } from '../types'

let nextId = 0
function makeTask(overrides: Partial<TaskWithAssignees> & { position: number }): TaskWithAssignees {
  nextId += 1
  return {
    id: `task-${nextId}`,
    title: 'Task',
    description: null,
    status: 'todo',
    priority: 'normal',
    due_date: null,
    user_id: 'guest',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    assignees: [],
    ...overrides,
  }
}

describe('computeTop', () => {
  it('returns a position before every existing task', () => {
    const tasks = [makeTask({ position: 5 }), makeTask({ position: 10 }), makeTask({ position: 3 })]
    expect(computeTop(tasks)).toBe(2)
  })

  it('returns a finite number when there are no tasks yet', () => {
    expect(Number.isFinite(computeTop([]))).toBe(true)
  })
})

describe('computeEnd', () => {
  it('returns a position after the last task in that column', () => {
    const tasks = [
      makeTask({ status: 'todo', position: 1 }),
      makeTask({ status: 'todo', position: 2 }),
      makeTask({ status: 'todo', position: 3 }),
    ]
    expect(computeEnd(tasks, 'todo')).toBe(4)
  })

  it('ignores tasks in other columns', () => {
    const tasks = [
      makeTask({ status: 'todo', position: 1 }),
      makeTask({ status: 'done', position: 100 }),
    ]
    expect(computeEnd(tasks, 'todo')).toBe(2)
  })

  it('excludes the given task id from the max, so moving a task to the end of its own column works', () => {
    const highest = makeTask({ status: 'todo', position: 5 })
    const tasks = [makeTask({ status: 'todo', position: 1 }), highest]
    expect(computeEnd(tasks, 'todo', highest.id)).toBe(2)
  })

  it('returns a finite number for an empty column', () => {
    expect(Number.isFinite(computeEnd([], 'todo'))).toBe(true)
  })
})

describe('computeMove', () => {
  it('dropping on a column appends the task to the end of that column', () => {
    const active = makeTask({ status: 'todo', position: 0 })
    const tasks = [active, makeTask({ status: 'in_progress', position: 1 }), makeTask({ status: 'in_progress', position: 2 })]
    const result = computeMove(tasks, active, { id: 'in_progress', type: 'column' })
    expect(result).toEqual({ status: 'in_progress' satisfies TaskStatus, position: 3 })
  })

  it('dropping on itself is a no-op', () => {
    const active = makeTask({ status: 'todo', position: 0 })
    const result = computeMove([active], active, { id: active.id, type: 'task' })
    expect(result).toBeNull()
  })

  it('dropping on a task that no longer exists is a no-op', () => {
    const active = makeTask({ status: 'todo', position: 0 })
    const result = computeMove([active], active, { id: 'missing', type: 'task' })
    expect(result).toBeNull()
  })

  it('reordering within the same column places the task between its new neighbors', () => {
    const a = makeTask({ status: 'todo', position: 1 })
    const b = makeTask({ status: 'todo', position: 2 })
    const c = makeTask({ status: 'todo', position: 3 })
    // Drag `a` onto `b`: visual order becomes b, a, c — `a` should land between them.
    const result = computeMove([a, b, c], a, { id: b.id, type: 'task' })
    expect(result).toEqual({ status: 'todo', position: 2.5 })
  })

  it('dropping on a task in a different column inserts before that task', () => {
    const active = makeTask({ status: 'todo', position: 0 })
    const o1 = makeTask({ status: 'in_progress', position: 1 })
    const o2 = makeTask({ status: 'in_progress', position: 2 })
    const o3 = makeTask({ status: 'in_progress', position: 3 })
    const result = computeMove([active, o1, o2, o3], active, { id: o2.id, type: 'task' })
    expect(result).toEqual({ status: 'in_progress', position: 1.5 })
  })

  it('dropping on the first task of a different column places it before that task', () => {
    const active = makeTask({ status: 'todo', position: 0 })
    const o1 = makeTask({ status: 'in_progress', position: 1 })
    const o2 = makeTask({ status: 'in_progress', position: 2 })
    const result = computeMove([active, o1, o2], active, { id: o1.id, type: 'task' })
    expect(result).toEqual({ status: 'in_progress', position: 0 })
  })
})
