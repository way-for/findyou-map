import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      else navigate('/map', { replace: true })
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else { setMessage('注册成功，请检查邮箱完成验证后登录'); setMode('login') }
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4 relative overflow-hidden">
      {/* 背景地图网格装饰 */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="auth-grid-bg" />
        <div className="absolute inset-0 bg-gradient-to-b from-gray-950/30 via-gray-950/60 to-gray-950" />
      </div>

      <div className="w-full max-w-sm relative z-10">
        {/* 标题 */}
        <div className="text-center mb-10">
          <div className="text-5xl mb-3">🗺️</div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            FindYou Map
          </h1>
          <p className="text-gray-500 mt-2 text-sm">
            记录每一段属于你的旅程
          </p>
        </div>

        {/* 表单卡片 */}
        <div className="auth-card bg-gray-900/70 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6 shadow-2xl">

          {/* Tab 切换 */}
          <div className="flex bg-gray-800/60 rounded-xl p-1 mb-6">
            {(['login', 'register'] as const).map((m) => (
              <button key={m}
                onClick={() => { setMode(m); setError(''); setMessage('') }}
                className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                  mode === m
                    ? 'bg-gray-700 text-white shadow-md'
                    : 'text-gray-500 hover:text-gray-300'
                }`}>
                {m === 'login' ? '登录' : '注册'}
              </button>
            ))}
          </div>

          {/* 表单 */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">邮箱</label>
              <input type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="auth-input w-full px-3.5 py-2.5 bg-gray-800/80 border border-gray-700 rounded-lg text-white placeholder-gray-600 transition" />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">密码</label>
              <input type="password" required minLength={6} value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少 6 位"
                className="auth-input w-full px-3.5 py-2.5 bg-gray-800/80 border border-gray-700 rounded-lg text-white placeholder-gray-600 transition" />
            </div>

            {error && (
              <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}
            {message && (
              <p className="text-green-400 text-sm bg-green-500/10 border border-green-500/20 px-3 py-2 rounded-lg">
                {message}
              </p>
            )}

            <button type="submit" disabled={loading}
              className="auth-submit w-full py-2.5 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? '处理中...' : mode === 'login' ? '登录' : '注册'}
            </button>
          </form>
        </div>

        {/* 底部 */}
        <p className="text-center text-gray-700 text-xs mt-8">
          © 2026 FindYou Map
        </p>
      </div>

      <style>{`
        /* 网格背景 */
        .auth-grid-bg {
          position: absolute;
          inset: -20px;
          background-image:
            linear-gradient(rgba(59,130,246,.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59,130,246,.06) 1px, transparent 1px);
          background-size: 60px 60px;
          animation: grid-drift 20s linear infinite;
          filter: blur(1px);
        }
        @keyframes grid-drift {
          from { transform: translate(0, 0); }
          to   { transform: translate(60px, 60px); }
        }

        /* 卡片发光边框 */
        .auth-card {
          box-shadow:
            0 0 0 1px rgba(59,130,246,.08),
            0 0 30px rgba(59,130,246,.06),
            0 20px 50px rgba(0,0,0,.4);
        }

        /* 输入框 focus 蓝色发光 */
        .auth-input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59,130,246,.15), 0 0 12px rgba(59,130,246,.1);
        }

        /* 提交按钮渐变 */
        .auth-submit {
          background: linear-gradient(135deg, #3b82f6, #8b5cf6);
        }
        .auth-submit:hover:not(:disabled) {
          background: linear-gradient(135deg, #60a5fa, #a78bfa);
          box-shadow: 0 0 20px rgba(99,102,241,.3);
        }
      `}</style>
    </div>
  )
}
