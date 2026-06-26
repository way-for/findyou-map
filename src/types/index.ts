export type MarkerType = 'travel' | 'food' | 'life' | 'work'

/** 旅行足迹 */
export interface Footprint {
  id: string
  user_id: string
  place_name: string
  latitude: number
  longitude: number
  content: string
  note: string
  marker_type: MarkerType
  image_url: string
  images: string[]
  visited_at: string
  created_at: string
  updated_at: string
}

/** 已访问地区 */
export interface VisitedRegion {
  id: string
  user_id: string
  region_code: string
  region_name: string
  region_type: 'country' | 'province'
  visited_at: string
  created_at: string
}

/** 添加足迹输入参数 */
export interface CreateFootprintInput {
  place_name: string
  latitude: number
  longitude: number
  note?: string
  marker_type?: MarkerType
  image_url?: string
  content?: string
  images?: string[]
  visited_at?: string
}

/** 用户资料 */
export interface Profile {
  id: string
  nickname: string
  avatar_url: string | null
  bio: string
  created_at: string
  updated_at: string
}

/** 更新资料输入参数 */
export interface UpdateProfileInput {
  nickname?: string
  avatar_url?: string
  bio?: string
}
