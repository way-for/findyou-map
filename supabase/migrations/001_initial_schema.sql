-- ============================================================
-- FindYou Map - 数据库初始化
-- 在 Supabase 控制台 SQL Editor 中执行此脚本
-- ============================================================

-- 1. profiles 扩展表（关联 auth.users）
-- ============================================================
CREATE TABLE public.profiles (
  id          UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  nickname    TEXT NOT NULL DEFAULT '',
  avatar_url  TEXT,
  bio         TEXT DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS '用户资料，扩展 auth.users';

-- 新用户注册时自动创建 profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nickname)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'nickname', ''));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- 2. footprints 足迹表
-- ============================================================
CREATE TABLE public.footprints (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  place_name  TEXT NOT NULL,
  latitude    DOUBLE PRECISION NOT NULL,
  longitude   DOUBLE PRECISION NOT NULL,
  content     TEXT DEFAULT '',
  images      TEXT[] DEFAULT '{}',
  visited_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.footprints IS '用户的旅行足迹';

CREATE INDEX idx_footprints_user_id ON public.footprints(user_id);
CREATE INDEX idx_footprints_visited_at ON public.footprints(user_id, visited_at DESC);


-- 3. visited_regions 已访问地区表
-- ============================================================
CREATE TABLE public.visited_regions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  region_code TEXT NOT NULL,
  region_name TEXT NOT NULL,
  region_type TEXT NOT NULL CHECK (region_type IN ('country', 'province')),
  visited_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, region_code)
);

COMMENT ON TABLE public.visited_regions IS '已访问的国家/省份';

CREATE INDEX idx_visited_regions_user_id ON public.visited_regions(user_id);


-- 4. updated_at 自动更新触发器
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_footprints_updated_at
  BEFORE UPDATE ON public.footprints
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();


-- ============================================================
-- 5. RLS 行级安全策略
-- ============================================================

-- 启用 RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.footprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visited_regions ENABLE ROW LEVEL SECURITY;

-- ---------- profiles 策略 ----------
-- 所有人可查看所有 profile（用于公开展示）
CREATE POLICY "profiles_select_all"
  ON public.profiles FOR SELECT
  USING (true);

-- 用户只能更新自己的 profile
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- 用户只能删除自己的 profile（注销用）
CREATE POLICY "profiles_delete_own"
  ON public.profiles FOR DELETE
  USING (auth.uid() = id);

-- INSERT 由触发器完成（SECURITY DEFINER），无需额外策略

-- ---------- footprints 策略 ----------
-- 用户只能查看自己的足迹
CREATE POLICY "footprints_select_own"
  ON public.footprints FOR SELECT
  USING (auth.uid() = user_id);

-- 用户只能插入自己的足迹
CREATE POLICY "footprints_insert_own"
  ON public.footprints FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 用户只能更新自己的足迹
CREATE POLICY "footprints_update_own"
  ON public.footprints FOR UPDATE
  USING (auth.uid() = user_id);

-- 用户只能删除自己的足迹
CREATE POLICY "footprints_delete_own"
  ON public.footprints FOR DELETE
  USING (auth.uid() = user_id);

-- ---------- visited_regions 策略 ----------
-- 用户只能查看自己的地区记录
CREATE POLICY "visited_regions_select_own"
  ON public.visited_regions FOR SELECT
  USING (auth.uid() = user_id);

-- 用户只能插入自己的地区记录
CREATE POLICY "visited_regions_insert_own"
  ON public.visited_regions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 用户只能更新自己的地区记录
CREATE POLICY "visited_regions_update_own"
  ON public.visited_regions FOR UPDATE
  USING (auth.uid() = user_id);

-- 用户只能删除自己的地区记录
CREATE POLICY "visited_regions_delete_own"
  ON public.visited_regions FOR DELETE
  USING (auth.uid() = user_id);


-- 6. Storage Bucket（存储足迹图片）
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('footprint-images', 'footprint-images', true);

-- 允许已认证用户上传图片到自己的文件夹
CREATE POLICY "storage_upload_own_images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'footprint-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- 所有人可查看图片（public bucket）
CREATE POLICY "storage_select_images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'footprint-images');

-- 用户只能删除自己上传的图片
CREATE POLICY "storage_delete_own_images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'footprint-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
