'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const MUSCLE_GROUPS = ['Todos','Pecho','Espalda','Hombros','Biceps','Triceps','Cuadriceps','Isquiotibiales','Gluteos','Gemelos','Core','Full Body']

interface LibraryExercise { id: string; name: string; muscle_groups: string[]; media_url: string }
interface SessionExercise {
  id: string; exercise_id: string; sets: number; reps: string; rest_seconds: number; rpe: string; order_index: number; block_name: string
  exercises: { name: string; muscle_groups: string[]; media_url: string }
}
interface Session { id: string; name: string; day_number: number; exercises: SessionExercise[]; extraBlocks: string[] }
interface Program { id: string; name: string; description: string }

export default function ProgramDetailPage() {
  const router = useRouter()
  const params = useParams()
  const programId = params.id as string
  const [program, setProgram] = useState<Program | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [libraryOpen, setLibraryOpen] = useState(true)
  const [librarySearch, setLibrarySearch] = useState('')
  const [libraryMuscle, setLibraryMuscle] = useState('Todos')
  const [libraryExercises, setLibraryExercises] = useState<LibraryExercise[]>([])
  const [showSessionForm, setShowSessionForm] = useState(false)
  const [sessionForm, setSessionForm] = useState({ name: '', day_number: 1 })
  const [showBlockForm, setShowBlockForm] = useState<string | null>(null)
  const [newBlockName, setNewBlockName] = useState('')
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null)
  const [dragOverEx, setDragOverEx] = useState<string | null>(null)
  const [blockMenu, setBlockMenu] = useState<{ sessionId: string; blockName: string; action: string } | null>(null)
  const dragLibEx = useRef<LibraryExercise | null>(null)
  const dragReorderEx = useRef<{ id: string; sessionId: string; blockName: string } | null>(null)

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data: prog } = await supabase.from('programs').select('*').eq('id', programId).single()
      setProgram(prog)
      const { data: sess } = await supabase.from('sessions').select('*').eq('program_id', programId).order('day_number')
      if (sess) {
        const withExercises = await Promise.all(sess.map(async s => {
          const { data: exs } = await supabase.from('session_exercises').select('*, exercises(name, muscle_groups, media_url)').eq('session_id', s.id).order('order_index')
          return { ...s, exercises: exs || [], extraBlocks: [] }
        }))
        setSessions(withExercises)
      }
      setLoading(false)
    }
    init()
  }, [programId, router])

  useEffect(() => {
    const search = async () => {
      const supabase = createClient()
      let query = supabase.from('exercises').select('id, name, muscle_groups, media_url').order('name').limit(30)
      if (librarySearch.length >= 2) query = query.ilike('name', `%${librarySearch}%`)
      if (libraryMuscle !== 'Todos') query = query.contains('muscle_groups', [libraryMuscle])
      const { data } = await query
      setLibraryExercises(data || [])
    }
    search()
  }, [librarySearch, libraryMuscle])

  const getBlocks = (session: Session) => Array.from(new Set([...session.exercises.map(ex => ex.block_name || 'Principal'), ...session.extraBlocks]))

  const createSession = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    const { data } = await supabase.from('sessions').insert({ ...sessionForm, program_id: programId }).select().single()
    if (data) setSessions(s => [...s, { ...data, exercises: [], extraBlocks: ['Principal'] }])
    setShowSessionForm(false)
    setSessionForm({ name: '', day_number: sessions.length + 2 })
  }

  const deleteSession = async (sessionId: string) => {
    if (!confirm('Eliminar sesion?')) return
    const supabase = createClient()
    await supabase.from('sessions').delete().eq('id', sessionId)
    setSessions(s => s.filter(x => x.id !== sessionId))
  }

  const addBlock = (sessionId: string) => {
    if (!newBlockName.trim()) return
    setSessions(s => s.map(sess => sess.id === sessionId ? { ...sess, extraBlocks: [...sess.extraBlocks, newBlockName.trim()] } : sess))
    setShowBlockForm(null)
    setNewBlockName('')
  }

  const deleteBlock = async (sessionId: string, blockName: string) => {
    if (!confirm('Eliminar bloque y sus ejercicios?')) return
    const supabase = createClient()
    const session = sessions.find(s => s.id === sessionId)
    for (const ex of session?.exercises.filter(ex => (ex.block_name || 'Principal') === blockName) || []) {
      await supabase.from('session_exercises').delete().eq('id', ex.id)
    }
    setSessions(s => s.map(sess => sess.id === sessionId
      ? { ...sess, exercises: sess.exercises.filter(ex => (ex.block_name || 'Principal') !== blockName), extraBlocks: sess.extraBlocks.filter(b => b !== blockName) }
      : sess))
    setBlockMenu(null)
  }

  const addExerciseToBlock = async (sessionId: string, blockName: string, exercise: LibraryExercise) => {
    const supabase = createClient()
    const session = sessions.find(s => s.id === sessionId)
    const blockExs = session?.exercises.filter(ex => (ex.block_name || 'Principal') === blockName) || []
    const { data } = await supabase.from('session_exercises').insert({
      session_id: sessionId, exercise_id: exercise.id, sets: 3, reps: '8-12', rest_seconds: 90, rpe: '', order_index: blockExs.length, block_name: blockName,
    }).select('*, exercises(name, muscle_groups, media_url)').single()
    if (data) setSessions(s => s.map(sess => sess.id === sessionId
      ? { ...sess, exercises: [...sess.exercises, data], extraBlocks: sess.extraBlocks.filter(b => b !== blockName) } : sess))
  }

  const reorderExercise = async (sessionId: string, blockName: string, fromId: string, toId: string) => {
    const session = sessions.find(s => s.id === sessionId)
    if (!session) return
    const blockExs = session.exercises.filter(ex => (ex.block_name || 'Principal') === blockName)
    const fromIdx = blockExs.findIndex(ex => ex.id === fromId)
    const toIdx = blockExs.findIndex(ex => ex.id === toId)
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return
    const newOrder = [...blockExs]
    const [moved] = newOrder.splice(fromIdx, 1)
    newOrder.splice(toIdx, 0, moved)
    const otherExs = session.exercises.filter(ex => (ex.block_name || 'Principal') !== blockName)
    setSessions(s => s.map(sess => sess.id === sessionId ? { ...sess, exercises: [...otherExs, ...newOrder] } : sess))
    const supabase = createClient()
    await Promise.all(newOrder.map((ex, i) => supabase.from('session_exercises').update({ order_index: i }).eq('id', ex.id)))
  }

  const copyBlockToSession = async (fromSessionId: string, blockName: string, toSessionId: string, isMove: boolean) => {
    const fromSession = sessions.find(s => s.id === fromSessionId)
    if (!fromSession) return
    const blockExs = fromSession.exercises.filter(ex => (ex.block_name || 'Principal') === blockName)
    const supabase = createClient()
    const toSession = sessions.find(s => s.id === toSessionId)
    const toBlockExs = toSession?.exercises.filter(ex => (ex.block_name || 'Principal') === blockName) || []
    const inserted = await Promise.all(blockExs.map(async (ex, i) => {
      const { data } = await supabase.from('session_exercises').insert({
        session_id: toSessionId, exercise_id: ex.exercise_id, sets: ex.sets, reps: ex.reps, rest_seconds: ex.rest_seconds, rpe: ex.rpe, order_index: toBlockExs.length + i, block_name: blockName,
      }).select('*, exercises(name, muscle_groups, media_url)').single()
      return data
    }))
    if (isMove) {
      for (const ex of blockExs) await supabase.from('session_exercises').delete().eq('id', ex.id)
    }
    setSessions(s => s.map(sess => {
      if (sess.id === toSessionId) return { ...sess, exercises: [...sess.exercises, ...inserted.filter(Boolean) as SessionExercise[]] }
      if (isMove && sess.id === fromSessionId) return { ...sess, exercises: sess.exercises.filter(ex => (ex.block_name || 'Principal') !== blockName), extraBlocks: sess.extraBlocks.filter(b => b !== blockName) }
      return sess
    }))
    setBlockMenu(null)
  }

  const updateExercise = async (sessionId: string, exId: string, field: string, value: any) => {
    setSessions(s => s.map(sess => sess.id === sessionId ? { ...sess, exercises: sess.exercises.map(ex => ex.id === exId ? { ...ex, [field]: value } : ex) } : sess))
    const supabase = createClient()
    await supabase.from('session_exercises').update({ [field]: value }).eq('id', exId)
  }

  const removeExercise = async (sessionId: string, exId: string) => {
    const supabase = createClient()
    await supabase.from('session_exercises').delete().eq('id', exId)
    setSessions(s => s.map(sess => sess.id === sessionId ? { ...sess, exercises: sess.exercises.filter(ex => ex.id !== exId) } : sess))
  }

  const moveExerciseToBlock = async (fromSessionId: string, fromBlock: string, exId: string, toSessionId: string, toBlock: string) => {
    const fromSession = sessions.find(s => s.id === fromSessionId)
    const toSession = sessions.find(s => s.id === toSessionId)
    if (!fromSession) return
    const targetBlockExs = (toSession || fromSession).exercises.filter(ex => (ex.block_name || 'Principal') === toBlock)
    const supabase = createClient()
    await supabase.from('session_exercises').update({ block_name: toBlock, session_id: toSessionId, order_index: targetBlockExs.length }).eq('id', exId)
    setSessions(s => s.map(sess => {
      if (sess.id === fromSessionId && sess.id === toSessionId) {
        return { ...sess, exercises: sess.exercises.map(ex => ex.id === exId ? { ...ex, block_name: toBlock, order_index: targetBlockExs.length } : ex) }
      }
      if (sess.id === fromSessionId) return { ...sess, exercises: sess.exercises.filter(ex => ex.id !== exId) }
      if (sess.id === toSessionId) {
        const movedEx = fromSession.exercises.find(ex => ex.id === exId)
        if (movedEx) return { ...sess, exercises: [...sess.exercises, { ...movedEx, block_name: toBlock, order_index: targetBlockExs.length }] }
      }
      return sess
    }))
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Cargando...</div>

  return (
    <div className="h-screen flex flex-col bg-gray-100" onClick={() => setBlockMenu(null)}>
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 flex-shrink-0">
        <button onClick={() => router.push('/dashboard/programs')} className="text-gray-500 hover:text-gray-700 text-sm">Volver</button>
        <h1 className="text-lg font-bold text-blue-600 flex-1">{program?.name}</h1>
        <button onClick={() => setShowSessionForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">+ Nueva sesion</button>
        <button onClick={() => setLibraryOpen(o => !o)} className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${libraryOpen ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
          {libraryOpen ? 'Cerrar biblioteca' : 'Biblioteca'}
        </button>
      </nav>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
          <div className="flex gap-4 h-full" style={{ minWidth: 'max-content' }}>
            {sessions.length === 0 && (
              <div className="flex items-center justify-center min-w-96">
                <div className="text-center text-gray-400">
                  <p className="mb-3 text-sm">Sin sesiones todavia</p>
                  <button onClick={() => setShowSessionForm(true)} className="text-blue-600 hover:underline text-sm font-medium">Crear primera sesion</button>
                </div>
              </div>
            )}
            {sessions.map(session => {
              const allBlocks = getBlocks(session)
              const blocks = allBlocks.length === 0 ? ['Principal'] : allBlocks
              return (
                <div key={session.id} className="w-72 flex-shrink-0 flex flex-col rounded-2xl bg-white border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{session.name}</p>
                      <p className="text-xs text-gray-400">Dia {session.day_number}</p>
                    </div>
                    <button onClick={() => deleteSession(session.id)} className="text-gray-300 hover:text-red-400 text-lg leading-none">x</button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3 space-y-4">
                    {blocks.map(blockName => {
                      const blockExercises = session.exercises.filter(ex => (ex.block_name || 'Principal') === blockName)
                      const targetKey = session.id + ':' + blockName
                      const isDragOver = dragOverTarget === targetKey
                      const isMenuOpen = blockMenu?.sessionId === session.id && blockMenu?.blockName === blockName
                      return (
                        <div key={blockName}>
                          <div className="flex items-center justify-between mb-1 px-1" onClick={e => e.stopPropagation()}>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{blockName}</p>
                            <div className="relative">
                              <button
                                onClick={e => { e.stopPropagation(); setBlockMenu(isMenuOpen ? null : { sessionId: session.id, blockName, action: 'menu' }) }}
                                className="text-xs text-gray-400 hover:text-blue-500 px-1.5 py-0.5 rounded hover:bg-gray-100 font-bold"
                              >···</button>
                           {isMenuOpen && (
                                <div className="absolute right-0 top-6 bg-white rounded-xl shadow-lg border border-gray-200 z-30 w-44 py-1" onClick={e => e.stopPropagation()}>
                                  {blockMenu.action === 'menu' && (
                                    <>
                                      <button onClick={() => setBlockMenu({ ...blockMenu, action: 'copy' })} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50">Copiar a otro dia</button>
                                      <button onClick={() => setBlockMenu({ ...blockMenu, action: 'move' })} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50">Mover a otro dia</button>
                                      <div className="border-t border-gray-100 my-1"></div>
                                      <button onClick={() => deleteBlock(session.id, blockName)} className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-50">Eliminar bloque</button>
                                    </>
                                  )}
                                  {(blockMenu.action === 'copy' || blockMenu.action === 'move') && (
                                    <>
                                      <p className="px-3 py-1.5 text-xs font-semibold text-gray-500">{blockMenu.action === 'copy' ? 'Copiar a:' : 'Mover a:'}</p>
                                      {sessions.filter(s => s.id !== session.id).length === 0 && <p className="px-3 py-2 text-xs text-gray-400">No hay otros dias</p>}
                                      {sessions.filter(s => s.id !== session.id).map(s => (
                                        <button key={s.id} onClick={() => copyBlockToSession(session.id, blockName, s.id, blockMenu.action === 'move')} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 truncate">{s.name}</button>
                                      ))}
                                      <button onClick={() => setBlockMenu({ ...blockMenu, action: 'menu' })} className="w-full text-left px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-50 border-t border-gray-100 mt-1">Volver</button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          <div
                            className={'min-h-14 rounded-xl border-2 border-dashed p-2 space-y-1.5 transition-colors ' + (isDragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200')}
                            onDragOver={e => {
                              if (dragLibEx.current) { e.preventDefault(); setDragOverTarget(targetKey) }
                              else if (dragReorderEx.current) {
                                const { sessionId: fromSessId, blockName: fromBlock } = dragReorderEx.current
                                if (fromSessId !== session.id || fromBlock !== blockName) { e.preventDefault(); setDragOverTarget(targetKey) }
                              }
                            }}
                            onDragLeave={() => setDragOverTarget(null)}
                            onDrop={e => {
                              e.preventDefault()
                              setDragOverTarget(null)
                              if (dragLibEx.current) { addExerciseToBlock(session.id, blockName, dragLibEx.current); dragLibEx.current = null }
                              else if (dragReorderEx.current) {
                                const { id: fromId, sessionId: fromSessId, blockName: fromBlock } = dragReorderEx.current
                                if (fromSessId !== session.id || fromBlock !== blockName) moveExerciseToBlock(fromSessId, fromBlock, fromId, session.id, blockName)
                                dragReorderEx.current = null
                              }
                              setDragOverEx(null)
                            }}
                          >
                            {blockExercises.length === 0 && <p className="text-xs text-gray-300 text-center py-3">Arrastra ejercicios aqui</p>}
                            {blockExercises.map(ex => (
                              <div
                                key={ex.id}
                                draggable
                                onDragStart={e => { e.stopPropagation(); dragReorderEx.current = { id: ex.id, sessionId: session.id, blockName }; dragLibEx.current = null }}
                                onDragEnd={() => { dragReorderEx.current = null; setDragOverEx(null) }}
                                onDragOver={e => {
                                  if (dragReorderEx.current && dragReorderEx.current.id !== ex.id) { e.preventDefault(); e.stopPropagation(); setDragOverEx(ex.id) }
                                }}
                                onDragLeave={() => setDragOverEx(null)}
                                onDrop={e => {
                                  e.preventDefault(); e.stopPropagation()
                                  if (dragReorderEx.current && dragReorderEx.current.id !== ex.id) {
                                    const { id: fromId, sessionId: fromSessId, blockName: fromBlock } = dragReorderEx.current
                                    if (fromSessId === session.id && fromBlock === blockName) reorderExercise(session.id, blockName, fromId, ex.id)
                                  }
                                  dragReorderEx.current = null; setDragOverEx(null)
                                }}
                                className={'bg-white rounded-xl border p-2.5 cursor-grab active:cursor-grabbing transition-all ' + (dragOverEx === ex.id ? 'border-blue-400 border-t-[3px] shadow-sm' : 'border-gray-200')}
                              >
                                <div className="flex items-center gap-2 mb-2">
                                  {ex.exercises?.media_url && <img src={ex.exercises.media_url} alt="" className="w-8 h-8 rounded-lg object-cover bg-gray-100 flex-shrink-0" />}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-gray-900 truncate capitalize">{ex.exercises?.name}</p>
                                    <p className="text-xs text-gray-400 truncate">{ex.exercises?.muscle_groups?.join(', ')}</p>
                                  </div>
                                  <button onClick={() => removeExercise(session.id, ex.id)} className="text-gray-200 hover:text-red-400 text-sm flex-shrink-0 ml-1">x</button>
                                </div>
                                <div className="grid grid-cols-4 gap-1">
                                  {[
                                    { label: 'Series', field: 'sets', type: 'number', value: ex.sets },
                                    { label: 'Reps', field: 'reps', type: 'text', value: ex.reps },
                                    { label: 'Desc', field: 'rest_seconds', type: 'number', value: ex.rest_seconds },
                                    { label: 'RPE', field: 'rpe', type: 'text', value: ex.rpe },
                                  ].map(f => (
                                    <div key={f.field}>
                                      <p className="text-xs text-gray-400 text-center mb-0.5">{f.label}</p>
                                      <input
                                        type={f.type}
                                        value={f.value}
                                        onDragStart={e => e.stopPropagation()}
                                        onChange={e => updateExercise(session.id, ex.id, f.field, f.type === 'number' ? parseInt(e.target.value) : e.target.value)}
                                        className="w-full border border-gray-200 rounded px-1 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}

                    {showBlockForm === session.id ? (
                      <div className="flex gap-2">
                        <input type="text" value={newBlockName} onChange={e => setNewBlockName(e.target.value)} placeholder="Nombre del bloque" autoFocus
                          onKeyDown={e => { if (e.key === 'Enter') addBlock(session.id); if (e.key === 'Escape') setShowBlockForm(null) }}
                          className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        <button onClick={() => addBlock(session.id)} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium">OK</button>
                      </div>
                    ) : (
                      <button onClick={() => { setShowBlockForm(session.id); setNewBlockName('') }} className="w-full text-xs text-gray-400 hover:text-blue-600 py-2 border border-dashed border-gray-200 rounded-xl hover:border-blue-300 transition-colors">
                        + Nuevo bloque
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {libraryOpen && (
          <div className="w-64 flex-shrink-0 bg-white border-l border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-100 space-y-2">
              <p className="font-semibold text-gray-900 text-sm">Ejercicios</p>
              <input type="text" value={librarySearch} onChange={e => setLibrarySearch(e.target.value)} placeholder="Buscar ejercicio..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <select value={libraryMuscle} onChange={e => setLibraryMuscle(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {MUSCLE_GROUPS.map(mg => <option key={mg}>{mg}</option>)}
              </select>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              <p className="text-xs text-gray-400 mb-2">Arrastra hacia un bloque</p>
              {libraryExercises.map(ex => (
                <div key={ex.id} draggable onDragStart={() => { dragLibEx.current = ex; dragReorderEx.current = null }} onDragEnd={() => { dragLibEx.current = null }}
                  className="flex items-center gap-2 p-2 rounded-xl border border-gray-200 cursor-grab active:cursor-grabbing hover:bg-blue-50 hover:border-blue-200 transition-colors select-none">
                  {ex.media_url && <img src={ex.media_url} alt="" className="w-9 h-9 rounded-lg object-cover bg-gray-100 flex-shrink-0" />}
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-900 capitalize truncate">{ex.name}</p>
                    <p className="text-xs text-gray-400 truncate">{ex.muscle_groups?.join(', ')}</p>
                  </div>
                </div>
              ))}
              {librarySearch.length < 2 && libraryMuscle === 'Todos' && <p className="text-center text-gray-300 text-xs pt-4">Escribe para buscar o filtra por musculo</p>}
            </div>
          </div>
        )}
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
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowSessionForm(false)} className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm">Cancelar</button>
                <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Crear</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
