import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '../lib/supabase'
import { useFootprints } from '../hooks/useFootprints'
import { useReverseGeocode, useIpInfo } from '../hooks/useGeoInfo'
import { useImageUpload } from '../hooks/useImageUpload'
import { showToast } from '../components/Toast'
import type { MarkerType, Footprint } from '../types'

// ── 标记类型配色 ─────────────────────────────────────────────────
const TYPE_CONFIG: Record<MarkerType, { color: string; label: string; icon: string }> = {
  travel: { color: '#f97316', label: '旅游', icon: '✈️' },
  food:   { color: '#ef4444', label: '美食', icon: '🍜' },
  life:   { color: '#22c55e', label: '生活', icon: '🏠' },
  work:   { color: '#3b82f6', label: '工作', icon: '💼' },
}

// ── 足迹 Marker（16px 圆点 + 文字标签，zoom < 8 时隐藏标签）────────
function createMarkerIcon(type: MarkerType, name: string) {
  const c = TYPE_CONFIG[type]
  const S = 16
  const labelW = Math.min(name.length * 12 + 8, 120)
  const totalW = Math.max(S, labelW)
  const offsetX = (totalW - S) / 2

  return L.divIcon({
    className: '',
    iconSize: [totalW, S + 18],
    iconAnchor: [totalW / 2, S],
    html: `
      <div style="position:relative;width:${totalW}px;height:${S + 18}px;">
        <div style="
          position:absolute;top:0;left:${offsetX}px;
          width:${S}px;height:${S}px;border-radius:50%;
          background:${c.color};
          border:3px solid #fff;
          box-shadow:0 0 0 3px ${c.color}40,0 2px 8px rgba(0,0,0,.5);
        "></div>
        <div class="marker-label" style="
          position:absolute;top:${S + 2}px;left:0;width:${totalW}px;
          text-align:center;font-size:11px;line-height:1;
          color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.8),0 0 4px rgba(0,0,0,.6);
          white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
          pointer-events:none;
        ">${name}</div>
      </div>`,
  })
}

// ── 搜索结果 Marker（紫色）────────────────────────────────────────
const searchIcon = L.divIcon({
  className: '',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
  html: `<div style="
    width:26px;height:26px;border-radius:50%;
    background:linear-gradient(135deg,#a855f7,#7c3aed);
    border:3px solid #fff;
    box-shadow:0 0 0 4px #a855f740,0 2px 8px rgba(0,0,0,.5);
  "></div>`,
})

// ── 用户定位 Marker（蓝色脉冲）────────────────────────────────────
const geoIcon = L.divIcon({
  className: '',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  html: `<div class="geo-ping-wrap">
    <div class="geo-ping-ring"></div>
    <div class="geo-ping-dot"></div>
  </div>
  <style>
    .geo-ping-wrap{position:relative;width:40px;height:40px}
    .geo-ping-dot{
      position:absolute;top:14px;left:14px;width:12px;height:12px;
      border-radius:50%;background:#3b82f6;border:2.5px solid #fff;
      box-shadow:0 0 6px #3b82f6;
    }
    .geo-ping-ring{
      position:absolute;top:0;left:0;width:40px;height:40px;
      border-radius:50%;border:3px solid #3b82f6;
      opacity:0;animation:geo-ping 1.8s cubic-bezier(0,0,.2,1) infinite;
    }
    @keyframes geo-ping{
      0%{transform:scale(.3);opacity:.8}
      100%{transform:scale(1);opacity:0}
    }
  </style>`,
})

// ── 唯一 ID 生成 ─────────────────────────────────────────────────
let _flyId = 0
const makeFlyTarget = (lat: number, lng: number) => ({ id: ++_flyId, lat, lng })

// ── MapController：飞行 + 点击 + 缩放监听 ────────────────────────
function MapController({
  flyTarget,
  onMapClick,
  onZoomChange,
}: {
  flyTarget: { id: number; lat: number; lng: number } | null
  onMapClick: (lat: number, lng: number) => void
  onZoomChange: (zoom: number) => void
}) {
  const map = useMap()
  const prevId = useRef(0)

  useEffect(() => {
    if (!flyTarget || flyTarget.id === prevId.current) return
    prevId.current = flyTarget.id
    map.flyTo([flyTarget.lat, flyTarget.lng], 14, { duration: 1.2 })
    const t = setTimeout(() => map.invalidateSize(), 1300)
    return () => clearTimeout(t)
  }, [flyTarget, map])

  useEffect(() => {
    onZoomChange(map.getZoom())
    const handler = () => onZoomChange(map.getZoom())
    map.on('zoomend', handler)
    return () => { map.off('zoomend', handler) }
  }, [map, onZoomChange])

  useMapEvents({ click(e) { onMapClick(e.latlng.lat, e.latlng.lng) } })
  return null
}

// ── 搜索结果类型 ─────────────────────────────────────────────────
interface SearchResult { name: string; lat: number; lng: number }

// ══════════════════════════════════════════════════════════════════
//  主页面
// ══════════════════════════════════════════════════════════════════
export default function MapPage() {
  const [userEmail, setUserEmail] = useState('')
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [clickPos, setClickPos] = useState<{ lat: number; lng: number } | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [flyTarget, setFlyTarget] = useState<{ id: number; lat: number; lng: number } | null>(null)
  const [zoom, setZoom] = useState(4)

  const [placeName, setPlaceName] = useState('')
  const [note, setNote] = useState('')
  const [markerType, setMarkerType] = useState<MarkerType>('travel')
  const [saving, setSaving] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)

  const [detailFootprint, setDetailFootprint] = useState<Footprint | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Footprint | null>(null)
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  const nameInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const { footprints, addFootprint, deleteFootprint } = useFootprints()
  const { address, loading: addrLoading } = useReverseGeocode(
    detailFootprint?.latitude ?? null, detailFootprint?.longitude ?? null,
  )
  const { info: ipInfo, loading: ipLoading } = useIpInfo()
  const imgUpload = useImageUpload()

  // ── 缓存 DivIcon（zoom 变化时重建以更新标签可见性）
  const markerIcons = useMemo(() => {
    const showLabel = zoom >= 8
    const map = new Map<string, L.DivIcon>()
    for (const fp of footprints) {
      const key = `${fp.marker_type}-${showLabel ? fp.place_name : '_'}`
      if (!map.has(key)) {
        map.set(key, createMarkerIcon(fp.marker_type, showLabel ? fp.place_name : ''))
      }
    }
    return map
  }, [footprints, zoom])

  const getMarkerIcon = useCallback(
    (type: MarkerType, name: string) => {
      const showLabel = zoom >= 8
      const key = `${type}-${showLabel ? name : '_'}`
      return markerIcons.get(key) ?? createMarkerIcon(type, showLabel ? name : '')
    },
    [markerIcons, zoom],
  )

  // ── 初始化 ─────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserEmail(user.email ?? '')
    })
  }, [])

  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setUserLocation(loc)
        setFlyTarget(makeFlyTarget(loc.lat, loc.lng))
      },
      (err) => console.warn('定位失败:', err.message),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }, [])

  // ── 从 ProfilePage 跳转过来时，定位到指定足迹 ─────────────────
  useEffect(() => {
    const state = location.state as { flyTo?: { lat: number; lng: number }; footprintId?: string } | null
    if (state?.flyTo) {
      setFlyTarget(makeFlyTarget(state.flyTo.lat, state.flyTo.lng))
      if (state.footprintId) setSelectedMarkerId(state.footprintId)
      navigate('/map', { replace: true, state: null })
    }
  }, [location.state, navigate])

  useEffect(() => {
    if (modalOpen) setTimeout(() => nameInputRef.current?.focus(), 150)
  }, [modalOpen])

  // ── 地图交互 ───────────────────────────────────────────────────
  const handleMapClick = (lat: number, lng: number) => {
    if (confirmDelete) return
    if (detailFootprint) { setDetailFootprint(null); return }
    setClickPos({ lat, lng })
    setPlaceName('')
    setNote('')
    setMarkerType('travel')
    imgUpload.clear()
    setModalOpen(true)
  }

  const handleMarkerClick = (fp: Footprint) => {
    setDetailFootprint(fp)
    setSelectedMarkerId(fp.id)
    setFlyTarget(makeFlyTarget(fp.latitude, fp.longitude))
  }

  const handleSearchResultClick = (r: SearchResult) => {
    setDetailFootprint(null)
    setFlyTarget(makeFlyTarget(r.lat, r.lng))
    setSearchResults([])
    setSearchQuery('')
    setSelectedMarkerId('search')
  }

  const handleFlyTo = (fp: Footprint) => {
    setFlyTarget(makeFlyTarget(fp.latitude, fp.longitude))
    setSelectedMarkerId(fp.id)
    setSidebarOpen(false)
  }

  const handleZoomChange = useCallback((z: number) => setZoom(z), [])

  // ── 搜索 ───────────────────────────────────────────────────────
  const handleSearch = useCallback(async () => {
    const q = searchQuery.trim()
    if (!q) return
    setSearching(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&accept-language=zh`,
        { headers: { 'User-Agent': 'FindYouMap/1.0' } },
      )
      const data: Array<{ display_name: string; lat: string; lon: string }> = await res.json()
      setSearchResults(data.map((d) => ({ name: d.display_name, lat: +d.lat, lng: +d.lon })))
    } catch { setSearchResults([]) }
    setSearching(false)
  }, [searchQuery])

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
    if (e.key === 'Escape') { setSearchResults([]); setSearchQuery('') }
  }

  // ── 保存（含图片上传）───────────────────────────────────────────
  const handleSave = async () => {
    if (!clickPos || !placeName.trim()) return
    setSaving(true)

    let imageUrl = ''
    if (imgUpload.file) {
      imageUrl = (await imgUpload.upload()) ?? ''
    }

    await addFootprint(
      clickPos.lat, clickPos.lng, placeName.trim(),
      note.trim(), markerType, imageUrl,
    )

    setModalOpen(false)
    setClickPos(null)
    imgUpload.clear()
    setSaving(false)
    showToast('✅ 足迹已保存')
  }

  const closeModal = () => { setModalOpen(false); setClickPos(null); imgUpload.clear() }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) handleSave()
    if (e.key === 'Escape') closeModal()
  }

  // ── 删除 ───────────────────────────────────────────────────────
  const handleConfirmDelete = async () => {
    if (!confirmDelete) return
    await deleteFootprint(confirmDelete.id)
    setConfirmDelete(null)
    setDetailFootprint(null)
    setSelectedMarkerId(null)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  // ════════════════════════════════════════════════════════════════
  return (
    <div className="w-full h-screen overflow-hidden bg-gray-950">

      {/* ── 地图（fixed）────────────────────────────────── */}
      <MapContainer
        center={[35, 105]}
        zoom={4}
        style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}
        minZoom={2}
        maxZoom={18}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://osm.org/copyright">OSM</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <MapController flyTarget={flyTarget} onMapClick={handleMapClick} onZoomChange={handleZoomChange} />

        {userLocation && (
          <Marker position={[userLocation.lat, userLocation.lng]} icon={geoIcon}>
            <Popup><span className="text-sm font-medium">📍 当前位置</span></Popup>
          </Marker>
        )}

        {footprints.map((fp) => (
          <Marker
            key={fp.id}
            position={[fp.latitude, fp.longitude]}
            icon={getMarkerIcon(fp.marker_type, fp.place_name)}
            eventHandlers={{ click: () => handleMarkerClick(fp) }}
          />
        ))}

        {searchResults.map((r, i) => (
          <Marker
            key={`search-${i}`}
            position={[r.lat, r.lng]}
            icon={searchIcon}
            eventHandlers={{ click: () => handleSearchResultClick(r) }}
          />
        ))}
      </MapContainer>

      {/* ── 顶部导航栏 ─────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-[1000] bg-gray-950/60 backdrop-blur-md border-b border-gray-800/80">
        <div className="flex items-center justify-between px-4 h-12 gap-3">
          <h1 className="text-white font-bold text-sm tracking-wide whitespace-nowrap flex-shrink-0">🗺️ FindYou Map</h1>
          <div className="flex-1 flex items-center justify-center gap-4 min-w-0">
            <div className="relative max-w-xs w-full">
              <div className="flex items-center bg-gray-800/80 border border-gray-700 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/50 transition">
                <span className="pl-2.5 text-gray-500 text-xs">🔍</span>
                <input
                  type="text" value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="搜索地点..."
                  className="w-full px-2 py-1.5 bg-transparent text-white text-xs placeholder-gray-500 focus:outline-none"
                />
                {searchQuery && (
                  <button onClick={() => { setSearchQuery(''); setSearchResults([]) }}
                    className="pr-2 text-gray-500 hover:text-white text-xs flex-shrink-0">✕</button>
                )}
              </div>
              {(searchResults.length > 0 || searching) && (
                <div className="absolute top-full mt-1 left-0 right-0 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl overflow-hidden z-[1001]">
                  {searching ? (
                    <p className="px-3 py-2 text-gray-500 text-xs">搜索中...</p>
                  ) : searchResults.map((r, i) => (
                    <button key={i} onClick={() => handleSearchResultClick(r)}
                      className="w-full px-3 py-2 text-left hover:bg-gray-800 transition-colors border-b border-gray-800/50 last:border-b-0">
                      <p className="text-white text-xs truncate">{r.name}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <span className="text-gray-500 text-xs whitespace-nowrap hidden md:inline">
              已记录 {footprints.length} 个足迹
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link to="/profile"
              className="text-gray-400 text-xs hidden lg:inline max-w-[160px] truncate hover:text-white transition-colors">
              {userEmail}
            </Link>
            <button onClick={handleLogout}
              className="text-xs text-gray-400 hover:text-white px-2.5 py-1.5 rounded-md hover:bg-gray-700 transition-colors">
              退出
            </button>
          </div>
        </div>
      </nav>

      {/* ── 足迹详情弹窗 ───────────────────────────────── */}
      {detailFootprint && !confirmDelete && (
        <div className="fixed inset-0 z-[1060] flex items-center justify-center">
          <div className="absolute inset-0" onClick={() => { setDetailFootprint(null); setSelectedMarkerId(null) }} />
          <div className="relative bg-gray-900/95 backdrop-blur-md border border-gray-700 rounded-2xl p-5 w-[320px] max-h-[80vh] overflow-y-auto shadow-2xl">
            <button onClick={() => { setDetailFootprint(null); setSelectedMarkerId(null) }}
              className="absolute top-3 right-3 text-gray-500 hover:text-white text-sm transition-colors z-10">✕</button>

            <div className="flex items-center gap-2 mb-3">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: TYPE_CONFIG[detailFootprint.marker_type].color }} />
              <span className="text-xs text-gray-400">
                {TYPE_CONFIG[detailFootprint.marker_type].icon} {TYPE_CONFIG[detailFootprint.marker_type].label}
              </span>
            </div>

            <h3 className="text-white text-base font-semibold mb-3">{detailFootprint.place_name}</h3>

            {/* 图片 */}
            {detailFootprint.image_url && (
              <img
                src={detailFootprint.image_url}
                alt={detailFootprint.place_name}
                onClick={() => setLightboxUrl(detailFootprint.image_url)}
                className="w-full h-36 object-cover rounded-lg mb-3 cursor-pointer hover:opacity-90 transition-opacity"
              />
            )}

            {detailFootprint.note && (
              <p className="text-gray-400 text-sm mb-3 leading-relaxed">{detailFootprint.note}</p>
            )}

            <div className="bg-gray-800/60 rounded-lg p-3 mb-3 space-y-2 text-xs">
              <div className="flex items-start gap-2">
                <span className="text-gray-500 flex-shrink-0">📐</span>
                <span className="text-gray-300">
                  纬度 {detailFootprint.latitude.toFixed(4)}°{detailFootprint.latitude >= 0 ? 'N' : 'S'}，
                  经度 {detailFootprint.longitude.toFixed(4)}°{detailFootprint.longitude >= 0 ? 'E' : 'W'}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-gray-500 flex-shrink-0">📍</span>
                {addrLoading ? (
                  <span className="text-gray-600 italic">获取地址中...</span>
                ) : address ? (
                  <span className="text-gray-300 leading-relaxed">
                    {[address.country, address.state, address.city, address.suburb, address.road].filter(Boolean).join(' · ') || address.full}
                  </span>
                ) : <span className="text-gray-600">地址信息不可用</span>}
              </div>
              <div className="flex items-start gap-2">
                <span className="text-gray-500 flex-shrink-0">🌐</span>
                {ipLoading ? (
                  <span className="text-gray-600 italic">获取 IP 信息中...</span>
                ) : ipInfo ? (
                  <span className="text-gray-300">IP: {ipInfo.ip}（{ipInfo.country} {ipInfo.city}）</span>
                ) : <span className="text-gray-600">IP 信息不可用</span>}
              </div>
            </div>

            <p className="text-gray-600 text-xs mb-4">创建于 {new Date(detailFootprint.created_at).toLocaleString('zh-CN')}</p>

            <button onClick={() => setConfirmDelete(detailFootprint)}
              className="w-full py-2 text-sm text-red-400 hover:text-white hover:bg-red-500/20 rounded-lg border border-red-500/30 hover:border-red-500/60 transition-all">
              删除此足迹
            </button>
          </div>
        </div>
      )}

      {/* ── 图片放大查看 ────────────────────────────────── */}
      {lightboxUrl && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}>
          <img src={lightboxUrl} alt="" className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl" />
        </div>
      )}

      {/* ── 删除确认 ────────────────────────────────────── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setConfirmDelete(null)} />
          <div className="relative bg-gray-900 border border-gray-700 rounded-2xl p-6 w-[280px] shadow-2xl text-center">
            <div className="text-3xl mb-3">⚠️</div>
            <p className="text-white text-sm font-medium mb-1">确认删除</p>
            <p className="text-gray-400 text-xs mb-5">将永久删除「{confirmDelete.place_name}」，此操作不可撤销。</p>
            <div className="flex gap-2">
              <button onClick={handleConfirmDelete}
                className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white text-sm rounded-lg transition-colors">确认删除</button>
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2 text-sm text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 border border-gray-700 transition-colors">取消</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 添加足迹弹窗（升级版）──────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-gray-900/95 backdrop-blur-md border border-gray-700 rounded-2xl p-5 w-[360px] max-h-[85vh] overflow-y-auto shadow-2xl"
            onKeyDown={handleKeyDown}>

            <h2 className="text-white text-sm font-semibold mb-4">添加足迹</h2>

            {/* 地点名称 */}
            <label className="block mb-3">
              <span className="text-gray-400 text-xs mb-1.5 block">地点名称 *</span>
              <input ref={nameInputRef} type="text" value={placeName}
                onChange={(e) => setPlaceName(e.target.value)} placeholder="输入名称..."
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" />
            </label>

            {/* 备注 */}
            <label className="block mb-3">
              <span className="text-gray-400 text-xs mb-1.5 block">备注</span>
              <textarea value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="可选备注..." rows={2}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none" />
            </label>

            {/* 上传图片 */}
            <div className="mb-3">
              <span className="text-gray-400 text-xs mb-1.5 block">上传图片（选填）</span>
              {imgUpload.preview ? (
                <div className="relative">
                  <img src={imgUpload.preview} alt="预览"
                    className="w-full h-32 object-cover rounded-lg border border-gray-700" />
                  <button onClick={() => imgUpload.clear()}
                    className="absolute top-2 right-2 bg-black/60 text-white w-6 h-6 rounded-full text-xs hover:bg-black/80 transition">✕</button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 w-full py-4 bg-gray-800 border border-dashed border-gray-600 rounded-lg cursor-pointer hover:border-gray-500 transition">
                  <span className="text-gray-500 text-lg">📷</span>
                  <span className="text-gray-500 text-xs">选择图片</span>
                  <input type="file" accept="image/*" className="hidden"
                    onChange={(e) => imgUpload.selectFile(e.target.files?.[0] ?? null)} />
                </label>
              )}
            </div>

            {/* 类型 */}
            <div className="mb-4">
              <span className="text-gray-400 text-xs mb-2 block">类型</span>
              <div className="flex gap-2">
                {(Object.keys(TYPE_CONFIG) as MarkerType[]).map((type) => {
                  const c = TYPE_CONFIG[type]
                  const active = markerType === type
                  return (
                    <button key={type} onClick={() => setMarkerType(type)}
                      className={`flex-1 py-1.5 text-xs rounded-lg border transition-all ${
                        active ? 'text-white font-medium shadow-md' : 'text-gray-400 border-gray-700 hover:text-white hover:border-gray-500'
                      }`}
                      style={active ? { background: c.color, borderColor: c.color, boxShadow: `0 0 8px ${c.color}40` } : {}}>
                      {c.icon} {c.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 按钮 */}
            <div className="flex gap-2">
              <button onClick={handleSave}
                disabled={saving || !placeName.trim()}
                className="flex-1 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-all"
                style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
                {saving ? '保存中...' : '保存'}
              </button>
              <button onClick={closeModal}
                className="px-5 py-2.5 text-sm text-gray-400 bg-gray-800 hover:text-white rounded-lg hover:bg-gray-700 border border-gray-700 transition-colors">
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 侧边栏 ─────────────────────────────────────── */}
      {sidebarOpen && <div className="fixed inset-0 z-[1020] bg-black/30" onClick={() => setSidebarOpen(false)} />}
      <aside className={`fixed top-12 bottom-0 left-0 z-[1030] w-72 bg-gray-900/95 backdrop-blur-md border-r border-gray-800 transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between px-4 h-10 border-b border-gray-800">
          <span className="text-white text-xs font-medium">📍 足迹列表</span>
          <button onClick={() => setSidebarOpen(false)} className="text-gray-500 hover:text-white text-xs transition-colors">✕</button>
        </div>
        <div className="overflow-y-auto h-[calc(100%-40px)]">
          {footprints.length === 0 ? (
            <p className="text-gray-600 text-xs text-center mt-8">暂无足迹，点击地图添加</p>
          ) : footprints.map((fp) => {
            const c = TYPE_CONFIG[fp.marker_type]
            const isActive = selectedMarkerId === fp.id
            return (
              <button key={fp.id} onClick={() => handleFlyTo(fp)}
                className={`w-full px-4 py-2.5 text-left transition-colors border-b border-gray-800/50 ${isActive ? 'bg-gray-800' : 'hover:bg-gray-800/60'}`}>
                <div className="flex items-center gap-2">
                  <span className="text-sm flex-shrink-0">{c.icon}</span>
                  <span className={`text-sm truncate ${isActive ? 'text-white font-medium' : 'text-gray-300'}`}>{fp.place_name}</span>
                </div>
                <p className="text-gray-500 text-xs mt-0.5 ml-7">{new Date(fp.visited_at).toLocaleDateString('zh-CN')}</p>
              </button>
            )
          })}
        </div>
      </aside>

      {/* ── 底部工具栏 ──────────────────────────────────── */}
      <button onClick={(e) => { e.stopPropagation(); setSidebarOpen((v) => !v) }}
        className="fixed bottom-4 left-4 z-[1000] bg-gray-900/80 backdrop-blur-md text-white text-xs px-3.5 py-2 rounded-full border border-gray-700 hover:border-gray-500 hover:bg-gray-800 transition-colors cursor-pointer">
        📍 {footprints.length} 个足迹
      </button>
      <div className="fixed bottom-4 right-4 z-[1000] bg-gray-900/80 backdrop-blur-md text-gray-400 text-xs px-3 py-2 rounded-full border border-gray-700">
        点击地图添加足迹
      </div>
    </div>
  )
}
