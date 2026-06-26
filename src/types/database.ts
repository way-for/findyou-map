/**
 * Supabase 数据库类型定义
 * 与 supabase/migrations/ 保持同步
 */

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          nickname: string
          avatar_url: string | null
          bio: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          nickname?: string
          avatar_url?: string | null
          bio?: string
        }
        Update: {
          nickname?: string
          avatar_url?: string | null
          bio?: string
        }
        Relationships: []
      }
      footprints: {
        Row: {
          id: string
          user_id: string
          place_name: string
          latitude: number
          longitude: number
          content: string
          note: string
          marker_type: 'travel' | 'food' | 'life' | 'work'
          image_url: string
          images: string[]
          visited_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          place_name: string
          latitude: number
          longitude: number
          content?: string
          note?: string
          marker_type?: 'travel' | 'food' | 'life' | 'work'
          image_url?: string
          images?: string[]
          visited_at?: string
        }
        Update: {
          place_name?: string
          latitude?: number
          longitude?: number
          content?: string
          note?: string
          marker_type?: 'travel' | 'food' | 'life' | 'work'
          image_url?: string
          images?: string[]
          visited_at?: string
        }
        Relationships: []
      }
      visited_regions: {
        Row: {
          id: string
          user_id: string
          region_code: string
          region_name: string
          region_type: 'country' | 'province'
          visited_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          region_code: string
          region_name: string
          region_type: 'country' | 'province'
          visited_at?: string
        }
        Update: {
          region_code?: string
          region_name?: string
          region_type?: 'country' | 'province'
          visited_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
