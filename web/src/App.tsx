import { useEffect, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  pointerWithin,
} from '@dnd-kit/core'
import type {
  DragStartEvent,
  DragMoveEvent,
  DragEndEvent,
  DropAnimation,
  CollisionDetection,
} from '@dnd-kit/core'
import { Menu } from 'lucide-react'
import { AuthGate } from './components/AuthGate'
import { Board } from './components/Board'
import { Sidebar } from './components/Sidebar'
import { TaskCard } from './components/TaskCard'
import { Avatar } from './components/Avatar'
import { NewTaskProvider, useNewTask } from './context/NewTaskContext'
import { ToastProvider } from './context/ToastContext'
import { useTasks, useMoveTask, useAddAssignees } from './hooks/useTasks'
import { useAddMemberToTeam } from './hooks/useTeams'
import { computeMove } from './lib/position'
import type { TaskWithAssignees, TeamWithMembers, Member } from './types'

// Return-to-origin tween — played only when a card is dropped in an invalid spot.
const bounceBack: DropAnimation = {
  duration: 250,
  easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
}

type ActiveDrag =
  | { type: 'task'; task: TaskWithAssignees }
  | { type: 'member'; member: Member }
  | { type: 'team'; team: TeamWithMembers }

// Debounce for closing the drawer (never for opening it — that's instant).
// Without this, the very first, tiny activation move every drag starts with
// (needed just to satisfy the 5px drag threshold) almost always lands on
// `over: null`, since it's nowhere near any real target yet — closing
// immediately on that would flip boardVisible on before the user has even
// begun heading anywhere, permanently excluding team-drop for the rest of
// that drag (mutual exclusion means there's no path back). The debounce gives
// genuine in-sidebar travel time to reach a team before we commit to closing.
const SIDEBAR_CLOSE_DELAY_MS = 200

// See committedToBoard below — how far right (from pickup) a member/team drag
// has to move before we treat it as irreversibly headed for the board.
const RIGHTWARD_COMMIT_PX = 60

// Matches Tailwind's `md` breakpoint (the same one Sidebar uses to switch
// between overlay-drawer and static-column behavior).
function useIsMobileLayout(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches,
  )
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)')
    const handler = () => setIsMobile(mql.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])
  return isMobile
}

function Workspace() {
  const { addAssignees } = useNewTask()
  const { data: tasks } = useTasks()
  const moveTask = useMoveTask()
  const addToTask = useAddAssignees()
  const addToTeam = useAddMemberToTeam()
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null)
  const [dropAnimation, setDropAnimation] = useState<DropAnimation | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const isMobileLayout = useIsMobileLayout()
  const sidebarCloseTimer = useRef<number | null>(null)
  // Once a member/team drag has moved this far right of where it was picked up,
  // treat it as committed to the board — moving right only ever means "heading
  // for a task," never "heading for a team" (teams sit in the same vertical
  // list as members, so reaching one takes near-zero rightward movement). Once
  // committed, team-drop stops being a valid target for the rest of this drag,
  // full stop — no reopening the drawer just because the pointer's current
  // position happens to spatially coincide with a team card underneath.
  const committedToBoard = useRef(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  )

  // Route drags by type: cards target columns + other cards (reorder); people
  // target the new-task draft + open task cards. Prefer a card over its column
  // so reordering lands between cards, not just at the column end.
  //
  // On mobile, the sidebar drawer overlays the board rather than pushing it
  // aside, so the board's droppables stay registered at their normal screen
  // coordinates directly underneath the open drawer. While it's open, board
  // targets are invisible and excluded — otherwise a drag path still inside
  // the drawer could land on an unseen board element it happens to overlap.
  // team-drop zones are NEVER excluded, though (even once the drawer is
  // closing): they're the one thing a member/team drag can always legally
  // land on, and gating them the same way would risk permanently locking them
  // out for a drag that briefly has no target (e.g. the tiny first move every
  // drag makes just to clear the activation threshold).
  const collisionDetection: CollisionDetection = (args) => {
    const type = args.active.data.current?.type
    const boardVisible = !isMobileLayout || !sidebarOpen
    const teamDropAllowed = !isMobileLayout || !committedToBoard.current
    const filtered = args.droppableContainers.filter((c) => {
      if (c.disabled) return false
      const dtype = c.data.current?.type
      if (type === 'task') return dtype === 'column' || dtype === 'task'
      if (type === 'member') {
        return (teamDropAllowed && dtype === 'team-drop') || (boardVisible && (dtype === 'assign' || String(c.id) === 'new-task-draft'))
      }
      // whole-team drag: only the new-task draft / open cards, never another team
      return boardVisible && (dtype === 'assign' || String(c.id) === 'new-task-draft')
    })
    const collisions = pointerWithin({ ...args, droppableContainers: filtered })
    const typeOf = (id: string | number) => filtered.find((c) => c.id === id)?.data.current?.type
    if (type === 'task') {
      return [...collisions].sort(
        (a, b) => (typeOf(a.id) === 'task' ? 0 : 1) - (typeOf(b.id) === 'task' ? 0 : 1),
      )
    }
    if (type === 'member') {
      // An open task card or a team wins over the new-task draft when they overlap.
      const rank = (id: string | number) =>
        typeOf(id) === 'assign' || typeOf(id) === 'team-drop' ? 0 : 1
      return [...collisions].sort((a, b) => rank(a.id) - rank(b.id))
    }
    return collisions
  }

  function handleDragStart(e: DragStartEvent) {
    setActiveDrag((e.active.data.current as ActiveDrag) ?? null)
    committedToBoard.current = false
  }

  function clearSidebarCloseTimer() {
    if (sidebarCloseTimer.current != null) {
      window.clearTimeout(sidebarCloseTimer.current)
      sidebarCloseTimer.current = null
    }
  }

  function handleDragMove(e: DragMoveEvent) {
    // Members/teams get dragged both within the sidebar (onto a team) and out of
    // it (onto the board) — open instantly on a genuine team-drop hover (never
    // miss one), but close only after a short debounce, so the drag's initial
    // activation move (and brief gaps between team rows) don't trigger it.
    const type = e.active.data.current?.type
    if (type !== 'member' && type !== 'team') return
    if (committedToBoard.current) return // one-way: never reconsider once committed
    if (e.delta.x > RIGHTWARD_COMMIT_PX) {
      committedToBoard.current = true
      clearSidebarCloseTimer()
      setSidebarOpen(false)
      return
    }
    if (e.over?.data.current?.type === 'team-drop') {
      clearSidebarCloseTimer()
      setSidebarOpen(true)
      return
    }
    if (sidebarCloseTimer.current == null) {
      sidebarCloseTimer.current = window.setTimeout(() => {
        sidebarCloseTimer.current = null
        setSidebarOpen(false)
      }, SIDEBAR_CLOSE_DELAY_MS)
    }
  }

  function handleDragEnd(e: DragEndEvent) {
    clearSidebarCloseTimer()
    const drag = activeDrag
    setActiveDrag(null)
    const over = e.over

    if (!drag) return

    if (drag.type === 'task') {
      if (!over) {
        setDropAnimation(bounceBack)
        return
      }
      const move = computeMove(tasks ?? [], drag.task, {
        id: String(over.id),
        type: over.data.current?.type as string | undefined,
      })
      setDropAnimation(null)
      if (move && (move.status !== drag.task.status || move.position !== drag.task.position)) {
        moveTask.mutate({ id: drag.task.id, status: move.status, position: move.position })
      }
      return
    }

    // member / team -> the new-task draft, an open task card, or a team
    setDropAnimation(null)
    if (!over) return
    const overData = over.data.current ?? {}
    const members = drag.type === 'member' ? [drag.member] : drag.team.members
    if (over.id === 'new-task-draft') {
      addAssignees(members)
    } else if (overData.type === 'assign') {
      addToTask.mutate({
        taskId: overData.taskId as string,
        memberIds: members.map((m) => m.id),
      })
    } else if (overData.type === 'team-drop' && drag.type === 'member') {
      addToTeam.mutate({ teamId: overData.teamId as string, memberId: drag.member.id })
    }
  }

  function handleDragCancel() {
    clearSidebarCloseTimer()
    setActiveDrag(null)
    setDropAnimation(bounceBack)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex h-screen bg-canvas">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex items-center gap-3 border-b border-line px-4 py-3 md:hidden">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
              className="rounded-lg border border-line p-1.5 text-muted transition hover:text-ink"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
            <h1 className="font-display text-xl text-ink">Task Board</h1>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <Board />
          </div>
        </main>
      </div>

      <DragOverlay dropAnimation={dropAnimation}>
        {activeDrag?.type === 'task' && <TaskCard task={activeDrag.task} />}
        {activeDrag?.type === 'member' && (
          <div className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2 py-1">
            <Avatar name={activeDrag.member.name} color={activeDrag.member.color} />
            <span className="text-sm text-ink">{activeDrag.member.name}</span>
          </div>
        )}
        {activeDrag?.type === 'team' && (
          <div className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-1.5">
            <span className="flex -space-x-1.5">
              {activeDrag.team.members.slice(0, 4).map((m) => (
                <Avatar
                  key={m.id}
                  name={m.name}
                  color={m.color}
                  size={20}
                  className="ring-2 ring-surface"
                />
              ))}
            </span>
            <span className="text-sm text-ink">
              {activeDrag.team.name} · {activeDrag.team.members.length}
            </span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

export default function App() {
  return (
    <AuthGate>
      <ToastProvider>
        <NewTaskProvider>
          <Workspace />
        </NewTaskProvider>
      </ToastProvider>
    </AuthGate>
  )
}
