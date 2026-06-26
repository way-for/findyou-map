import { useState, useCallback, useEffect } from 'react'

interface ToastItem {
  id: number
  message: string
}

let _toastId = 0

/** 全局 Toast 状态（模块级，跨组件共享） */
let _listeners: Array<(toasts: ToastItem[]) => void> = []
let _toasts: ToastItem[] = []

function notify() {
  _listeners.forEach((fn) => fn([..._toasts]))
}

/** 外部调用：显示一条 Toast */
export function showToast(message: string) {
  const id = ++_toastId
  _toasts = [..._toasts, { id, message }]
  notify()
  setTimeout(() => {
    _toasts = _toasts.filter((t) => t.id !== id)
    notify()
  }, 3000)
}

/** Toast 容器组件，放在 App 根节点 */
export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => {
    _listeners.push(setToasts)
    return () => {
      _listeners = _listeners.filter((fn) => fn !== setToasts)
    }
  }, [])

  const handleDismiss = useCallback((id: number) => {
    _toasts = _toasts.filter((t) => t.id !== id)
    notify()
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => handleDismiss(t.id)}
          className="pointer-events-auto bg-gray-900/95 backdrop-blur-md border border-gray-700 text-white text-sm px-4 py-2.5 rounded-xl shadow-2xl cursor-pointer animate-toast-in"
        >
          {t.message}
        </div>
      ))}
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateX(40px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .animate-toast-in {
          animation: toast-in 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}
