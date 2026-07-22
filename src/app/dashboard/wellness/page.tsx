'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

interface WellnessLog {
  id: string; date: string
  sleep_quality: number; sleep_hours: number
  fatigue: number; soreness: number; stress: number
  energy: number; motivation: number; mood: number
  notes: string
}

const SLIDERS = [
  { key: 'sleep_quality', label: 'Calidad del sueno', low: 'Muy mala', high: 'Excelente', invert: false },
  { key: 'sleep_hours', label: 'Horas de sueno', low: '4h', high: '10h', invert: false, min: 4, max: 10, step: 0.5, isHours: true },
  { key: 'energy', label: 'Nivel de energia', low: 'Sin energia', high: 'Muy energico', invert: false },
  { key: 'motivation', label: 'Motivacion para entrenar', low: 'Sin motivacion', high: 'Muy motivado', invert: false },
  { key: 'mood', label: 'Estado de animo', low: 'Muy bajo', high: 'Excelente', invert: false },
  { key: 'fatigue', label: 'Fatiga acumulada', low: 'Sin fatiga', high: 'Exhausto', invert: true },
  { key: 'soreness', label: 'Dolor muscular', low: 'Sin dolor', high: 'Mucho dolor', invert: true },
  { key: 'stress', label: 'Estres', low: 'Sin estres', high: 'Muy estresado', invert: true },
]

const SCORE_METRICS = ['sleep_quality', 'energy', 'motivation', 'mood', 'fatigue', 'soreness', 'stress']

function calcScore(log: WellnessLog): number {
  const vals = SCORE_METRICS.map(k => {
    const v = (log as any)[k]
    const slider = SLIDERS.find(s => s.key === k)
    return slider?.invert ? 11 - v : v
  })
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
}

function scoreLabel(score: number): { text: string; color: string; bg: string; ring: string } {
  if (score >= 7.5) return { text: 'Listo para entrenar fuerte', color: 'text-green-700', bg: 'bg-green-50', ring: 'ring-green-200' }
  if (score >= 5) return { text: 'Carga moderada recomendada', color: 'text-yellow-700', bg: 'bg-yellow-50', ring: 'ring-yellow-200' }
  return { text: 'Priorizar recuperacion hoy', color: 'text-red-700', bg: 'bg-red-50', ring: 'ring-red-200' }
}

function metricColor(value: number, invert: boolean) {
  const s = invert ? 11 - value : value
  if (s >= 7) return 'bg-green-100 text-green-700'
  if (s >= 4) return 'bg-yellow-100 text-yellow-700'
  return 'bg-red-100 text-red-700'
}

const DEFAULT_FORM = { sleep_quality: 7, sleep_hours: 7.5, energy: 7, motivation: 7, mood: 7, fatigue: 3, soreness: 3, stress: 3, notes: '' }

export default function WellnessPage() {
  const router = useRouter()
  const [todayLog, setTodayLog] = useState<WellnessLog | null>(null)
  const [editing, setEditing] = useState(false)
  const [history, setHistory] = useState<WellnessLog[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>(DEFAULT_FORM)
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data: todayData } = await supabase.from('wellness_logs').select('*').eq('athlete_id', user.id).eq('date', today).maybeSingle()
      if (todayData) { setTodayLog(todayData); setForm({ ...DEFAULT_FORM, ...todayData }) }
      const { data: hist } = await supabase.from('wellness_logs').select('*').eq('athlete_id', user.id).order('date', { ascending: false }).limit(8)
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
  const score = todayLog ? calcScore(todayLog) : null
  const label = score !== null ? scoreLabel(score) : null

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.push('/dashboard')} className="text-gray-500 hover:text-gray-700 text-sm">Volver</button>
        <h1 className="text-lg font-bold text-blue-600 flex-1">Wellness diario</h1>
      </nav>

      <main className="max-w-xl mx-auto px-6 py-8 space-y-6">

        {/* Resultado de hoy */}
        {todayLog && !editing && score !== null && label && (
          <div className={`rounded-2xl p-6 ring-2 ${label.bg} ${label.ring}`}>
            <p className="text-xs font-medium text-gray-500 mb-1">Hoy — {formatDate(today)}</p>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className={`text-5xl font-black ${label.color}`}>{score}<span className="text-xl font-normal opacity-50">/10</span></p>
                <p className={`text-sm font-semibold mt-1 ${label.color}`}>{label.text}</p>
              </div>
              <button onClick={() => setEditing(true)} className="text-xs text-gray-400 hover:underline self-start">Editar</button>
            </div>

            {/* Metricas individuales */}
            <div className="grid grid-cols-4 gap-2 mb-5">
              {SLIDERS.filter(s => !s.isHours).p(s => (
                <div key={s.key} className={`rounded-xl p-2 text-center ${metricColor((todayLog as any)[s.key], s.invert)}`}>
                  <p className="text-xs opacity-70 mb-0.5 leading-tight">{s.label.split(' ')[0]}</p>
                  <p className="text-lg font-bold">{(todayLog as any)[s.key]}</p>
                </div>
              ))}
              <div className="rounded-xl p-2 text-center bg-blue-50 text-blue-700">
                <p className="text-xs opacity-70 mb-0.5 leading-tight">Sueno</p>
                <p className="text-lg font-bold">{todayLog.sleep_hours}h</p>
              </div>
            </div>

            {todayLog.notes && (
              <div className="bg-white bg-opacity-60 rounded-xl px-3 py-2 mb-4">
                <p className="text-xs text-gray-400 mb-0.5">Notas</p>
                <p className="text-sm text-gray-700">{todayLog.notes}</p>
              </div>
            )}

            {/* Botones de accion */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => router.push('/dashboard/training')}
                className="bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
              >
                Entrenamiento de hoy
              </button>
              <button
                onClick={() => router.push('/dashboard/programs')}
                className="bg-white text-gray-700 py-3 rounded-xl text-sm font-semibold border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                Planning mensual
              </button>
            </div>
          </div>
        )}

        {/* Formulario */}
        {showForm && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-bold text-gray-900 text-lg">Como estas hoy?</h2>
                <p className="text-xs text-gray-400 mt-0.5">{formatDate(today)}</p>
              </div>
              {editing && <button onClick={() => setEditing(false)} className="text-xs text-gray-400 hover:underline">Cancelar</button>}
            </div>

            <div className="space-y-6">
              {SLIDERS.map(s => {
                const min = s.min ?? 1
                const max = s.max ?? 10
                const step = s.step ?? 1
                const val = form[s.key]
                return (
                  <div key={s.key}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-sm font-semibold text-gray-800">{s.label}</label>
                      <span className={`text-base font-bold px-2 py-0.5 rounded-lg ${s.isHours ? 'bg-blue-50 text-blue-700' : metricColor(val, s.invert)}`}>
                        {s.isHours ? `${val}h` : val}
                      </span>
                    </div>
                    <input
                      type="range" min={min} max={max} step={step} value={val}
                      onChange={e => setForm((f: any) => ({ ...f, [s.key]: step < 1 ? parseFloat(e.target.value) : parseInt(e.target.value) }))}
                      className="w-full accent-blue-600 h-2 cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>{s.low}</span><span>{s.high}</span>
                    </div>
                  </div>
                )
              })}

              <div>
                <label className="text-sm font-semibold text-gray-800 block mb-2">Notas (opcional)</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))}
                  placeholder="Como te sentis hoy..."
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <button onClick={saveLog} disabled={saving} className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 text-sm">
                {saving ? 'Guardando...' : 'Registrar wellness'}
              </button>
            </div>
          </div>
        )}

        {/* Historial */}
        {history.length > 1 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h3 className="font-bold text-gray-900 mb-4">Ultimos registros</h3>
            <div className="space-y-2">
              {history.slice(0, 7).map(log => {
                const s = calcScore(log)
                const l = scoreLabel(s)
                return (
                  <div key={log.id} className="flex items-center gap-3 py-1">
                    <p className="text-xs text-gray-500 w-20 flex-shrink-0">{formatDate(log.date)}</p>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div className={`h-2 rounded-full ${s >= 7.5 ? 'bg-green-400' : s >= 5 ? 'bg-yellow-400' : 'bg-red-400'}`} style={{ width: `${s * 10}%` }}></div>
                    </div>
                    <span className={`text-xs font-bold w-8 text-right ${l.color}`}>{s}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
