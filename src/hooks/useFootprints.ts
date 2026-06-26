import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Footprint, MarkerType } from '../types'

export function useFootprints() {
  const [footprints, setFootprints] = useState<Footprint[]>([])
  const [loading, setLoading] = useState(true)

  const fetchFootprints = useCallback(async () => {
    setLoading(true)

    // ① 先确认当前用户已就绪（生产环境中 Supabase session 恢复可能有延迟）
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    console.log('[useFootprints] auth user:', user?.id ?? 'null', 'authError:', authError?.message ?? 'none')

    if (!user) {
      console.warn('[useFootprints] 用户未登录，跳过查询')
      setFootprints([])
      setLoading(false)
      return
    }

    // ② 显式按 user_id 过滤（双重保险，即使 RLS 有误也能正确过滤）
    const { data, error } = await supabase
      .from('footprints')
      .select('*')
      .eq('user_id', user.id)
      .order('visited_at', { ascending: false })

    console.log('[useFootprints] query result — data:', data?.length ?? 0, 'error:', error?.message ?? 'none')

    if (error) {
      console.error('[useFootprints] 查询失败:', error)
      setFootprints([])
    } else {
      setFootprints(data ?? [])
    }
    setLoading(false)
  }, [])

  // 首次加载 + 监听 auth 状态变化（登录后自动重新加载）
  useEffect(() => {
    fetchFootprints()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      console.log('[useFootprints] auth event:', event)
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        fetchFootprints()
      }
    })

    return () => subscription.unsubscribe()
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

      // 添加成功后重新拉取完整列表（确保与服务端一致）
      fetchFootprints()
      return { data }
    },
    [fetchFootprints],
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
