import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AuthPage from './pages/AuthPage'
import MapPage from './pages/MapPage'
import ProfilePage from './pages/ProfilePage'
import NotFound from './pages/NotFound'
import AuthGuard from './components/AuthGuard'
import ToastContainer from './components/Toast'

export default function App() {
  return (
    <BrowserRouter>
      <ToastContainer />
      <Routes>
        {/* 首页 → 重定向到地图 */}
        <Route path="/" element={<Navigate to="/map" replace />} />

        {/* 登录/注册（已登录则跳转 /map） */}
        <Route path="/login" element={<AuthPage />} />

        {/* 地图页 - 需要登录 */}
        <Route
          path="/map"
          element={
            <AuthGuard>
              <MapPage />
            </AuthGuard>
          }
        />

        {/* 个人中心 - 需要登录 */}
        <Route
          path="/profile"
          element={
            <AuthGuard>
              <ProfilePage />
            </AuthGuard>
          }
        />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}
