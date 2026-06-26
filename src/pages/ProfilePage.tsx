import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useFootprints } from '../hooks/useFootprints'
import { useCityNames } from '../hooks/useCityNames'
import type { MarkerType } from '../types'

const TYPE_CONFIG: Record<MarkerType, { color: string; label: string; icon: string }> = {
  travel: { color: '#f97316', label: '旅游', icon: '✈️' },
  food:   { color: '#ef4444', label: '美食', icon: '🍜' },
  life:   { color: '#22c55e', label: '生活', icon: '🏠' },
  work:   { color: '#3b82f6', label: '工作', icon: '💼' },
}

export default function ProfilePage() {
  const [userEmail, setUserEmail] = useState('')
  const [createdAt, setCreatedAt] = useState('')
  const navigate = useNavigate()
  const { footprints } = useFootprints()
  const cityMap = useCityNames(footprints)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) { setUserEmail(user.email ?? ''); setCreatedAt(user.created_at ?? '') }
    })
  }, [])

  const flyTo = (lat: number, lng: number, id: string) => {
    navigate('/map', { state: { flyTo: { lat, lng }, footprintId: id } })
  }

  const stats = useMemo(() => {
    const uniqueCities = new Set(Array.from(cityMap.values()).filter(Boolean))
    const typeCounts = { travel: 0, food: 0, life: 0, work: 0 } as Record<MarkerType, number>
    for (const fp of footprints) typeCounts[fp.marker_type]++
    const latest = footprints.length > 0 ? footprints[0].visited_at : null
    return { total: footprints.length, cities: uniqueCities.size, typeCounts, latest }
  }, [footprints, cityMap])

  const avatarLetter = userEmail ? userEmail[0].toUpperCase() : '?'
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* 导航 */}
      <nav className="sticky top-0 z-10 bg-gray-950/80 backdrop-blur-md border-b border-gray-800">
        <div className="max-w-[800px] mx-auto flex items-center justify-between px-4 h-12">
          <button onClick={() => navigate('/map')}
            className="flex items-center gap-1 text-gray-400 hover:text-white text-sm transition-colors">
            ← 返回地图
          </button>
          <span className="text-white font-bold text-sm">个人中心</span>
          <div className="w-16" />
        </div>
      </nav>

      <div className="max-w-[800px] mx-auto px-4 py-8 space-y-6">

        {/* ── 用户卡片 ──────────────────────────────────── */}
        <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-5">
          <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold flex-shrink-0 shadow-lg"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
            {avatarLetter}
          </div>
          <div className="text-center sm:text-left min-w-0">
            <p className="text-white font-semibold text-lg truncate">{userEmail}</p>
            <p className="text-gray-500 text-sm mt-1">
              注册于 {createdAt ? fmtDate(createdAt) : '—'}
            </p>
          </div>
        </div>

        {/* ── 统计数字（大号） ──────────────────────────── */}
        <div className="grid grid-cols-2 gap-4">
          {/* 总足迹 */}
          <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-6 flex flex-col items-center justify-center">
            <p className="text-gray-500 text-xs mb-2 tracking-wide">总足迹</p>
            <p className="text-5xl font-extrabold text-blue-500">{stats.total}</p>
            <p className="text-gray-600 text-xs mt-1">个地点</p>
          </div>
          {/* 覆盖城市 */}
          <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-6 flex flex-col items-center justify-center">
            <p className="text-gray-500 text-xs mb-2 tracking-wide">覆盖城市</p>
            <p className="text-5xl font-extrabold text-violet-500">{stats.cities}</p>
            <p className="text-gray-600 text-xs mt-1">座城市</p>
          </div>
          {/* 最近记录 */}
          <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-6 flex flex-col items-center justify-center">
            <p className="text-gray-500 text-xs mb-2 tracking-wide">最近记录</p>
            <p className="text-lg font-bold text-emerald-400">
              {stats.latest ? fmtDate(stats.latest) : '—'}
            </p>
          </div>
          {/* 类型分布 */}
          <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-6">
            <p className="text-gray-500 text-xs mb-3 tracking-wide text-center">类型分布</p>
            <div className="space-y-3">
              {(Object.keys(TYPE_CONFIG) as MarkerType[]).map((t) => {
                const c = TYPE_CONFIG[t]
                const count = stats.typeCounts[t]
                const pct = stats.total > 0 ? (count / stats.total) * 100 : 0
                return (
                  <div key={t}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="flex items-center gap-1.5 text-xs text-gray-300">
                        <span>{c.icon}</span> {c.label}
                      </span>
                      <span className="text-xs font-semibold" style={{ color: c.color }}>{count}</span>
                    </div>
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: c.color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── 足迹时间轴 ──────────────────────────────── */}
        <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-gray-300 mb-5">足迹时间轴</h2>
          {footprints.length === 0 ? (
            <div className="flex flex-col items-center py-12">
              <div className="text-5xl mb-4">🗺️</div>
              <p className="text-gray-500 text-sm mb-1">还没有足迹记录</p>
              <p className="text-gray-600 text-xs">去地图上点击添加你的第一个足迹吧！</p>
              <button onClick={() => navigate('/map')}
                className="mt-4 px-5 py-2 text-xs text-white rounded-lg transition-all"
                style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
                前往地图
              </button>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-[15px] top-2 bottom-2 w-px bg-gray-800" />
              <div className="space-y-1">
                {footprints.map((fp) => {
                  const tc = TYPE_CONFIG[fp.marker_type]
                  const city = cityMap.get(fp.id) ?? ''
                  return (
                    <button key={fp.id}
                      onClick={() => flyTo(fp.latitude, fp.longitude, fp.id)}
                      className="relative w-full flex items-start gap-3 pl-0 pr-3 py-3 rounded-xl hover:bg-gray-800/50 transition-colors text-left group">
                      <div className="relative z-10 flex-shrink-0 w-[30px] flex justify-center pt-0.5">
                        <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-900"
                          style={{ background: tc.color, boxShadow: `0 0 6px ${tc.color}60` }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{tc.icon}</span>
                          <span className="text-sm text-white group-hover:text-blue-400 transition-colors truncate font-medium">
                            {fp.place_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {city && <span className="text-xs text-gray-500">{city}</span>}
                          <span className="text-xs text-gray-600">
                            {new Date(fp.visited_at).toLocaleDateString('zh-CN')}
                          </span>
                        </div>
                      </div>
                      <span className="text-gray-700 group-hover:text-gray-400 text-sm pt-0.5 transition-colors">›</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── 版权 ─────────────────────────────────────── */}
        <p className="text-center text-gray-700 text-xs pb-4">
          © 2026 FindYou Map · 记录每一段旅程
        </p>
      </div>
    </div>
  )
}
