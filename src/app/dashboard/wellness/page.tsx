'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

interface WellnessLog {
  id: string; date: string; sleep_quality: number; fatigue: number; soreness: number; mood: number; notes: string
}

const METRICS = [
  { key: 'sleep_quality', label: 'Calidad del sueno', low: 'Muy mala', high: 'Excelente', invert: false },
  { key: 'fatigue', label: 'Fatiga', low: 'Sin fatiga', high: 'Exhausto', invert: true },
  { key: 'soreness', label: 'Dolor muscular', low: 'Sin dolor', high: 'Mucho dolor', invert: true },
  { key: 'mood', label: 'Estado de animo', low: 'Muy bajo', high: 'Excelente', invert: false },
]

function scoreColor(value: number, invert: boolean) {
  const s = invert ? 11 - value : value
  if (s >= 7) return 'bg-green-100 text-green-700'
  if (s >= 4) return 'bg-yellow-100 text-yellow-700'
  return 'bg-red-100 text-red-700'
}

export default function WellnessPage() {
  const router = useRouter()
  const [todayLog, setTodayLog] = useState<WellnessLog | null>(null)
  const [editing, setEditing] = useState(false)
  const [history, setHistory] = useState<WellnessLog[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ sleep_quality: 7, fatigue: 3, soreness: 3, mood: 7, notes: '' })
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data: todayData } = await supabase.from('wellness_logs').select('*').eq('athlete_id', user.id).eq('date', today).maybeSingle()
      if (todayData) { setTodayLog(todayData); setForm(todayData) }
      const { data: hist } = await supabase.from('wellness_logs').select('*').eq('athlete_id', user.id).order('date', { ascending: false }).limit(7)
      setHistory(hist || [])
      setLoading(false)
    }
    init()
  }, [router, today])

  const saveLog = async () => {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase.from('wellness_logs')
      .upsert({ ...form, athlete_id: user!.id, date: today }, { onConflict: 'athlete_id,date' })
      .select().single()
    if (data) {
      setTodayLog(data)
      setEditing(false)
      setHistory(h => [data, ...h.filter(x => x.date !== today)])
    }
    setSaving(false)
  }

  const formatDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Cargando...</div>

  const showForm = !todayLog || editing

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.push('/dashboard')} className="text-gray-500 hover:text-gray-700 text-sm">Volver</button>
        <h1 className="text-lg font-bold text-blue-600 flex-1">Wellness diario</h1>
      </nav>

      <main className="max-w-xl mx-auto px-6 py-8 space-y-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-bold text-gray-900 text-lg">Hoy — {formatDate(today)}</h2>
              {todayLog && !editing && <p className="text-xs text-green-600 mt-0.5 font-medium">Registrado</p>}
            </div>
            {todayLog && !editing && (
              <button onClick={() => setEditing(true)} className="text-xs text-blue-600 hover:underline">Editar</button>
            )}
          </div>

          {!showForm ? (
            <div className="grid grid-cols-2 gap-3">
              {METRI.map(m => (
                <div key={m.key} className={`rounded-xl p-4 ${scoreColor((todayLog as any)[m.key], m.invert)}`}>
                  <p className="text-xs font-medium opacity-70 mb-1">{m.label}</p>
                  <p className="text-3xl font-bold">{(todayLog as any)[m.key]}<span className="text-sm font-normal opacity-50">/10</span></p>
                </div>
              ))}
              {todayLog?.notes && (
                <div className="col-span-2 bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-400 mb-1">Notas</p>
                  <p className="text-sm text-gray-700">{todayLog.notes}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {METRICS.map(m => (
                <div key={m.key}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-semibold text-gray-800">{m.label}</label>
                    <span className={`text-lg font-bold px-2 py-0.5 rounded-lg ${scoreColor((form as any)[m.key], m.invert)}`}>{(form as any)[m.key]}</span>
                  </div>
                  <input
                    type="range" min={1} max={10}
                    value={(form as any)[m.key]}
                    onChange={e => setForm(f => ({ ...f, [m.key]: parseInt(e.target.value) }))}
                    className="w-full accent-blue-600 h-2 cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>{m.low}</span><span>{m.high}</span>
                  </div>
                </div>
              ))}
              <div>
                <label className="text-sm font-semibold text-gray-800 block mb-2">Notas (opcional)</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Como te sentis hoy..."
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <div className="flex gap-3">
                {editing && (
                  <button onClick={() => setEditing(false)} className="flex-1 border border-gray-300 text-gray-600 py-3 rounded-xl text-sm">Cancelar</button>
                )}
                <button onClick={saveLog} disabled={saving} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Guardando...' : 'Registrar wellness'}
                </button>
              </div>
            </div>
          )}
        </div>

        {history.filter(l => l.date !== today || !todayLog).length === 0 && history.length > 0 || history.length > 1 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h3 className="font-bold text-gray-900 mb-4">Ultimos registros</h3>
            <div className="space-y-3">
              {history.slice(0, 7).map(log => (
                <div key={log.id} className="flex items-center gap-3">
                  <p className="text-xs text-gray-500 w-20 flex-shrink-0">{formatDate(log.date)}</p>
                  <div className="flex gap-1.5 flex-1">
                    {METRICS.map(m => (
                      <div key={m.key} className={`flex-1 rounded-lg py-1 text-center text-xs font-bold ${scoreColor((log as any)[m.key], m.invert)}`}>
                        {(log as any)[m.key]}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex gap-1.5 mt-1 pl-23">
                <div className="w-20 flex-shrink-0"></div>
                {METRICS.map(m => (
                  <p key={m.key} className="flex-1 text-center text-xs text-gray-300 truncate">{m.label.split(' ')[0]}</p>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  )
}
