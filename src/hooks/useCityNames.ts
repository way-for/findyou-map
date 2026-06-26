import { useState, useEffect, useRef } from 'react'
import type { Footprint } from '../types'

// 模块级缓存 + 速率控制（Nominatim 限制 1 req/s）
const _cache = new Map<string, string>()
let _queueRunning = false
const _pending: Array<{ lat: number; lng: number; resolve: (city: string) => void }> = []

async function processQueue() {
  if (_queueRunning) return
  _queueRunning = true
  while (_pending.length > 0) {
    const item = _pending.shift()!
    const key = `${item.lat.toFixed(2)},${item.lng.toFixed(2)}`
    if (_cache.has(key)) { item.resolve(_cache.get(key)!); continue }
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${item.lat}&lon=${item.lng}&format=json&accept-language=zh`,
        { headers: { 'User-Agent': 'FindYouMap/1.0' } },
      )
      const data = await res.json()
      const city = data.address?.city ?? data.address?.town ?? data.address?.village ?? data.address?.county ?? ''
      _cache.set(key, city)
      item.resolve(city)
    } catch {
      _cache.set(key, '')
      item.resolve('')
    }
    await new Promise((r) => setTimeout(r, 1100))
  }
  _queueRunning = false
}

function enqueueCity(lat: number, lng: number): Promise<string> {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`
  if (_cache.has(key)) return Promise.resolve(_cache.get(key)!)
  return new Promise((resolve) => {
    _pending.push({ lat, lng, resolve })
    processQueue()
  })
}

/** 批量获取足迹对应的城市名（带速率限制和缓存） */
export function useCityNames(footprints: Footprint[]) {
  const [cityMap, setCityMap] = useState<Map<string, string>>(new Map())
  const requested = useRef(new Set<string>())

  useEffect(() => {
    let cancelled = false
    for (const fp of footprints) {
      const key = `${fp.latitude.toFixed(2)},${fp.longitude.toFixed(2)}`
      if (requested.current.has(key)) continue
      requested.current.add(key)
      enqueueCity(fp.latitude, fp.longitude).then((city) => {
        if (!cancelled) setCityMap((prev) => new Map(prev).set(fp.id, city))
      })
    }
    return () => { cancelled = true }
  }, [footprints])

  return cityMap
}
