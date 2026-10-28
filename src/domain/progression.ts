import type { EmomLog, ProgressionSuggestion } from '../types'
import { VALID_LOADS_KG } from '../data/program'

export function suggestEmomProgression(log: EmomLog, previousCleanSessions = 0): ProgressionSuggestion {
  const completedMinutes = log.minutes.filter(m => m.completed && !m.skipped).length
  const allMinutesLogged = log.minutes.length === log.durationMinutes
  const allComplete = allMinutesLogged && completedMinutes === log.durationMinutes &&
    log.minutes.every(m => !m.skipped && m.actualReps >= m.targetReps)
  const pain = log.technique === 'pain'
  const clean = allComplete && log.technique === 'good' && (log.rir ?? 0) >= 2
  if (pain) return { action: 'maintain', title: 'Interrompi la progressione', reason: 'Hai segnalato dolore: non aumentare reps o carico. Valuta recupero e gestione del fastidio.' }
  if (!allComplete) {
    const incomplete = log.minutes.some(m => m.skipped || m.actualReps < m.targetReps) || completedMinutes < log.durationMinutes
    return incomplete
      ? { action: 'reduce-reps', title: 'Mantieni o riduci di 1 rep/min', reason: 'Non hai completato tutti i minuti: mantieni il carico e ripeti il livello oppure riduci di una ripetizione al minuto.', nextRepsPerMinute: Math.max(1, log.repsPerMinute - 1) }
      : { action: 'maintain', title: 'Raccogli una sessione completa', reason: 'Registra tutti i minuti prima di valutare una progressione.' }
  }
  if (!clean) return { action: 'maintain', title: 'Consolida il livello', reason: 'Sessione completata, ma RIR o tecnica non giustificano un aumento.' }
  const nextLoad = VALID_LOADS_KG.find(v => v === log.addedLoadKg + 5)
  if (previousCleanSessions >= 3 && nextLoad !== undefined) {
    return { action: 'consider-load', title: 'Valuta +5 kg e riparti più basso', reason: 'Hai consolidato almeno tre sessioni pulite consecutive. Se scegli di aumentare, riduci le reps/min e ricostruisci gradualmente.', nextLoadKg: nextLoad, nextRepsPerMinute: Math.max(1, Math.floor(log.repsPerMinute * 0.7)) }
  }
  return { action: 'increase-reps', title: 'Aumenta di 1 ripetizione al minuto', reason: 'Tutti i minuti completati, tecnica buona e almeno 2 RIR: aumenta le reps/min mantenendo durata e carico.', nextRepsPerMinute: log.repsPerMinute + 1 }
}
