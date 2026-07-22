'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

interface Program {
  id: string
  name: string
  description: string
  is_active: boolean
  created_at: string
}

export default function ProgramsPage() {
  const router = useRouter()
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', description: '' })
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setUserId(user.id)
      const { data } = await supabase.from('programs').select('*').order('created_at', { ascending: false })
      setPrograms(data || [])
      setLoading(false)
    }
    init()
  }, [router])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    const { data } = await supabase.from('programs').insert({ ...form, coach_id: userId }).select().single()
    setSaving(false)
    setShowForm(false)
    setForm({ name: '', description: '' })
    if (data) router.push(`/dashboard/programs/${data.id}`)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar programa?')) return
    const supabase = createClient()
    await supabase.from('programs').delete().eq('id', id)
    setPrograms(p => p.filter(x => x.id !== id))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.push('/dashboard')} className="text-gray-500 hover:text-gray-700 text-sm">Volver</button>
        <h1 className="text-xl font-bold text-blue-600">Programas</h1>
        <button
          onClick={() => setShowForm(true)}
          className="ml-auto bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          + Nuevo programa
        </button>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center py-20 text-gray-400">Cargando...</div>
        ) : programs.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 mb-4">No tenes programas todavia</p>
            <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700">
              Crear primer programa
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {programs.map(p => (
              <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-6 flex items-center justify-between hover:shadow-sm transition-shadow">
                <div className="cursor-pointer flex-1" onClick={() => router.push(`/dashboard/programs/${p.id}`)}>
                  <h3 className="font-semibold text-gray-900 text-lg">{p.name}</h3>
                  {p.description && <p className="text-gray-500 text-sm mt-1">{p.description}</p>}
                  <p className="text-xs text-gray-400 mt-2">{new Date(p.created_at).toLocaleDateString('es-ES')}</p>
                </div>
                <div className="flex gap-3 ml-4">
                  <button
                    onClick={() => router.push(`/dashboard/programs/${p.id}`)}
                    className="text-sm text-blue-600 hover:underline font-medium"
                  >
                    Ver sesiones
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="text-sm text-red-400 hover:underline"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Nuevo programa</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del programa</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                  placeholder="Ej: Fuerza 4 dias, Hipertrofia 3x semana..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripcion (opcional)</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  placeholder="Objetivo, duracion, nivel..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Creando...' : 'Crear programa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
