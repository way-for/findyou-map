import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">
        FindYou Map
      </h1>
      <p className="text-lg text-gray-600 mb-8">
        记录你的旅行足迹，探索世界每一个角落
      </p>
      <Link
        to="/map"
        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        开始探索
      </Link>
    </div>
  )
}
