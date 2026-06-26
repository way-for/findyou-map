import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useImageUpload() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  /** 选择文件并生成预览 */
  const selectFile = useCallback((f: File | null) => {
    setFile(f)
    if (f) {
      const reader = new FileReader()
      reader.onload = (e) => setPreview(e.target?.result as string)
      reader.readAsDataURL(f)
    } else {
      setPreview(null)
    }
  }, [])

  /** 清除选择 */
  const clear = useCallback(() => {
    setFile(null)
    setPreview(null)
  }, [])

  /** 上传到 Supabase Storage，返回公开 URL */
  const upload = useCallback(async (): Promise<string | null> => {
    if (!file) return null

    setUploading(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return null

      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${user.id}/${Date.now()}.${ext}`

      const { error } = await supabase.storage
        .from('footprint-images')
        .upload(path, file, { contentType: file.type })

      if (error) {
        console.error('图片上传失败:', error.message)
        return null
      }

      const { data: urlData } = supabase.storage
        .from('footprint-images')
        .getPublicUrl(path)

      return urlData.publicUrl
    } catch (e) {
      console.error('图片上传异常:', e)
      return null
    } finally {
      setUploading(false)
    }
  }, [file])

  return { file, preview, uploading, selectFile, clear, upload }
}
