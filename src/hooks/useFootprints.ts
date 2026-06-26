import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Footprint, MarkerType } from '../types'

export function useFootprints() {
  const [footprints, setFootprints] = useState<Footprint[]>([])
  const [loading, setLoading] = useState(true)

  const fetchFootprints = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('footprints')
      .select('*')
      .order('visited_at', { ascending: false })

    if (error) {
      console.error('获取足迹失败:', error.message)
      setFootprints([])
    } else {
      setFootprints(data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchFootprints()
  }, [fetchFootprints])

  const addFootprint = useCallback(
    async (
      latitude: number,
      longitude: number,
      placeName: string,
      note?: string,
      markerType?: MarkerType,
      imageUrl?: string,
    ) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return { error: '用户未登录' }

      const { data, error } = await supabase
        .from('footprints')
        .insert({
          user_id: user.id,
          place_name: placeName,
          latitude,
          longitude,
          note: note ?? '',
          marker_type: markerType ?? 'travel',
          image_url: imageUrl ?? '',
        })
        .select()
        .single()

      if (error) {
        console.error('添加足迹失败:', error.message)
        return { error: error.message }
      }

      setFootprints((prev) => [data, ...prev])
      return { data }
    },
    [],
  )

  const deleteFootprint = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('footprints')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('删除足迹失败:', error.message)
      return { error: error.message }
    }

    setFootprints((prev) => prev.filter((f) => f.id !== id))
    return { data: true }
  }, [])

  return { footprints, loading, addFootprint, deleteFootprint, refresh: fetchFootprints }
}
