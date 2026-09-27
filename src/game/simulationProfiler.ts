/**
 * Vorübergehende Ersatzfassung: Marvins Commits verweisen auf dieses Modul,
 * haben es aber nicht mitgeschickt. Verhalten nach tests/simulationModules.ts; sobald
 * seine Datei kommt, gilt seine.
 *
 * Diagnose-Messung der Tick-Phasen für das Leistungs-HUD. Nur Anzeige, nie eine
 * Entscheidung der Simulation: die Uhr ist ein Profiling-Takt, kein Budget.
 */
export type SimulationPhaseTimings = {
  exclusive: Record<string, number>
  inclusive: Record<string, number>
}

type Frame = { id: string; start: number; nested: number }

export class SimulationProfiler {
  enabled = false
  private exclusive: Record<string, number> = {}
  private inclusive: Record<string, number> = {}
  private readonly stack: Frame[] = []
  private readonly clock: () => number

  constructor(clock: () => number = () => performance.now()) {
    this.clock = clock
  }

  /** Zeit ohne verschachtelte Phasen (die zählen bei sich selbst). */
  measure<T>(id: string, work: () => T): T {
    if (!this.enabled) return work()
    const frame: Frame = { id, start: this.clock(), nested: 0 }
    this.stack.push(frame)
    try {
      return work()
    } finally {
      this.stack.pop()
      const spent = this.clock() - frame.start
      this.exclusive[id] = (this.exclusive[id] ?? 0) + spent - frame.nested
      const parent = this.stack[this.stack.length - 1]
      if (parent) parent.nested += spent
    }
  }

  /** Zeit einschließlich allem darin, ohne die umgebende Phase zu kürzen. */
  measureInclusive<T>(id: string, work: () => T): T {
    if (!this.enabled) return work()
    const start = this.clock()
    try {
      return work()
    } finally {
      this.inclusive[id] = (this.inclusive[id] ?? 0) + this.clock() - start
    }
  }

  /** Gesammelte Zeiten seit dem letzten Abruf; null, solange die Messung aus ist. */
  consume(): SimulationPhaseTimings | null {
    if (!this.enabled) {
      this.exclusive = {}
      this.inclusive = {}
      return null
    }
    const sample = { exclusive: this.exclusive, inclusive: this.inclusive }
    this.exclusive = {}
    this.inclusive = {}
    return sample
  }
}
