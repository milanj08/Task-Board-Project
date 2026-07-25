import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useToast } from '../context/ToastContext'
import type { Team, Member, TeamWithMembers } from '../types'

const TEAMS_KEY = ['teams'] as const

// Fetch the guest's teams, each with its members (via the join) nested in.
export function useTeams() {
  return useQuery({
    queryKey: TEAMS_KEY,
    queryFn: async (): Promise<TeamWithMembers[]> => {
      const { data, error } = await supabase
        .from('teams')
        .select('*, team_members(members(*))')
        .order('created_at', { ascending: true })
      if (error) throw error
      type Row = Team & { team_members: { members: Member | null }[] | null }
      return ((data ?? []) as unknown as Row[]).map((row) => {
        const { team_members, ...team } = row
        const members = (team_members ?? [])
          .map((tm) => tm.members)
          .filter((m): m is Member => m !== null)
        return { ...team, members }
      })
    },
  })
}

export function useCreateTeam() {
  const qc = useQueryClient()
  const { notify } = useToast()
  return useMutation({
    mutationFn: async (input: { name: string }): Promise<Team> => {
      const { data, error } = await supabase
        .from('teams')
        .insert({ name: input.name })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: TEAMS_KEY }),
    onError: (e) => {
      console.error('Create team failed:', e)
      notify('Could not create that team. Try again.')
    },
  })
}

export function useDeleteTeam() {
  const qc = useQueryClient()
  const { notify } = useToast()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('teams').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: TEAMS_KEY }),
    onError: (e) => {
      console.error('Delete team failed:', e)
      notify('Could not delete that team. Try again.')
    },
  })
}

// Add an existing roster member to a team (ignores if already on it).
export function useAddMemberToTeam() {
  const qc = useQueryClient()
  const { notify } = useToast()
  return useMutation({
    mutationFn: async ({ teamId, memberId }: { teamId: string; memberId: string }) => {
      const { error } = await supabase
        .from('team_members')
        .upsert({ team_id: teamId, member_id: memberId }, {
          onConflict: 'team_id,member_id',
          ignoreDuplicates: true,
        })
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: TEAMS_KEY }),
    onError: (e) => {
      console.error('Add member to team failed:', e)
      notify('Could not add that person to the team. Try again.')
    },
  })
}

// Remove a member from a team (the person stays in the roster).
export function useRemoveMemberFromTeam() {
  const qc = useQueryClient()
  const { notify } = useToast()
  return useMutation({
    mutationFn: async ({ teamId, memberId }: { teamId: string; memberId: string }) => {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('team_id', teamId)
        .eq('member_id', memberId)
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: TEAMS_KEY }),
    onError: (e) => {
      console.error('Remove member from team failed:', e)
      notify('Could not remove that person from the team. Try again.')
    },
  })
}
