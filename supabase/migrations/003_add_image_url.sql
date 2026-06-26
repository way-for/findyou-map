-- 给 footprints 表添加 image_url 字段
ALTER TABLE public.footprints
  ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT '';
