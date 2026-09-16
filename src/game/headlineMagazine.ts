import type { GameSnapshot } from './GameState'
import { BANDS } from './festivalManagement'
import { isWasteBin } from './decorationWalls'
import { isSealedWasteContainer } from './waste'
import { SIMULATION_CONFIG } from './simulationConfig'

export type MagazineVerdict = 'cult' | 'success' | 'mixed' | 'flop'

export type MagazineBlurb = {
  id: string
  headline: string
  body: string
}

export type HeadlineMagazine = {
  edition: number
  weekendKey: string
  masthead: string
  kicker: string
  issueLine: string
  dateLine: string
  score: number
  stars: number
  verdict: MagazineVerdict
  verdictLine: string
  lede: string
  pullQuote: string
  heroCaption: string
  coverStamp: string
  pros: MagazineBlurb[]
  cons: MagazineBlurb[]
}

type Candidate = MagazineBlurb & {
  side: 'pro' | 'con'
  strength: number
}

const MIN_ITEMS = 3
const MAX_ITEMS = 6
const BARE_SHOW = SIMULATION_CONFIG.bandSupply.bareShowQuality

export function festivalWeekendKey(s: Readonly<GameSnapshot>): string {
  return `${s.festival.edition}:${s.festival.startDay}:${s.festival.seed}`
}

/** Recap from existing snapshot fields. Null until the weekend is finished. */
export function buildHeadlineMagazine(s: Readonly<GameSnapshot>): HeadlineMagazine | null {
  if (!s.festival.finished) return null

  const f = s.festival
  const lead = s.dayPlan.leadDays
  const firstDay = f.startDay + lead
  const lastDay = firstDay + s.dayPlan.festivalDays - 1
  const reports = f.reports.filter((report) => report.day >= firstDay)
  const satisfaction = reports.length
    ? reports.reduce((sum, report) => sum + report.satisfaction, 0) / reports.length
    : f.metrics.samples
      ? f.metrics.satisfaction / f.metrics.samples
      : 50
  const balance = f.reports.reduce((sum, report) => sum + report.balance, 0)
  const concerts = reports.reduce((sum, report) => sum + report.concerts, 0)
  const stockouts = reports.reduce((sum, report) => sum + report.stockouts, 0)
  const weatherImpact = reports.reduce((sum, report) => sum + report.weatherImpact, 0)
  const reputation = (f.reputation.music + f.reputation.atmosphere + f.reputation.comfort + f.reputation.organization) / 4
  const guestGoal = f.admissions >= f.goals.guests
  const satGoal = satisfaction >= f.goals.satisfaction
  const profitGoal = balance >= f.goals.profit
  const goalsMet = guestGoal && satGoal && profitGoal
  const score = clamp(Math.round(
    satisfaction * 0.48 +
    reputation * 0.22 +
    Math.min(12, (f.admissions / Math.max(1, f.goals.guests)) * 12) +
    (satGoal ? 8 : satisfaction / Math.max(1, f.goals.satisfaction) * 8) +
    (profitGoal ? 8 : balance > 0 ? 4 : 0) +
    (goalsMet ? 4 : 0),
  ))
  const verdict: MagazineVerdict = score >= 82 && goalsMet
    ? 'cult'
    : score >= 68 || (goalsMet && score >= 58)
      ? 'success'
      : score >= 45
        ? 'mixed'
        : 'flop'
  const stars = Math.max(1, Math.min(5, Math.round(score / 20)))
  const stats = collectSiteStats(s, satisfaction, concerts, stockouts, weatherImpact, balance)
  const candidates = collectCandidates(s, stats)
  const pros = pickBlurbs(candidates, 'pro')
  const cons = pickBlurbs(candidates, 'con')
  const pull = strongestQuote(pros, cons, verdict)
  const headliner = stats.headlinerName

  return {
    edition: f.edition,
    weekendKey: festivalWeekendKey(s),
    masthead: 'HEADLINE',
    kicker: 'Headliner Magazin',
    issueLine: `Nr. ${String(Math.max(1, f.edition)).padStart(2, '0')} · Das Wochenende im Urteil`,
    dateLine: `Festivalsonntag · Tag ${firstDay}–${lastDay}`,
    score,
    stars,
    verdict,
    verdictLine: VERDICT_LINE[verdict],
    lede: verdictLede(verdict, f.admissions, satisfaction, balance, headliner),
    pullQuote: pull,
    heroCaption: headliner
      ? `${headliner} auf der Titelseite – und das Gelände drumherum.`
      : 'Das Gelände nach der letzten Zugabe, bevor der Staub sich legt.',
    coverStamp: COVER_STAMP[verdict],
    pros,
    cons,
  }
}

type SiteStats = {
  satisfaction: number
  concerts: number
  stockouts: number
  weatherImpact: number
  balance: number
  motivation: number
  happiness: number
  dumpRatio: number
  litter: number
  vomit: number
  fire: number
  panic: number
  injured: number
  medicalOccupied: number
  attractiveness: number
  party: number
  showQuality: number
  headlinerName: string | null
  bookingCount: number
  unpoweredStages: number
  backstageTiles: number
  medics: number
  security: number
  dirtyComplaints: number
  crowdComplaints: number
}

function collectSiteStats(
  s: Readonly<GameSnapshot>,
  satisfaction: number,
  concerts: number,
  stockouts: number,
  weatherImpact: number,
  balance: number,
): SiteStats {
  const visitors = s.visitors
  const motivation = visitors.length
    ? visitors.reduce((sum, visitor) => sum + visitor.motivation, 0) / visitors.length
    : satisfaction
  const happiness = visitors.length
    ? visitors.reduce((sum, visitor) => {
      const needs = visitor.needs
      return sum + (needs.fun + needs.energy + needs.hunger + needs.toilet) / 4
    }, 0) / visitors.length
    : satisfaction
  const dumpStored = s.wasteDumpCells.reduce((sum, cell) => sum + cell.stored, 0)
  const dumpCap = s.wasteDumpCells.length * SIMULATION_CONFIG.waste.dumpCapacity
  const sealedStored = s.buildings
    .filter((building) => isSealedWasteContainer(building.kind))
    .reduce((sum, building) => sum + (building.wasteFill ?? 0), 0)
  const sealedCap = s.buildings.filter((building) => isSealedWasteContainer(building.kind)).length
    * SIMULATION_CONFIG.waste.sealedContainerCapacity
  const binPressure = s.buildings.filter((building) => isWasteBin(building.kind) && (building.wasteFill ?? 0) >= SIMULATION_CONFIG.waste.binCapacity).length
  const dumpRatio = dumpCap + sealedCap > 0
    ? (dumpStored + sealedStored) / (dumpCap + sealedCap)
    : binPressure > 0 ? 0.55 : 0
  const booked = s.festival.bookings
    .map((booking) => BANDS.find((band) => band.id === booking.bandId))
    .filter((band): band is (typeof BANDS)[number] => Boolean(band))
  const headliner = booked
    .filter((band) => band.genre.includes('Headliner') || band.draw >= 80)
    .sort((left, right) => right.draw - left.draw || left.id.localeCompare(right.id))[0]
  const stageIds = new Set(s.festival.bookings.map((booking) => booking.stageId))
  const qualities = [...stageIds].map((id) => s.bandSupply.showQualityByStageId[id] ?? BARE_SHOW)
  const showQuality = qualities.length
    ? qualities.reduce((sum, value) => sum + value, 0) / qualities.length
    : BARE_SHOW
  const stages = s.buildings.filter((building) => building.kind === 'stage')
  const complaints = s.complaints.currentSession

  return {
    satisfaction,
    concerts,
    stockouts,
    weatherImpact,
    balance,
    motivation,
    happiness,
    dumpRatio,
    litter: s.incidents.filter((incident) => incident.kind === 'litter').length,
    vomit: s.incidents.filter((incident) => incident.kind === 'vomit').length,
    fire: s.incidents.filter((incident) => incident.kind === 'fire').length,
    panic: visitors.filter((visitor) => visitor.isPanicking || visitor.state === 'panicking').length,
    injured: visitors.filter((visitor) => visitor.state === 'injured').length,
    medicalOccupied: s.medicalCells.reduce(
      (sum, cell) => sum + cell.occupants.filter(Boolean).length,
      0,
    ),
    attractiveness: s.attractiveness.average,
    party: s.partyMood.average,
    showQuality,
    headlinerName: headliner?.name ?? null,
    bookingCount: s.festival.bookings.length,
    unpoweredStages: stages.filter((stage) => !s.power.poweredBuildingIds.includes(stage.id)).length,
    backstageTiles: s.backstageCells.length,
    medics: s.staff.filter((member) => member.role === 'medic').length,
    security: s.staff.filter((member) => member.role === 'security').length,
    dirtyComplaints: complaints['dirty-grounds'] ?? 0,
    crowdComplaints: complaints.overcrowding ?? 0,
  }
}

function collectCandidates(s: Readonly<GameSnapshot>, stats: SiteStats): Candidate[] {
  const f = s.festival
  const items: Candidate[] = []
  const add = (candidate: Candidate) => items.push(candidate)

  if (stats.satisfaction >= 85) {
    add(blurb('pro', 'happy-guests', 96, 'Strahlende Gesichter bis zum Abspann',
      'Die Gäste gehen mit vollen Herzen. HEADLINE hat selten so viele zufriedene Stimmen aus einem Feld gehört.'))
  } else if (stats.satisfaction >= 72) {
    add(blurb('pro', 'happy-enough', 78, 'Gute Laune, ehrlich verdient',
      'Kein Hochglanzmärchen, aber ein Wochenende, das sich warm anfühlt. Die Leute würden wiederkommen.'))
  } else if (stats.satisfaction < 50) {
    add(blurb('con', 'unhappy', 92, 'Die Stimmung kippte früh',
      'Zu viele müde Augen, zu wenig Festivallust. Das Publikum hat das Wochenende nicht verziehen.'))
  } else if (stats.satisfaction < f.goals.satisfaction) {
    add(blurb('con', 'sat-miss', 74, 'Zufriedenheit unter der Zielmarke',
      'Die Gäste blieben höflich, nicht begeistert. Ein paar fehlende Prozent trennen hier Alltag von Jubel.'))
  }

  if (stats.motivation >= 78) {
    add(blurb('pro', 'motivation', 80, 'Die Festivallust hielt bis Sonntag',
      'Selbst nach der letzten Zugabe wollten sie noch tanzen. Das ist die Währung, die kein Ticketpreis ersetzt.'))
  } else if (stats.motivation < 42 && s.visitors.length) {
    add(blurb('con', 'low-motivation', 76, 'Die Lust war früher zu Ende als das Programm',
      'Gedränge, leere Bedürfnisse, dunkle Bühnen – die Festivallust sickerte weg, bevor der letzte Slot begann.'))
  }

  if (stats.headlinerName) {
    add(blurb('pro', 'headliner', 94, `${stats.headlinerName} als Titelgeschichte`,
      'Der große Name hat geliefert. Vorplatz voll, Stimmen rau, genau die Ausgabe, die man sich rahmt.'))
  } else if (stats.bookingCount >= 6) {
    add(blurb('pro', 'lineup-depth', 70, 'Ein Spielplan mit Atem',
      'Keine einzelne Sensation, dafür ein durchgehendes Band. Das Feld hatte immer irgendwo Musik.'))
  } else if (stats.bookingCount === 0) {
    add(blurb('con', 'no-lineup', 95, 'Leere Slots, leere Gesichter',
      'Ohne verbindliches Programm bleibt ein Festival ein Picknick mit Eintritt. HEADLINE war unerbittlich.'))
  } else if (stats.bookingCount < 3) {
    add(blurb('con', 'thin-lineup', 68, 'Zu dünn für ein Wochenende',
      'Ein, zwei Sets tragen keinen ganzen Samstag. Zwischen den Auftritten wurde das Feld still.'))
  }

  if (stats.concerts >= 800) {
    add(blurb('pro', 'concerts', 86, 'Stundenlang vor der Bühne',
      'Konzertminuten ohne Ende. Wer wollte, fand seinen Slot – und blieb.'))
  } else if (stats.concerts < 80 && stats.bookingCount > 0) {
    add(blurb('con', 'empty-pit', 72, 'Die Vorplätze blieben höflich leer',
      'Gebucht war etwas. Gesehen wurde wenig. Strom, Vorplatz oder Timing haben die Sets ausgebremst.'))
  }

  if (stats.showQuality >= 1) {
    add(blurb('pro', 'backstage', 84, 'Backstage wie im Hochglanzheft',
      'Catering, Ruhe, Ankunft: Die Bands klangen, als hätte jemand an sie gedacht. Das hört man.'))
  } else if (stats.backstageTiles === 0 && stats.bookingCount > 0) {
    add(blurb('con', 'bare-stage', 80, 'Bare Stage, nackte Nerven',
      'Ohne Backstage tragen sich die Acts selbst. Die Shows liefen, aber sie glänzten nicht.'))
  } else if (stats.showQuality <= BARE_SHOW + 0.04 && stats.bookingCount > 0) {
    add(blurb('con', 'weak-supply', 73, 'Die Bandversorgung blieb Stückwerk',
      'Ein Vorplatz allein macht noch keine Ausgabe. Catering und Tourbus hätten den Unterschied gemacht.'))
  }

  if (f.admissions >= f.goals.guests * 1.15) {
    add(blurb('pro', 'crowds', 88, 'Das Feld war voll – im besten Sinn',
      `${f.admissions} Anreisen, Ziel klar übertroffen. Ticketrollen leer, Wege voll, Kasse warm.`))
  } else if (f.admissions >= f.goals.guests) {
    add(blurb('pro', 'guests-met', 64, 'Die Anreisen haben die Marke gehalten',
      'Kein Ansturm der Superlative, aber die Tore drehten sich oft genug. Das Wochenende hatte Publikum.'))
  } else if (f.admissions < Math.max(40, f.goals.guests * 0.4)) {
    add(blurb('con', 'empty-park', 90, 'Leere Wege, teure Stille',
      'Zu wenig Gäste für so viel Gelände. HEADLINE fragt sich, für wen die Bühnen eigentlich leuchteten.'))
  } else {
    add(blurb('con', 'guest-miss', 66, 'Unter dem Anreiseziel',
      'Die Kontingente hätten mehr vertragen. Ein Wochenende ohne Masse bleibt eine Generalprobe.'))
  }

  if (stats.balance >= Math.max(400, f.goals.profit + 200)) {
    add(blurb('pro', 'profit', 82, 'Die Kasse schreibt mit',
      'Einnahmen vor Gagen und Bratwurst. Diese Ausgabe trägt sich – und die nächste gleich mit.'))
  } else if (stats.balance >= f.goals.profit) {
    add(blurb('pro', 'broke-even', 58, 'Schwarze Zahlen, ruhige Nächte',
      'Kein Vermögen, aber auch kein Loch. Die Bilanz lässt die nächste Buchung zu.'))
  } else if (stats.balance < 0) {
    add(blurb('con', 'loss', 88, 'Das Wochenende hat Geld gekostet',
      'Gagen, Ware, Personal – und zu wenig Gegenverkehr an der Kasse. Die Ausgabe bleibt ein teurer Satz.'))
  }

  if (stats.dumpRatio < 0.25 && stats.litter + stats.vomit < 8 && stats.dirtyComplaints < 3) {
    add(blurb('pro', 'clean', 83, 'Sauberes Feld nach der letzten Nacht',
      'Kaum Säcke, kaum Scherben. Wer morgens über das Gelände geht, findet Festival – nicht Müllhalde.'))
  } else if (stats.dumpRatio >= SIMULATION_CONFIG.waste.dumpFullRatio || stats.litter + stats.vomit >= 18 || stats.dirtyComplaints >= 8) {
    add(blurb('con', 'trash', 93, 'Müllberge statt Afterglow',
      'Ablagen voll, Wege klebrig, Beschwerden über Dreck. Das Bild bleibt, wenn die Musik längst weg ist.'))
  } else if (stats.dumpRatio >= 0.55 || stats.litter + stats.vomit >= 8) {
    add(blurb('con', 'messy', 70, 'Das Gelände braucht eine zweite Schicht',
      'Nicht die Katastrophe, aber auch kein Postkartenmotiv. Eimer und Ablagen kamen nicht hinterher.'))
  }

  if (f.reputation.atmosphere >= 72 || stats.party >= 55 || stats.attractiveness >= 45) {
    add(blurb('pro', 'atmosphere', 76, 'Licht, Lärm, genau die richtige Nacht',
      'Partystimmung und Attraktivität haben das Feld zusammengehalten. Man hat es gehört, bevor man es sah.'))
  }
  if (f.reputation.atmosphere < 40 && stats.party < 20) {
    add(blurb('con', 'flat-air', 71, 'Die Luft blieb flach',
      'Zu wenig Licht, zu wenig Lärm an den richtigen Stellen. Atmosphäre ist kein Zufall – hier fehlte sie.'))
  }

  if (stats.unpoweredStages === 0 && s.buildings.some((building) => building.kind === 'stage')) {
    add(blurb('pro', 'power', 62, 'Die Bühnen blieben wach',
      'Strom bis zum letzten Slot. Kein dunkles Gerüst, keine abgebrochene Zugabe aus der Steckdose.'))
  } else if (stats.unpoweredStages > 0 && stats.bookingCount > 0) {
    add(blurb('con', 'no-power', 86, 'Dunkle Bühnen, laute Fragen',
      'Ohne Netz kein Set. Mindestens eine Bühne stand ohne Strom – und das Programm gleich mit.'))
  }

  if (stats.panic >= 3 || stats.crowdComplaints >= 6) {
    add(blurb('con', 'panic', 97, 'Panik statt Refrains',
      'Zu eng, zu unsicher, zu spät reagiert. Ein Festival, das Angst macht, verliert jede Zugabe.'))
  } else if (stats.security >= 2 && stats.panic === 0 && f.admissions >= 40) {
    add(blurb('pro', 'security', 60, 'Security, die man nicht sieht',
      'Keine Massenpanik, keine Schlagzeile von der falschen Sorte. Die Absperrung hat ihre Arbeit getan.'))
  } else if (stats.security === 0 && f.admissions >= f.goals.guests) {
    add(blurb('con', 'no-security', 63, 'Volle Tore, leere Westen',
      'Viel Publikum, keine sichtbare Security. Das geht gut – bis es nicht mehr geht.'))
  }

  if (stats.injured + stats.medicalOccupied >= 3) {
    add(blurb('con', 'medical', 89, 'Die Sanizelte liefen über',
      'Verletzte, belegte Betten, Schlangen vor der Hilfe. Das Wochenende hatte eine medizinische Fußnote zu viel.'))
  } else if (stats.medics >= 1 && stats.injured === 0 && stats.medicalOccupied === 0 && f.admissions >= 40) {
    add(blurb('pro', 'medics', 57, 'Sanität im Leerlauf – perfekt so',
      'Personal war da, der Ernstfall nicht. Genau so soll ein Festivalsonntag aussehen.'))
  } else if (stats.medics === 0 && (stats.injured > 0 || f.admissions >= f.goals.guests)) {
    add(blurb('con', 'no-medics', 69, 'Hilfe erst nach der Frage',
      'Ohne Sanitäter bleibt jeder Sturz eine Geschichte. HEADLINE hätte gern eine weiße Weste gesehen.'))
  }

  if (stats.fire >= 1) {
    add(blurb('con', 'fire', 91, 'Feuer auf dem Feld',
      'Kein Effekt, ein Vorfall. Pyro gehört auf die Bühne, nicht in den Boden.'))
  }

  if (stats.stockouts >= 12) {
    add(blurb('con', 'stockout', 85, 'Theken leer, Gesichter leer',
      'Ausverkaufte Stände, gescheiterte Käufe. Wer Hunger hat, bewertet keine Lichtshow.'))
  } else if (stats.stockouts <= 2 && f.admissions >= 50) {
    add(blurb('pro', 'stocked', 61, 'Die Stände haben durchgehalten',
      'Essen, Getränke, Souvenirs: Nachschub kam, bevor die Schlangen kippten.'))
  }

  if (stats.weatherImpact > 140 && !f.upgrades.shelter) {
    add(blurb('con', 'weather', 77, 'Das Wetter hat das Feld geschrieben',
      'Regen oder Hitze ohne Schutz. Nasse Wege, müde Beine – die Vorsorge kam zu spät.'))
  } else if (stats.weatherImpact > 80 && (f.upgrades.shelter || f.upgrades.water || f.upgrades.drainage)) {
    add(blurb('pro', 'weather-ready', 59, 'Trotz Wetter: das Feld blieb stehen',
      'Die Vorsorge hat gehalten. Matsch und Hitze waren da, die Gäste auch.'))
  }

  if (f.reputation.music >= 70) {
    add(blurb('pro', 'music-rep', 67, 'Der Musikruf wächst hörbar',
      'Größere Namen werden möglich. Diese Ausgabe hat die Tür einen Spalt weiter aufgemacht.'))
  } else if (f.reputation.organization < 38) {
    add(blurb('con', 'chaos', 75, 'Organisation als Gerücht',
      'Ausverkäufe, Wartezeiten, unklare Wege. Der Ruf für Organisation ist der, den man zuletzt verliert – und hier wackelt er.'))
  }

  if (f.reputation.comfort >= 70) {
    add(blurb('pro', 'comfort', 56, 'Komfort, der nicht nachgibt',
      'Familien und Ruhesuchende blieben. Schatten, Wege, ein Platz zum Atmen – das zählt in der Ausgabe danach.'))
  }

  return items
}

function pickBlurbs(candidates: Candidate[], side: 'pro' | 'con'): MagazineBlurb[] {
  const sorted = candidates
    .filter((item) => item.side === side)
    .sort((left, right) => right.strength - left.strength || left.id.localeCompare(right.id))
  const picked = sorted.slice(0, MAX_ITEMS)
  if (side === 'con') {
    for (const filler of CON_FILLERS) {
      if (picked.length >= MIN_ITEMS) break
      if (picked.some((item) => item.id === filler.id)) continue
      picked.push(filler)
    }
  } else {
    for (const filler of PRO_FILLERS) {
      if (picked.length >= MIN_ITEMS) break
      if (picked.some((item) => item.id === filler.id)) continue
      picked.push(filler)
    }
  }
  return picked.slice(0, MAX_ITEMS).map(({ id, headline, body }) => ({ id, headline, body }))
}

function strongestQuote(pros: MagazineBlurb[], cons: MagazineBlurb[], verdict: MagazineVerdict): string {
  if (verdict === 'flop' && cons[0]) return `»${cons[0].headline}«`
  if (pros[0]) return `»${pros[0].headline}«`
  if (cons[0]) return `»${cons[0].headline}«`
  return '»Ein Wochenende, das nach der letzten Zugabe weiterredet.«'
}

function verdictLede(
  verdict: MagazineVerdict,
  admissions: number,
  satisfaction: number,
  balance: number,
  headliner: string | null,
): string {
  const guests = `${admissions} Anreisen`
  const mood = `${Math.round(satisfaction)} Prozent Zufriedenheit`
  const cash = `${Math.round(balance).toLocaleString('de-DE')} € Bilanz`
  const act = headliner ? ` ${headliner} standen für den großen Satz.` : ''
  if (verdict === 'cult') {
    return `Kultstatus nach einem einzigen Wochenende: ${guests}, ${mood}, ${cash}.${act} So schreibt man eine Ausgabe, die man weiterreicht.`
  }
  if (verdict === 'success') {
    return `Ein Wochenende mit Haltung: ${guests}, ${mood}, ${cash}.${act} Nicht makellos – aber klar mehr als die Summe seiner Slots.`
  }
  if (verdict === 'mixed') {
    return `Zwischentöne statt Hymne: ${guests}, ${mood}, ${cash}.${act} Größe und Kratzer liegen in derselben Kolumne.`
  }
  return `Die Kritik bleibt hart: ${guests}, ${mood}, ${cash}.${act} Nächstes Jahr muss das Feld neu gedacht werden.`
}

function blurb(side: 'pro' | 'con', id: string, strength: number, headline: string, body: string): Candidate {
  return { side, id, strength, headline, body }
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n))
}

const VERDICT_LINE: Record<MagazineVerdict, string> = {
  cult: 'Kultstatus. Diese Ausgabe schreiben die Leute weiter.',
  success: 'Ein Wochenende, das sich sehen lassen kann.',
  mixed: 'Zwischentöne: großes Herz, raue Kanten.',
  flop: 'Die Kritik bleibt hart. Nächstes Jahr neu denken.',
}

const COVER_STAMP: Record<MagazineVerdict, string> = {
  cult: 'KULT',
  success: 'HIT',
  mixed: 'MIX',
  flop: 'FLOP',
}

const CON_FILLERS: Candidate[] = [
  blurb('con', 'could-better', 12, 'Die nächste Ausgabe darf schärfer werden',
    'Nichts Dramatisches, aber HEADLINE bleibt hungrig. Ein klarerer Knaller, ein saubererer Satz – dann wird daraus eine Titelstory.'),
  blurb('con', 'thin-kontra', 10, 'Noch Luft im Layout',
    'Das Wochenende hat Seiten, die unbedruckt wirken. Mehr Risiko im Spielplan, mehr Kante auf dem Feld.'),
  blurb('con', 'comfort-room', 8, 'Komfort als Fußnote',
    'Schatten, Sitzkanten, ein stiller Winkel: kleine Dinge, die aus einem guten Samstag einen großen machen.'),
]

const PRO_FILLERS: Candidate[] = [
  blurb('pro', 'field-stands', 11, 'Das Gelände steht noch',
    'Wege, Bühnen, der ganze Apparat: Ihr habt ein Festival hingestellt, das man betreten kann. Das ist die erste Seite.'),
  blurb('pro', 'they-tried', 9, 'Durchgezogen bis Sonntag',
    'Kein Abbruch, kein leeres Versprechen. Die Ausgabe fand statt – und das zählt, bevor die Note kommt.'),
  blurb('pro', 'next-ink', 7, 'Papier für die nächste Nummer',
    'Ruf, Ausbauten, das Feld bleibt. HEADLINE blättert schon voraus: Die nächste Ausgabe startet nicht bei null.'),
]
