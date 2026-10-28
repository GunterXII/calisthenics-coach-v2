import { useEffect, useState } from 'react'
import { Plus, Minus, Trash2, X, Timer, RotateCcw } from 'lucide-react'
import { EXERCISES, VALID_LOADS_KG } from '../../data/program'
import type { ExerciseId, SetLog, WorkoutLog } from '../../types'
import { suggestStrengthProgression } from '../../domain/strengthProgression'

type Props = { workouts: WorkoutLog[]; dayLabel: string; onClose: () => void; onSave: (w: WorkoutLog) => Promise<void> }

function previous(workouts: WorkoutLog[], id: ExerciseId) {
  for (const w of workouts) {
    const s = [...w.setLogs].reverse().find(x => x.exerciseId === id)
    if (s) return s
  }
}

function makeSet(id: ExerciseId, prev?: SetLog): SetLog {
  return { id: crypto.randomUUID(), exerciseId: id, variation: prev?.variation ?? 'Strict', addedLoadKg: prev?.addedLoadKg ?? 0, targetReps: prev?.targetReps ?? 6, actualReps: prev?.targetReps ?? 6, rir: prev?.rir ?? 2, completed: true, technique: 'good', notes: '', createdAt: Date.now() }
}

function formatRest(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds))
  return String(Math.floor(safe / 60)).padStart(2, '0') + ':' + String(safe % 60).padStart(2, '0')
}

export default function WorkoutLogger({ workouts, dayLabel, onClose, onSave }: Props) {
  const [title, setTitle] = useState(dayLabel === 'Sessione libera' ? 'Allenamento' : dayLabel)
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [sets, setSets] = useState<SetLog[]>(() => [makeSet('pull-up', previous(workouts, 'pull-up'))])
  const [selected, setSelected] = useState<ExerciseId>('pull-up')
  const [fatigue, setFatigue] = useState<number | null>(null)
  const [sleepHours, setSleepHours] = useState<number | null>(null)
  const [pain, setPain] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [restDuration, setRestDuration] = useState(180)
  const [restEndAt, setRestEndAt] = useState<number | null>(null)
  const [restPausedRemaining, setRestPausedRemaining] = useState<number | null>(null)
  const [restNow, setRestNow] = useState(Date.now())
  const restRunning = restEndAt !== null
  const restRemaining = restEndAt !== null
    ? Math.max(0, Math.ceil((restEndAt - restNow) / 1000))
    : restPausedRemaining ?? restDuration

  useEffect(() => {
    if (restEndAt === null) return
    const tick = () => {
      const timestamp = Date.now()
      setRestNow(timestamp)
      if (timestamp >= restEndAt) {
        setRestEndAt(null)
        setRestPausedRemaining(0)
      }
    }
    const id = window.setInterval(tick, 250)
    return () => window.clearInterval(id)
  }, [restEndAt])

  const startRest = () => {
    const now = Date.now()
    const remaining = restPausedRemaining ?? restDuration
    const seconds = remaining > 0 ? remaining : restDuration
    setRestNow(now)
    setRestPausedRemaining(null)
    setRestEndAt(now + seconds * 1000)
  }
  const pauseRest = () => {
    if (restEndAt === null) return
    setRestPausedRemaining(Math.max(0, Math.ceil((restEndAt - Date.now()) / 1000)))
    setRestEndAt(null)
    setRestNow(Date.now())
  }
  const resetRest = () => {
    setRestEndAt(null)
    setRestPausedRemaining(null)
    setRestNow(Date.now())
  }

  const patch = (id: string, p: Partial<SetLog>) => setSets(xs => xs.map(s => s.id === id ? { ...s, ...p } : s))
  const submit = async () => {
    if (!sets.length || saving) return
    setSaving(true)
    try {
      const now = Date.now()
      await onSave({ id: crypto.randomUUID(), date, dayLabel, kind: 'strength', title, setLogs: sets, emomLogs: [], fatigue, sleepHours, pain, notes, completedAt: now })
      resetRest()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return <div className="modal-backdrop" onClick={onClose}><div className="modal logger-modal" onClick={e => e.stopPropagation()}>
    <div className="modal-head"><div><div className="eyebrow">NUOVA SESSIONE</div><h2>Registra allenamento</h2></div><button className="close-button" onClick={onClose} aria-label="Chiudi"><X size={18} /></button></div>
    <label>Titolo<input value={title} onChange={e => setTitle(e.target.value)} /></label><label>Data<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>

    <section className="rest-timer-panel" aria-label="Timer di recupero tra le serie">
      <div className="rest-panel-head">
        <div><small>RECUPERO TRA LE SERIE</small><strong>{formatRest(restRemaining)}</strong></div>
        <span className={restRunning ? 'rest-status active' : restRemaining === 0 ? 'rest-status done' : 'rest-status'}>{restRunning ? 'IN CORSO' : restPausedRemaining !== null && restPausedRemaining > 0 ? 'IN PAUSA' : restRemaining === 0 ? 'COMPLETATO' : 'PRONTO'}</span>
      </div>
      <div className="rest-presets">{[60, 90, 120, 180].map(seconds => <button type="button" key={seconds} className={restDuration === seconds ? 'selected' : ''} disabled={restRunning} onClick={() => { setRestDuration(seconds); setRestPausedRemaining(null) }}>{seconds / 60}:00</button>)}</div>
      <div className="form-grid">
        <button type="button" className="secondary-button" onClick={restRunning ? pauseRest : startRest}><Timer size={14} /> {restRunning ? 'PAUSA' : restPausedRemaining !== null && restPausedRemaining > 0 ? 'RIPRENDI' : 'AVVIA RECUPERO'}</button>
        <button type="button" className="secondary-button" onClick={resetRest}><RotateCcw size={14} /> RESET</button>
      </div>
      <p>Il countdown continua mentre registri la serie successiva. Scegli 1, 1:30, 2 o 3 minuti; pausa e ripresa non azzerano il tempo.</p>
    </section>

    <div className="logger-section-head"><strong>SERIE E PRESTAZIONI</strong><span>{sets.length} serie</span></div>
    {sets.map((s, i) => <article className="logger-set" key={s.id}><div className="logger-set-head"><strong>Serie {i + 1}</strong><button className="icon-button danger" onClick={() => setSets(xs => xs.filter(x => x.id !== s.id))} aria-label={'Rimuovi serie ' + (i + 1)}><Trash2 size={15} /></button></div>
      <label>Esercizio<select value={s.exerciseId} onChange={e => { const id = e.target.value as ExerciseId; const p = previous(workouts, id); patch(s.id, { exerciseId: id, variation: p?.variation ?? 'Strict', addedLoadKg: p?.addedLoadKg ?? 0, targetReps: p?.targetReps ?? 6, actualReps: p?.targetReps ?? 6 }) }}>{EXERCISES.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      <label>Variante<input value={s.variation} onChange={e => patch(s.id, { variation: e.target.value })} /></label>
      <div className="form-grid"><label>Target<input type="number" min="0" value={s.targetReps} onChange={e => patch(s.id, { targetReps: Math.max(0, Number(e.target.value)) })} /></label><label>Effettive<div className="stepper"><button type="button" onClick={() => patch(s.id, { actualReps: Math.max(0, s.actualReps - 1) })} aria-label="Meno una ripetizione"><Minus size={14} /></button><input type="number" min="0" value={s.actualReps} onChange={e => patch(s.id, { actualReps: Math.max(0, Number(e.target.value)) })} /><button type="button" onClick={() => patch(s.id, { actualReps: s.actualReps + 1 })} aria-label="Più una ripetizione"><Plus size={14} /></button></div></label></div>
      <div className="form-grid"><label>Zavorra<select value={s.addedLoadKg} onChange={e => patch(s.id, { addedLoadKg: Number(e.target.value) })}>{VALID_LOADS_KG.map(v => <option key={v} value={v}>{v} kg</option>)}</select></label><label>RIR<input type="number" min="0" max="10" value={s.rir ?? ''} onChange={e => patch(s.id, { rir: e.target.value === '' ? null : Number(e.target.value) })} /></label></div>
      <div className="form-grid"><label>Tecnica<select value={s.technique} onChange={e => patch(s.id, { technique: e.target.value as SetLog['technique'] })}><option value="good">Buona</option><option value="degraded">Degradata</option><option value="pain">Dolore</option></select></label><label className="check-label"><input type="checkbox" checked={s.completed} onChange={e => patch(s.id, { completed: e.target.checked })} /> Completata</label></div><label>Note serie<input value={s.notes} onChange={e => patch(s.id, { notes: e.target.value })} /></label>{suggestStrengthProgression(workouts, s.exerciseId, s.variation) && <div className="progression-hint"><strong>{suggestStrengthProgression(workouts, s.exerciseId, s.variation)?.title}</strong><span>{suggestStrengthProgression(workouts, s.exerciseId, s.variation)?.detail}</span></div>}</article>)}
    <div className="add-set-row"><select value={selected} onChange={e => setSelected(e.target.value as ExerciseId)}>{EXERCISES.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select><button className="secondary-button" onClick={() => setSets(xs => [...xs, makeSet(selected, previous(workouts, selected))])}><Plus size={15} /> AGGIUNGI SERIE</button></div>
    <div className="logger-section-head"><strong>RECUPERO E FEEDBACK</strong></div><div className="form-grid"><label>Fatica (1–10)<input type="number" min="1" max="10" value={fatigue ?? ''} onChange={e => setFatigue(e.target.value === '' ? null : Number(e.target.value))} /></label><label>Ore di sonno<input type="number" min="0" max="24" step=".5" value={sleepHours ?? ''} onChange={e => setSleepHours(e.target.value === '' ? null : Number(e.target.value))} /></label></div>
    <label>Dolore / fastidi<input value={pain} onChange={e => setPain(e.target.value)} /></label><label>Note sessione<textarea value={notes} onChange={e => setNotes(e.target.value)} /></label><button className="primary-button full" disabled={!sets.length || saving} onClick={() => void submit()}>{saving ? 'SALVATAGGIO...' : 'SALVA SESSIONE'}</button>
  </div></div>
}
