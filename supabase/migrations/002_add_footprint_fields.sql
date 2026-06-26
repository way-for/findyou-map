-- ============================================================
-- 给 footprints 表添加 note（备注）和 marker_type（标记类型）字段
-- 在 Supabase 控制台 SQL Editor 中执行
-- ============================================================

ALTER TABLE public.footprints
  ADD COLUMN IF NOT EXISTS note TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS marker_type TEXT NOT NULL DEFAULT 'travel'
  CHECK (marker_type IN ('travel', 'food', 'life', 'work'));
