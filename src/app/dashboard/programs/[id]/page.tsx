'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

interface Session {
  id: string
  name: string
  day_number: number
  notes: string
}

interface SessionExercise {
  id: string
  exercise_id: string
  sets: number
  reps: string
  rest_seconds: number
  rpe: string
  notes: string
  order_index: number
  exercises?: { name: string; media_url: string }
}

interface Program {
  id: string
  name: string
  description: string
}

export default function ProgramDetailPage() {
  const router = useRouter()
  const params = useParams()
  const programId = params.id as string

  const [program, setProgram] = useState<Program | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [sessionExercises, setSessionExercises] = useState<SessionExercise[]>([])
  const [showSessionForm, setShowSessionForm] = useState(false)
  const [showExerciseSearch, setShowExerciseSearch] = useState(false)
  const [sessionForm, setSessionForm] = useState({ name: '', day_number: 1, notes: '' })
  const [exerciseSearch, setExerciseSearch] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data: prog } = await supabase.from('programs').select('*').eq('id', programId).single()
      setProgram(prog)
      const { data: sess } = await supabase.from('sessions').select('*').eq('program_id', programId).order('day_number')
      setSessions(sess || [])
      setLoading(false)
    }
    init()
  }, [programId, router])

  const loadSessionExercises = async (sessionId: string) => {
    const supabase = createClient()
    const { data } = await supabase
      .from('session_exercises')
      .select('*, exercises(name, media_url)')
      .eq('session_id', sessionId)
      .order('order_index')
    setSessionExercises(data || [])
  }

  const selectSession = (session: Session) => {
    setSelectedSession(session)
    loadSessionExercises(session.id)
  }

  const createSession = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    const { data } = await supabase.from('sessions').insert({ ...sessionForm, program_id: programId }).select().single()
    setSessions(s => [...s, data])
    setShowSessionForm(false)
    setSessionForm({ name: '', day_number: 1, notes: '' })
    selectSession(data)
  }

  const deleteSession = async (id: string) => {
    if (!confirm('Eliminar sesion?')) return
    const supabase = createClient()
    await supabase.from('sessions').delete().eq('id', id)
    setSessions(s => s.filter(x => x.id !== id))
    if (selectedSession?.id === id) { setSelectedSession(null); setSessionExercises([]) }
  }

  const searchExercises = async (query: string) => {
    setExerciseSearch(query)
    if (query.length < 2) { setSearchResults([]); return }
    const supabase = createClient()
    const { data } = await supabase.from('exercises').select('id, name, muscle_groups, media_url').ilike('name', `%${query}%`).limit(8)
    setSearchResults(data || [])
  }

  const addExercise = async (exercise: any) => {
    if (!selectedSession) return
    const supabase = createClient()
    const { data } = await supabase.from('session_exercises').insert({
      session_id: selectedSession.id,
      exercise_id: exercise.id,
      sets: 3,
      reps: '8-12',
      rest_seconds: 90,
      rpe: '',
      notes: '',
      order_index: sessionExercises.length,
    }).select('*, exercises(name, media_url)').single()
    setSessionExercises(ex => [...ex, data])
    setShowExerciseSearch(false)
    setExerciseSearch('')
    setSearchResults([])
  }

  const updateExercise = async (id: string, field: string, value: any) => {
    setSessionExercises(exs => exs.map(ex => ex.id === id ? { ...ex, [field]: value } : ex))
    const supabase = createClient()
    await supabase.from('session_exercises').update({ [field]: value }).eq('id', id)
  }

  const removeExercise = async (id: string) => {
    const supabase = createClient()
    await supabase.from('session_exercises').delete().eq('id', id)
    setSessionExercises(exs => exs.filter(ex => ex.id !== id))
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Cargando...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.push('/dashboard/programs')} className="text-gray-500 hover:text-gray-700 text-sm">Volver</button>
        <div>
          <h1 className="text-xl font-bold text-blue-600">{program?.name}</h1>
          {program?.description && <p className="text-xs text-gray-400">{program.description}</p>}
        </div>
      </nav>

      <div className="flex h-[calc(100vh-65px)]">
        <div className="w-72 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-100">
            <button
              onClick={() => setShowSessionForm(true)}
              className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              + Nueva sesion
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {sessions.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">Sin sesiones todavia</p>
            ) : (
              sessions.map(s => (
                <div
                  key={s.id}
                  onClick={() => selectSession(s)}
                  className={`p-3 rounded-xl cursor-pointer transition-colors ${selectedSession?.id === s.id ? 'bg-blue-50 border-2 border-blue-200' : 'border border-gray-200 hover:bg-gray-50'}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm text-gray-900">{s.name}</p>
                      <p className="text-xs text-gray-400">Dia {s.day_number}</p>
                    </div>
                    <button onClick={e => { e.stopPropagation(); deleteSession(s.id) }} className="text-red-300 hover:text-red-500 text-xs">x</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {!selectedSession ? (
            <div className="text-center py-20 text-gray-400">
              <p>Selecciona una sesion para ver sus ejercicios</p>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">{selectedSession.name}</h2>
                <button
                  onClick={() => setShowExerciseSearch(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                  + Agregar ejercicio
                </button>
              </div>

              {sessionExercises.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <p className="mb-3">Sin ejercicios en esta sesion</p>
                  <button onClick={() => setShowExerciseSearch(true)} className="text-blue-600 hover:underline text-sm">Agregar ejercicio</button>
                </div>
              ) : (
                <div className="space-y-3">
                  {sessionExercises.map((ex, idx) => (
                    <div key={ex.id} className="bg-white rounded-xl border border-gray-200 p-4 flex gap-4 items-start">
                      {ex.exercises?.media_url && (
                        <img src={ex.exercises.media_url} alt="" className="w-16 h-16 rounded-lg object-cover bg-gray-100 flex-shrink-0" />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-3">
                          <p className="font-medium text-gray-900 capitalize">{ex.exercises?.name}</p>
                          <button onClick={() => removeExercise(ex.id)} className="text-red-300 hover:text-red-500 text-xs">Quitar</button>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          <div>
                            <label className="text-xs text-gray-400 block mb-1">Series</label>
                            <input
                              type="number"
                              value={ex.sets}
                              onChange={e => updateExercise(ex.id, 'sets', parseInt(e.target.value))}
                              className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-400 block mb-1">Reps</label>
                            <input
                              type="text"
                              value={ex.reps}
                              onChange={e => updateExercise(ex.id, 'reps', e.target.value)}
                              className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-400 block mb-1">Descanso</label>
                            <input
                              type="number"
                              value={ex.rest_seconds}
                              onChange={e => updateExercise(ex.id, 'rest_seconds', parseInt(e.target.value))}
                              className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-400 block mb-1">RPE</label>
                            <input
                              type="text"
                              value={ex.rpe}
                              onChange={e => updateExercise(ex.id, 'rpe', e.target.value)}
                              placeholder="7-8"
                              className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showSessionForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Nueva sesion</h2>
            <form onSubmit={createSession} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input value={sessionForm.name} onChange={e => setSessionForm(f => ({ ...f, name: e.target.value }))} required placeholder="Ej: Dia A - Pecho y Triceps" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Numero de dia</label>
                <input type="number" value={sessionForm.day_number} onChange={e => setSessionForm(f => ({ ...f, day_number: parseInt(e.target.value) }))} min={1} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
                <textarea value={sessionForm.notes} onChange={e => setSessionForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowSessionForm(false)} className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm font-medium">Cancelar</button>
                <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Crear sesion</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showExerciseSearch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Agregar ejercicio</h2>
            <input
              type="text"
              value={exerciseSearch}
              onChange={e => searchExercises(e.target.value)}
              placeholder="Buscar ejercicio..."
              autoFocus
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
            />
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {searchResults.map(ex => (
                <div key={ex.id} onClick={() => addExercise(ex)} className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer hover:bg-blue-50 hover:border-blue-200 transition-colors">
                  {ex.media_url && <img src={ex.media_url} alt="" className="w-12 h-12 rounded-lg object-cover bg-gray-100" />}
                  <div>
                    <p className="text-sm font-medium text-gray-900 capitalize">{ex.name}</p>
                    <p className="text-xs text-gray-400">{ex.muscle_groups?.join(', ')}</p>
                  </div>
                </div>
              ))}
              {exerciseSearch.length >= 2 && searchResults.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-4">Sin resultados</p>
              )}
            </div>
            <button onClick={() => { setShowExerciseSearch(false); setExerciseSearch(''); setSearchResults([]) }} className="w-full mt-4 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
