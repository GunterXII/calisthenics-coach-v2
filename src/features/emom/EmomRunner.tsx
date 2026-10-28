import { useEffect, useMemo, useState } from 'react'
import { db } from '../../database/db'
import { EXERCISES } from '../../data/program'
import type { EmomLog, ExerciseId } from '../../types'

export default function EmomRunner({ onClose }: { onClose: () => void }) {
  const [exerciseId, setExerciseId] = useState<ExerciseId>('pull-up')
  const [variation, setVariation] = useState('Strict')
  const [duration, setDuration] = useState(10)
  const [repsPerMinute, setRepsPerMinute] = useState(6)
  const [load, setLoad] = useState(0)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [pausedAt, setPausedAt] = useState<number | null>(null)
  const [pauseMs, setPauseMs] = useState(0)
  const [now, setNow] = useState(Date.now())
  const [minutes, setMinutes] = useState<EmomLog['minutes']>([])
  const [actual, setActual] = useState(6)
  const [rir, setRir] = useState(2)
  const [technique, setTechnique] = useState<EmomLog['technique']>('good')
  const [notes, setNotes] = useState('')
  const running = startedAt !== null && pausedAt === null
  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [running])
  const elapsedMs = startedAt === null ? 0 : Math.max(0, (pausedAt ?? now) - startedAt - pauseMs)
  const elapsedSeconds = Math.floor(elapsedMs / 1000)
  const currentMinute = Math.min(duration, Math.floor(elapsedSeconds / 60) + 1)
  const remaining = Math.max(0, duration * 60 - elapsedSeconds)
  const progress = Math.min(100, elapsedSeconds / (duration * 60) * 100)
  const clock = useMemo(() => `${String(Math.floor(remaining / 60)).padStart(2,'0')}:${String(remaining % 60).padStart(2,'0')}`, [remaining])
  const begin = () => { const t = Date.now(); setStartedAt(t); setNow(t); setActual(repsPerMinute) }
  const pause = () => setPausedAt(Date.now())
  const resume = () => { if (pausedAt) setPauseMs(v => v + Date.now() - pausedAt); setPausedAt(null); setNow(Date.now()) }
  const recordMinute = (skipped = false) => {
    const minute = Math.min(duration, Math.max(1, currentMinute))
    setMinutes(prev => {
      const next = [...prev.filter(m => m.minute !== minute), { minute, targetReps: repsPerMinute, actualReps: skipped ? 0 : actual, skipped, completed: !skipped && actual >= repsPerMinute }].sort((a,b)=>a.minute-b.minute)
      return next
    })
    setActual(repsPerMinute)
  }
  const finish = async () => {
    if (startedAt === null) return
    const log: EmomLog = { id: crypto.randomUUID(), exerciseId, variation, durationMinutes: duration, repsPerMinute, addedLoadKg: load, minutes, startedAt, endedAt: Date.now(), pausedAt: null, accumulatedPauseMs: pauseMs, rir, technique, notes }
    await db.emoms.add(log)
    const workout = {
      id: crypto.randomUUID(),
      date: new Date(startedAt).toISOString().slice(0, 10),
      dayLabel: 'Sessione EMOM',
      kind: 'emom' as const,
      title: `${EXERCISES.find(e => e.id === exerciseId)?.name ?? 'EMOM'} · ${duration} min`,
      setLogs: [],
      emomLogs: [log],
      fatigue: null,
      sleepHours: null,
      pain: technique === 'pain' ? 'Dolore segnalato durante EMOM' : '',
      notes,
      completedAt: Date.now(),
    }
    await db.workouts.add(workout)
    onClose()
  }
  const complete = elapsedSeconds >= duration * 60
  return <div className="modal-backdrop"><div className="modal emom-modal">
    <div className="modal-head"><div><div className="eyebrow">SESSIONE STRUTTURATA</div><h2>EMOM runner</h2></div><button className="close-button" onClick={onClose}>×</button></div>
    {startedAt === null ? <>
      <label>Esercizio<select value={exerciseId} onChange={e=>setExerciseId(e.target.value as ExerciseId)}>{EXERCISES.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      <label>Variante<input value={variation} onChange={e=>setVariation(e.target.value)}/></label>
      <div className="form-grid"><label>Durata (min)<input type="number" min="1" max="60" value={duration} onChange={e=>setDuration(Math.max(1,Number(e.target.value)))}/></label><label>Reps / min<input type="number" min="1" value={repsPerMinute} onChange={e=>setRepsPerMinute(Math.max(1,Number(e.target.value)))}/></label></div>
      <label>Zavorra<select value={load} onChange={e=>setLoad(Number(e.target.value))}>{[0,5,10,15,20,25,30].map(v=><option key={v} value={v}>{v} kg</option>)}</select></label>
      <button className="primary-button full" onClick={begin}>INIZIA EMOM</button>
    </> : <>
      <div className="emom-clock"><small>MINUTO {Math.min(currentMinute,duration)} / {duration}</small><strong>{clock}</strong><div className="progress-track"><span style={{width:`${progress}%`}}/></div><p>{repsPerMinute} ripetizioni · {load} kg</p></div>
      <div className="minute-log"><div className="minute-log-head"><strong>Minuti registrati</strong><span>{minutes.length}/{duration}</span></div><div className="minute-dots">{Array.from({length:duration},(_,i)=>{const m=minutes.find(x=>x.minute===i+1);return <span key={i} className={m?(m.completed?'done':'missed'):''}>{i+1}</span>})}</div></div>
      {!complete && <><label>Ripetizioni effettive nel minuto<input type="number" min="0" value={actual} onChange={e=>setActual(Math.max(0,Number(e.target.value)))}/></label><div className="form-grid"><button className="secondary-button" onClick={()=>recordMinute()}>REGISTRA MINUTO</button><button className="secondary-button" onClick={()=>recordMinute(true)}>SALTA MINUTO</button></div></>}
      <div className="form-grid"><button className="secondary-button" onClick={running?pause:resume}>{running?'PAUSA':'RIPRENDI'}</button><button className="primary-button compact" onClick={()=>void finish()}>SALVA SESSIONE</button></div>
      {complete && <p className="muted">Durata completata. Registra il riepilogo e salva la sessione.</p>}
      <div className="form-grid"><label>RIR finale<input type="number" min="0" max="10" value={rir} onChange={e=>setRir(Number(e.target.value))}/></label><label>Tecnica<select value={technique} onChange={e=>setTechnique(e.target.value as EmomLog['technique'])}><option value="good">Buona</option><option value="degraded">Degradata</option><option value="pain">Dolore</option></select></label></div>
      <label>Note<input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Sensazioni, recupero..."/></label>
    </>}
  </div></div>
}
