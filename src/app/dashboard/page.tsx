'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

interface Profile {
  id: string
  full_name: string
  role: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const getUser = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      setProfile(profileData)
      setLoading(false)
    }
    getUser()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Cargando...</div>
      </div>
    )
  }

  const isCoach = profile?.role === 'coach'

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <span className="text-xl font-bold text-blue-600">TrainOS</span>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">{profile?.full_name}</span>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${isCoach ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                {isCoach ? 'Preparador' : 'Atleta'}
              </span>
              <button
                onClick={async () => {
                  const supabase = createClient()
                  await supabase.auth.signOut()
                  router.push('/auth/login')
                }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Cerrar sesion
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Bienvenido, {profile?.full_name?.split(' ')[0]}
          </h1>
          <p className="text-gray-500 mt-1">
            {isCoach ? 'Panel de preparador fisico' : 'Tu panel de entrenamiento'}
          </p>
        </div>

        {isCoach ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => router.push('/dashboard/athletes')}
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Mis atletas</h3>
              <p className="text-gray-500 text-sm">Gestiona tus atletas y asignales programas</p>
            </div>

            <div
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => router.push('/dashboard/programs')}
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Programas</h3>
              <p className="text-gray-500 text-sm">Crea y gestiona los planes de entrenamiento</p>
            </div>

            <div
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => router.push('/dashboard/exercises')}
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Ejercicios</h3>
              <p className="text-gray-500 text-sm">Biblioteca completa de ejercicios con GIFs</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => router.push('/dashboard/wellness')}
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Wellness</h3>
              <p className="text-gray-500 text-sm">Completa tu cuestionario diario</p>
            </div>

            <div
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => router.push('/dashboard/training')}
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Entrenamiento del dia</h3>
              <p className="text-gray-500 text-sm">Tu sesion de hoy con cargas ajustadas</p>
            </div>

            <div
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => router.push('/dashboard/records')}
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Mis records</h3>
              <p className="text-gray-500 text-sm">Tus marcas personales y progresion</p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
