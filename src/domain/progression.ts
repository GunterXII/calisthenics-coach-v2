import type { EmomLog, ProgressionSuggestion } from '../types'
import { VALID_LOADS_KG } from '../data/program'

export function suggestEmomProgression(log: EmomLog, previousCleanSessions = 0): ProgressionSuggestion {
  const completedMinutes = log.minutes.filter(m => m.completed && !m.skipped).length
  const allComplete = log.minutes.length === log.durationMinutes && completedMinutes === log.durationMinutes &&
    log.minutes.every(m => m.actualReps >= m.targetReps)
  const skipped = log.minutes.some(m => m.skipped)
  if (log.technique === 'pain') return { action: 'maintain', title: 'Interrompi la progressione', reason: 'Hai segnalato dolore: valuta recupero e gestione del carico.' }
  if (allComplete && log.technique === 'good' && (log.rir ?? 0) >= 2) {
    return { action: 'increase-reps', title: 'Aumenta di 1 ripetizione al minuto', reason: 'Hai completato tutti i minuti con tecnica buona e almeno 2 RIR.', nextRepsPerMinute: log.repsPerMinute + 1 }
  }
  if (allComplete) return { action: 'maintain', title: 'Consolida il livello', reason: 'Sessione completata, ma RIR o tecnica non giustificano un aumento.' }
  if (skipped || completedMinutes < log.durationMinutes || log.minutes.some(m => m.actualReps < m.targetReps)) {
    return { action: 'reduce-reps', title: 'Mantieni o riduci di 1 rep/min', reason: 'Sessione parziale: non aumentare il carico.', nextRepsPerMinute: Math.max(1, log.repsPerMinute - 1) }
  }
  if (previousCleanSessions >= 3) {
    const next = VALID_LOADS_KG.find(v => v === log.addedLoadKg + 5)
    if (next !== undefined) return { action: 'consider-load', title: 'Valuta il prossimo carico', reason: 'Hai consolidato più sessioni pulite. Riduci le reps/min e ricostruisci.', nextLoadKg: next }
  }
  return { action: 'maintain', title: 'Mantieni', reason: 'Raccogli altre sessioni di qualità prima di progredire.' }
}
