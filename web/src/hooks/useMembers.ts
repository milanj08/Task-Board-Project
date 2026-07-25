import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useToast } from '../context/ToastContext'
import type { Member } from '../types'

const MEMBERS_KEY = ['members'] as const

// The full roster of people (unique names), independent of teams.
export function useMembers() {
  return useQuery({
    queryKey: MEMBERS_KEY,
    queryFn: async (): Promise<Member[]> => {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .order('name', { ascending: true })
      if (error) throw error
      return data
    },
  })
}

export function useCreateMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name: string; color: string }): Promise<Member> => {
      const { data, error } = await supabase
        .from('members')
        .insert({ name: input.name, color: input.color })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: MEMBERS_KEY }),
    onError: (e) => console.error('Create member failed:', e),
  })
}

// Deleting a person removes them from every team and task (DB cascades).
export function useDeleteMember() {
  const qc = useQueryClient()
  const { notify } = useToast()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('members').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: MEMBERS_KEY })
      void qc.invalidateQueries({ queryKey: ['teams'] })
      void qc.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: (e) => {
      console.error('Delete member failed:', e)
      notify('Could not remove that person. Try again.')
    },
  })
}
