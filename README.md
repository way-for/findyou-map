# 🗺️ FindYou Map

记录你的旅行足迹，在地图上标记每一个到过的地方。

## 技术栈

- **前端**：React + TypeScript + Vite
- **样式**：Tailwind CSS v4
- **地图**：Leaflet.js + react-leaflet
- **后端**：Supabase（数据库 + 认证 + 存储）
- **路由**：React Router v6

## 本地开发

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，填入你的 Supabase 项目 URL 和 Anon Key

# 3. 启动开发服务器
npm run dev
```

## 环境变量

在 `.env` 文件中配置（变量名必须以 `VITE_` 开头）：

| 变量名 | 说明 |
|---|---|
| `VITE_SUPABASE_URL` | Supabase 项目 URL（`https://xxx.supabase.co`） |
| `VITE_SUPABASE_ANON_KEY` | Supabase 匿名公钥（Anon Public Key） |

## 部署到 Vercel

### 第一步：本地构建验证

```bash
npm run build
```

确认终端输出 `✓ built in ...` 且无报错。构建产物在 `dist/` 目录。

### 第二步：推送到 GitHub

```bash
git init
git add .
git commit -m "init: findyou-map"
git remote add origin https://github.com/你的用户名/findyou-map.git
git push -u origin main
```

### 第三步：在 Vercel 导入项目

1. 打开 [vercel.com](https://vercel.com)，用 GitHub 账号登录
2. 点击 **Add New → Project**
3. 选择 `findyou-map` 仓库，点击 **Import**
4. Vercel 会自动识别 Vite 框架，无需修改构建配置

### 第四步：配置环境变量

在 Vercel 项目设置 → **Settings → Environment Variables** 中添加：

| Key | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://你的项目ID.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `你的 anon public key` |

添加后点击 **Deploy**，等待构建完成即可访问。

> **注意**：`vercel.json` 已配置 SPA rewrites，解决 React Router 刷新 404 问题。

## Supabase 数据库初始化

在 Supabase 控制台 → SQL Editor 中依次执行：

1. `supabase/migrations/001_initial_schema.sql` — 建表 + RLS 策略
2. `supabase/migrations/002_add_footprint_fields.sql` — 添加 note + marker_type 字段
3. `supabase/migrations/003_add_image_url.sql` — 添加 image_url 字段

## 项目结构

```
src/
├── components/          # 通用组件（AuthGuard, Toast）
├── hooks/               # 自定义 Hooks
│   ├── useFootprints.ts     # 足迹 CRUD
│   ├── useGeoInfo.ts        # 逆地理编码 + IP 查询
│   ├── useCityNames.ts      # 批量城市名查询
│   └── useImageUpload.ts    # 图片上传
├── lib/
│   └── supabase.ts          # Supabase 客户端
├── pages/
│   ├── AuthPage.tsx         # 登录/注册
│   ├── MapPage.tsx          # 主地图页
│   ├── ProfilePage.tsx      # 个人中心/统计
│   └── NotFound.tsx         # 404
├── types/                   # TypeScript 类型定义
├── App.tsx                  # 路由配置
└── main.tsx                 # 入口
```
