'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
      } else {
        setUser(user)
      }
    }
    getUser()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  if (!user) return null

  const role = user.user_metadata?.role
  const name = user.user_metadata?.full_name || user.email

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-gray-900">TrainOS</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{name}</span>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
            role === 'coach' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
          }`}>
            {role === 'coach' ? 'Preparador' : 'Atleta'}
          </span>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-red-500 transition"
          >
            Salir
          </button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Bienvenido, {name.split(' ')[0]}
        </h2>
        <p className="text-gray-500 mb-8">
          {role === 'coach'
            ? 'Desde aca vas a gestionar tus atletas y programas de entrenamiento.'
            : 'Desde aca vas a ver tu entrenamiento del dia y registrar tu progreso.'}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {role === 'coach' ? (
            <>
              <div className="bg-white rounded-xl p-6 shadow-sm border">
                <div className="text-3xl mb-3">[ Atletas ]</div>
                <h3 className="font-semibold text-gray-900">Mis atletas</h3>
                <p className="text-sm text-gray-500 mt-1">Proximamente</p>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm border">
                <div className="text-3xl mb-3">[ Programas ]</div>
                <h3 className="font-semibold text-gray-900">Programas</h3>
                <p className="text-sm text-gray-500 mt-1">Proximamente</p>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm border">
                <div className="text-3xl mb-3">[ Ejercicios ]</div>
                <h3 className="font-semibold text-gray-900">Ejercicios</h3>
                <p className="text-sm text-gray-500 mt-1">Proximamente</p>
              </div>
            </>
          ) : (
            <>
              <div className="bg-white rounded-xl p-6 shadow-sm border">
                <div className="text-3xl mb-3">[ Wellness ]</div>
                <h3 className="font-semibold text-gray-900">Wellness hoy</h3>
                <p className="text-sm text-gray-500 mt-1">Proximamente</p>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm border">
                <div className="text-3xl mb-3">[ Entreno ]</div>
                <h3 className="font-semibold text-gray-900">Entrenamiento del dia</h3>
                <p className="text-sm text-gray-500 mt-1">Proximamente</p>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm border">
                <div className="text-3xl mb-3">[ Records ]</div>
                <h3 className="font-semibold text-gray-900">Mis records</h3>
                <p className="text-sm text-gray-500 mt-1">Proximamente</p>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
