import { useState, useEffect } from 'react'

// ── 行政区划信息 ─────────────────────────────────────────────────
export interface AddressInfo {
  full: string
  country: string
  state: string
  city: string
  suburb: string
  road: string
}

export function useReverseGeocode(lat: number | null, lng: number | null) {
  const [address, setAddress] = useState<AddressInfo | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (lat == null || lng == null) { setAddress(null); return }

    let cancelled = false
    setLoading(true)

    fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=zh`,
      { headers: { 'User-Agent': 'FindYouMap/1.0' } },
    )
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        const a = data.address ?? {}
        setAddress({
          full: data.display_name ?? '',
          country: a.country ?? '',
          state: a.state ?? '',
          city: a.city ?? a.town ?? a.village ?? '',
          suburb: a.suburb ?? a.county ?? '',
          road: a.road ?? '',
        })
      })
      .catch(() => { if (!cancelled) setAddress(null) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [lat, lng])

  return { address, loading }
}

// ── IP 归属地（模块级缓存，整个应用生命周期只请求一次）────────────
interface IpInfo {
  ip: string
  country: string
  city: string
  region: string
}

let _ipCache: IpInfo | null = null
let _ipPromise: Promise<IpInfo | null> | null = null

async function fetchIpInfo(): Promise<IpInfo | null> {
  if (_ipCache) return _ipCache
  if (_ipPromise) return _ipPromise

  _ipPromise = fetch('https://ipapi.co/json/')
    .then((r) => r.json())
    .then((d) => {
      _ipCache = {
        ip: d.ip ?? '',
        country: d.country_name ?? '',
        city: d.city ?? '',
        region: d.region ?? '',
      }
      return _ipCache
    })
    .catch(() => null)
    .finally(() => { _ipPromise = null })

  return _ipPromise
}

export function useIpInfo() {
  const [info, setInfo] = useState<IpInfo | null>(_ipCache)
  const [loading, setLoading] = useState(!_ipCache)

  useEffect(() => {
    if (_ipCache) return
    fetchIpInfo().then((data) => {
      setInfo(data)
      setLoading(false)
    })
  }, [])

  return { info, loading }
}
