'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const MUSCLE_GROUPS = ['Todos','Pecho','Espalda','Hombros','Biceps','Triceps','Cuadriceps','Isquiotibiales','Gluteos','Gemelos','Core','Full Body']
const EQUIPMENT = ['Sin equipamiento','Barra','Mancuernas','Maquina','Polea','Kettlebell','Bandas','TRX']
const PAGE_SIZE = 30

interface Exercise {
  id: string
  name: string
  muscle_groups: string[]
  equipment: string
  instructions: string
  media_url: string
  is_global: boolean
  coach_id: string | null
}

const emptyForm = { name: '', muscle_groups: [] as string[], equipment: 'Sin equipamiento', instructions: '', media_url: '' }

export default function ExercisesPage() {
  const router = useRouter()
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [muscle, setMuscle] = useState('Todos')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Exercise | null>(null)

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setUserId(user.id)
    }
    init()
  }, [router])

  useEffect(() => {
    if (userId !== null) fetchExercises()
  }, [search, muscle, page, userId])

  const fetchExercises = async () => {
    setLoading(true)
    const supabase = createClient()
    let query = supabase
      .from('exercises')
      .select('*', { count: 'exact' })
      .order('name')
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
    if (search) query = query.ilike('name', `%${search}%`)
    if (muscle !== 'Todos') query = query.contains('muscle_groups', [muscle])
    const { data, count } = await query
    setExercises(data || [])
    setTotal(count || 0)
    setLoading(false)
  }

  const handleSearch = (val: string) => { setSearch(val); setPage(0) }
  const handleMuscle = (val: string) => { setMuscle(val); setPage(0) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    if (editId) {
      await supabase.from('exercises').update(form).eq('id', editId)
    } else {
      await supabase.from('exercises').insert({ ...form, coach_id: userId })
    }
    setSaving(false)
    setShowForm(false)
    setEditId(null)
    setForm(emptyForm)
    fetchExercises()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar ejercicio?')) return
    const supabase = createClient()
    await supabase.from('exercises').delete().eq('id', id)
    fetchExercises()
  }

  const toggleMuscleGroup = (mg: string) => {
    setForm(f => ({
      ...f,
      muscle_groups: f.muscle_groups.includes(mg)
        ? f.muscle_groups.filter(x => x !== mg)
        : [...f.muscle_groups, mg]
    }))
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.push('/dashboard')} className="text-gray-500 hover:text-gray-700 text-sm">
          Volver
        </button>
        <h1 className="text-xl font-bold text-blue-600">Biblioteca de Ejercicios</h1>
        <span className="text-sm text-gray-400 ml-auto">{total} ejercicios</span>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-wrap gap-3 mb-6">
          <input
            type="text"
            placeholder="Buscar ejercicio..."
            value={search}
            onChange={e => handleSearch(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={muscle}
            onChange={e => handleMuscle(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {MUSCLE_GROUPS.map(mg => <option key={mg}>{mg}</option>)}
          </select>
          <button
            onClick={() => { setShowForm(true); setEditId(null); setForm(emptyForm) }}
            className="ml-auto bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            + Nuevo ejercicio
          </button>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">Cargando...</div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
              {exercises.map(ex => (
                <div
                  key={ex.id}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setSelected(ex)}
                >
                  {ex.media_url ? (
                    <img src={ex.media_url} alt={ex.name} className="w-full h-32 object-cover bg-gray-100" loading="lazy" />
                  ) : (
                    <div className="w-full h-32 bg-gray-100 flex items-center justify-center text-gray-300 text-3xl">?</div>
                  )}
                  <div className="p-2">
                    <p className="text-xs font-semibold text-gray-800 truncate">{ex.name}</p>
                    <p className="text-xs text-gray-400 truncate">{ex.muscle_groups?.join(', ')}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
              >
                Anterior
              </button>
              <span className="text-sm text-gray-600">Pagina {page + 1} de {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
              >
                Siguiente
              </button>
            </div>
          </>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-screen overflow-y-auto" onClick={e => e.stopPropagation()}>
            {selected.media_url && (
              <img src={selected.media_url} alt={selected.name} className="w-full rounded-t-2xl bg-gray-100" />
            )}
            <div className="p-6">
              <div className="flex items-start justify-between mb-3">
                <h2 className="text-xl font-bold text-gray-900 capitalize">{selected.name}</h2>
                <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none ml-4">x</button>
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                {selected.muscle_groups?.map(mg => (
                  <span key={mg} className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full font-medium">{mg}</span>
                ))}
                <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">{selected.equipment}</span>
              </div>
              {selected.instructions && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Instrucciones</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{selected.instructions}</p>
                </div>
              )}
              {!selected.is_global && (
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => {
                      setSelected(null)
                      setEditId(selected.id)
                      setForm({ name: selected.name, muscle_groups: selected.muscle_groups || [], equipment: selected.equipment, instructions: selected.instructions, media_url: selected.media_url })
                      setShowForm(true)
                    }}
                    className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => { setSelected(null); handleDelete(selected.id) }}
                    className="flex-1 border border-red-300 text-red-500 py-2 rounded-lg text-sm font-medium hover:bg-red-50"
                  >
                    Eliminar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-screen overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900 mb-4">{editId ? 'Editar ejercicio' : 'Nuevo ejercicio'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Grupos musculares</label>
                <div className="flex flex-wrap gap-2">
                  {MUSCLE_GROUPS.filter(mg => mg !== 'Todos').map(mg => (
                    <button type="button" key={mg} onClick={() => toggleMuscleGroup(mg)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${form.muscle_groups.includes(mg) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>
                      {mg}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Equipamiento</label>
                <select value={form.equipment} onChange={e => setForm(f => ({ ...f, equipment: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {EQUIPMENT.map(eq => <option key={eq}>{eq}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL del GIF o imagen</label>
                <input value={form.media_url} onChange={e => setForm(f => ({ ...f, media_url: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Instrucciones</label>
                <textarea value={form.instructions} onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))} rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowForm(false); setEditId(null) }} className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Guardando...' : editId ? 'Guardar cambios' : 'Crear ejercicio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
