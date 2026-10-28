import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { VALID_LOADS_KG, prescriptionSummary, prescriptionNotes, type CycleWeek, type Prescription, type TrainingDay } from '../../data/program'
import { getStrengthPlanOverride, saveStrengthPlanOverride } from '../../domain/strengthPlanOverrides'
import { getEmomPlanOverride, saveEmomPlanOverride } from '../../domain/emomPlanOverrides'

type Draft = { sets: number; reps: number; load: number; duration: number; rpm: number }
type Props = { day: TrainingDay; cycleWeek: CycleWeek; onSaved: () => void }

function effectivePrescription(p: Prescription): Prescription {
  if (p.durationMinutes !== undefined) {
    const override = getEmomPlanOverride(p.exerciseId, p.variation)
    return override ? { ...p, durationMinutes: override.duration, repsPerMinute: override.repsPerMinute, addedLoadKg: override.load } : p
  }
  const override = getStrengthPlanOverride(p.exerciseId, p.variation)
  return override ? { ...p, sets: override.sets ?? p.sets, reps: override.targetReps, addedLoadKg: override.addedLoadKg } : p
}

export default function PlanEditor({ day, cycleWeek, onSaved }: Props) {
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const prescriptions = cycleWeek === 4 ? day.prescriptions.filter(p => !p.optional) : day.prescriptions
  const keyFor = (p: Prescription) => p.exerciseId + '::' + p.variation
  const beginEdit = (raw: Prescription) => {
    const p = effectivePrescription(raw)
    const key = keyFor(p)
    setDrafts(current => ({ ...current, [key]: {
      sets: p.sets ?? 1, reps: p.reps ?? 1, load: p.addedLoadKg,
      duration: p.durationMinutes ?? 10, rpm: p.repsPerMinute ?? 6,
    }}))
    setEditingKey(key)
  }
  const patch = (key: string, values: Partial<Draft>) => setDrafts(current => ({ ...current, [key]: { ...current[key], ...values } }))
  const save = (p: Prescription) => {
    const key = keyFor(p)
    const draft = drafts[key]
    if (!draft) return
    if (p.durationMinutes !== undefined) {
      saveEmomPlanOverride({ exerciseId: p.exerciseId, variation: p.variation, duration: Math.max(1, Math.min(60, Math.round(draft.duration))), repsPerMinute: Math.max(1, Math.min(100, Math.round(draft.rpm))), load: draft.load, savedAt: Date.now() })
    } else {
      saveStrengthPlanOverride({ exerciseId: p.exerciseId, variation: p.variation, targetReps: Math.max(1, Math.min(100, Math.round(draft.reps))), sets: Math.max(1, Math.min(20, Math.round(draft.sets))), addedLoadKg: draft.load, savedAt: Date.now() })
    }
    setEditingKey(null)
    onSaved()
  }
  return <div className="plan-day">
    <div className="plan-day-head"><strong>{day.label}</strong><span>{day.focus}</span></div>
    {prescriptions.length ? prescriptions.map((raw) => {
      const p = effectivePrescription(raw)
      const key = keyFor(p)
      const draft = drafts[key]
      const isEditing = editingKey === key
      return <div className="plan-line-wrap" key={key}>
        <div className="plan-line">
          <div className="plan-line-copy">
            <span>{p.title}{p.optional && <small className="optional-tag">OPZIONALE</small>}</span>
            <p className="plan-notes">{prescriptionNotes(p, cycleWeek)}</p>
          </div>
          <div className="plan-line-actions">
            <small>{prescriptionSummary(p, cycleWeek)}</small>
            <button type="button" className="secondary-button plan-edit-toggle" onClick={() => isEditing ? setEditingKey(null) : beginEdit(raw)}>{isEditing ? 'CHIUDI' : 'MODIFICA'}</button>
          </div>
        </div>
        {isEditing && draft && <div className="plan-edit-panel">
          {p.durationMinutes !== undefined ? <>
            <div className="form-grid"><label>Durata (min)<input type="number" min="1" max="60" value={draft.duration} onChange={e => patch(key, { duration: Number(e.target.value) || 1 })}/></label><label>Ripetizioni/min<input type="number" min="1" max="100" value={draft.rpm} onChange={e => patch(key, { rpm: Number(e.target.value) || 1 })}/></label></div>
            <label>Zavorra<select value={draft.load} onChange={e => patch(key, { load: Number(e.target.value) })}>{VALID_LOADS_KG.map(v => <option key={v} value={v}>{v} kg</option>)}</select></label>
          </> : <>
            <div className="form-grid"><label>Serie<input type="number" min="1" max="20" value={draft.sets} onChange={e => patch(key, { sets: Number(e.target.value) || 1 })}/></label><label>Ripetizioni/serie<input type="number" min="1" max="100" value={draft.reps} onChange={e => patch(key, { reps: Number(e.target.value) || 1 })}/></label></div>
            <label>Zavorra<select value={draft.load} onChange={e => patch(key, { load: Number(e.target.value) })}>{VALID_LOADS_KG.map(v => <option key={v} value={v}>{v} kg</option>)}</select></label>
          </>}
          <p className="plan-edit-note">I valori vengono salvati per questo esercizio e questa variante. Nella settimana di deload il volume viene ridotto automaticamente.</p>
          <div className="form-grid"><button type="button" className="secondary-button" onClick={() => setEditingKey(null)}><X size={14}/> ANNULLA</button><button type="button" className="primary-button compact" onClick={() => save(raw)}><Check size={14}/> SALVA SCHEDA</button></div>
        </div>}
      </div>
    }) : <small className="muted">Riposo</small>}
  </div>
}
