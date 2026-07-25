// Hand-written to mirror schema.sql. Kept in sync manually (no Supabase CLI).
// status/priority use string-literal unions so invalid values fail at compile time.

export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done'
export type TaskPriority = 'low' | 'normal' | 'high'

export interface Database {
  public: {
    Tables: {
      teams: {
        Row: { id: string; name: string; user_id: string; created_at: string }
        Insert: { id?: string; name: string; user_id?: string; created_at?: string }
        Update: { id?: string; name?: string; user_id?: string; created_at?: string }
        Relationships: []
      }
      tasks: {
        Row: {
          id: string
          title: string
          description: string | null
          status: TaskStatus
          priority: TaskPriority
          due_date: string | null
          position: number
          user_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          status?: TaskStatus
          priority?: TaskPriority
          due_date?: string | null
          position?: number
          user_id?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          status?: TaskStatus
          priority?: TaskPriority
          due_date?: string | null
          position?: number
          user_id?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      members: {
        Row: {
          id: string
          name: string
          color: string | null
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          color?: string | null
          user_id?: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          color?: string | null
          user_id?: string
          created_at?: string
        }
        Relationships: []
      }
      team_members: {
        Row: { team_id: string; member_id: string; user_id: string; created_at: string }
        Insert: { team_id: string; member_id: string; user_id?: string; created_at?: string }
        Update: { team_id?: string; member_id?: string; user_id?: string; created_at?: string }
        Relationships: [
          {
            foreignKeyName: 'team_members_team_id_fkey'
            columns: ['team_id']
            referencedRelation: 'teams'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'team_members_member_id_fkey'
            columns: ['member_id']
            referencedRelation: 'members'
            referencedColumns: ['id']
          },
        ]
      }
      task_assignees: {
        Row: { task_id: string; member_id: string; created_at: string }
        Insert: { task_id: string; member_id: string; created_at?: string }
        Update: { task_id?: string; member_id?: string; created_at?: string }
        Relationships: [
          {
            foreignKeyName: 'task_assignees_task_id_fkey'
            columns: ['task_id']
            referencedRelation: 'tasks'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'task_assignees_member_id_fkey'
            columns: ['member_id']
            referencedRelation: 'members'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
