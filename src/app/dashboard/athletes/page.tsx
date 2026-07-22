'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

interface Assignment { id: string; program_id: string; programs: { name: string } }
interface Athlete { id: string; full_name: string; assignments: Assignment[] }
interface Program { id: string; name: string }

export default function AthletesPage() {
  const router = useRouter()
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addEmail, setAddEmail] = useState('')
  const [searching, setSearching] = useState(false)
  const [assigningTo, setAssigningTo] = useState<string | null>(null)
  const [userId, setUserId] = useState<string>('')

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setUserId(user.id)

      const { data: caRows } = await supabase.from('coach_athletes').select('athlete_id').eq('coach_id', user.id)
      const athleteIds = caRows?.map(r => r.athlete_id) || []

      let profilesData: any[] = []
      if (athleteIds.length > 0) {
        const { data } = await supabase.from('profiles').select('id, full_name').in('id', athleteIds)
        profilesData = data || []
      }

      const { data: assignments } = await supabase
        .from('program_assignments')
        .select('*, programs(name)')
        .eq('coach_id', user.id)
        .eq('is_active', true)

      const { data: progs } = await supabase.from('programs').select('id, name').order('name')

      const byAthlete = new Map<string, Assignment[]>()
      assignments?.forEach((a: any) => {
        if (!byAthlete.has(a.athlete_id)) byAthlete.set(a.athlete_id, [])
        byAthlete.get(a.athlete_id)!.push(a)
      })

      setAthletes(profilesData.map(p => ({ id: p.id, full_name: p.full_name, assignments: byAthlete.get(p.id) || [] })))
      setPrograms(progs || [])
      setLoading(false)
    }
    init()
  }, [router])

  const addAthlete = async () => {
    if (!addEmail.trim()) return
    setSearching(true)
    const supabase = createClient()
    const { data, error } = await supabase.rpc('find_athlete_by_email', { p_email: addEmail.trim().toLowerCase() })
    if (error || !data || data.length === 0) {
      alert('No se encontro ningun atleta con ese email. Asegurate de que tenga cuenta en TrainOS con rol Atleta.')
      setSearching(false)
      return
    }
    const athlete = data[0]
    if (athletes.find(a => a.id === athlete.id)) {
      alert('Este atleta ya esta en tu lista')
      setSearching(false)
      return
    }
    await supabase.from('coach_athletes').insert({ coach_id: userId, athlete_id: athlete.id })
    setAthletes(a => [...a, { id: athlete.id, full_name: athlete.full_name, assignments: [] }])
    setShowAddForm(false)
    setAddEmail('')
    setSearching(false)
  }

  const removeAthlete = async (athleteId: string) => {
    if (!confirm('Quitar atleta de tu lista?')) return
    const supabase = createClient()
    await supabase.from('coach_athletes').delete().eq('coach_id', userId).eq('athlete_id', athleteId)
    setAthletes(a => a.filter(x => x.id !== athleteId))
  }

  const assignProgram = async (athleteId: string, programId: string) => {
    const athlete = athletes.find(a => a.id === athleteId)
    if ((athlete?.assignments?.length || 0) >= 3) {
      alert('Este atleta ya tiene 3 programas asignados (maximo permitido)')
      return
    }
    if (athlete?.assignments?.find(a => a.program_id === programId)) {
      alert('Este programa ya esta asignado a este atleta')
      return
    }
    const supabase = createClient()
    const { data } = await supabase.from('program_assignments').insert({
      program_id: programId, athlete_id: athleteId, coach_id: userId,
      start_date: new Date().toISOString().split('T')[0]
    }).select('*, programs(name)').single()
    if (data) {
      setAthletes(a => a.map(athlete =>
        athlete.id === athleteId ? { ...athlete, assignments: [...athlete.assignments, data] } : athlete
      ))
    }
    setAssigningTo(null)
  }

  const removeAssignment = async (athleteId: string, assignmentId: string) => {
    const supabase = createClient()
    await supabase.from('program_assignments').delete().eq('id', assignmentId)
    setAthletes(a => a.map(athlete =>
      athlete.id === athleteId ? { ...athlete, assignments: athlete.assignments.filter(x => x.id !== assignmentId) } : athlete
    ))
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Cargando...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.push('/dashboard')} className="text-gray-500 hover:text-gray-700 text-sm">Volver</button>
        <h1 className="text-lg font-bold text-blue-600 flex-1">Mis atletas</h1>
        <button onClick={() => setShowAddForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">+ Agregar atleta</button>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {athletes.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg mb-2">Sin atletas todavia</p>
            <button onClick={() => setShowAddForm(true)} className="text-blue-600 hover:underline text-sm">Agregar tu primer atleta</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {athletes.map(athlete => {
              const availablePrograms = programs.filter(p => !athlete.assignments.find(a => a.program_id === p.id))
              const canAssignMore = athlete.assignments.length < 3
              return (
                <div key={athlete.id} className="bg-white rounded-2xl border border-gray-200 p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-blue-600 font-bold text-sm">{(athlete.full_name || 'A')[0].toUpperCase()}</span>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{athlete.full_name || 'Sin nombre'}</p>
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Atleta</span>
                      </div>
                    </div>
                    <button onClick={() => removeAthlete(athlete.id)} className="text-gray-300 hover:text-red-400 text-sm ml-2">x</button>
                  </div>

                  <div className="border-t border-gray-100 pt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-400">Programas asignados ({athlete.assignments.length}/3)</p>
                      {canAssignMore && (
                        <button onClick={() => setAssigningTo(assigningTo === athlete.id ? null : athlete.id)} className="text-xs text-blue-600 hover:underline">+ Asignar</button>
                      )}
                    </div>

                    {athlete.assignments.length === 0 && (
                      <p className="text-sm text-gray-300 italic">Sin programas asignados</p>
                    )}

                    {athlete.assignments.map(assignment => (
                      <div key={assignment.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
                        <p className="text-sm font-medium text-gray-800 truncate flex-1">{assignment.programs?.name}</p>
                        <button onClick={() => removeAssignment(athlete.id, assignment.id)} className="text-gray-300 hover:text-red-400 text-xs ml-2 flex-shrink-0">Quitar</button>
                      </div>
                    ))}

                    {assigningTo === athlete.id && (
                      <div className="bg-gray-50 rounded-xl p-2 space-y-1 mt-1">
                        {availablePrograms.length === 0 && <p className="text-xs text-gray-400 px-2 py-1">No hay mas programas disponibles</p>}
                        {availablePrograms.map(prog => (
                          <button key={prog.id} onClick={() => assignProgram(athlete.id, prog.id)} className="w-full text-left px-3 py-2 text-sm hover:bg-white rounded-lg transition-colors">{prog.name}</button>
                        ))}
                        <button onClick={() => setAssigningTo(null)} className="w-full text-left px-3 py-1.5 text-xs text-gray-400 hover:bg-white rounded-lg border-t border-gray-100 mt-1">Cancelar</button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Agregar atleta</h2>
            <p className="text-sm text-gray-400 mb-4">El atleta debe tener cuenta en TrainOS con rol Atleta</p>
            <input
              type="email" value={addEmail} onChange={e => setAddEmail(e.target.value)}
              placeholder="Email del atleta" autoFocus
              onKeyDown={e => e.key === 'Enter' && addAthlete()}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => { setShowAddForm(false); setAddEmail('') }} className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm">Cancelar</button>
              <button onClick={addAthlete} disabled={searching} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {searching ? 'Buscando...' : 'Agregar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
