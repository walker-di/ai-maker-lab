import type { Rts as DomainRts } from 'domain/shared';
import { Rts } from 'ui/source';
import type { RtsTransport } from '$lib/adapters/rts/RtsTransport';

type ResolvedRtsMap = DomainRts.ResolvedRtsMap;
type Faction = DomainRts.Faction;
type AiDifficulty = DomainRts.AiDifficulty;
type MatchDefinition = DomainRts.MatchDefinition;
type MapGenerationParams = DomainRts.Generation.MapGenerationParams;
type UnitKind = DomainRts.UnitKind;
type BuildingKind = DomainRts.BuildingKind;
type TechKind = DomainRts.TechKind;
type AudioBus = ConstructorParameters<typeof RtsEngine>[0]['audioBus'];

const {
  TECH_STATS,
  Engine: { RtsEngine, AiController, createPixiRtsRendererFactory },
  Runtime: { createRtsHudModel },
} = Rts;

type RtsEngineInstance = InstanceType<typeof RtsEngine>;
type FogSnapshot = NonNullable<ReturnType<RtsEngineInstance['getFog']>>;
type SelectionSummary = ReturnType<RtsEngineInstance['getSelectionSummary']>;
type QueueEntry = ReturnType<RtsEngineInstance['getProductionQueue']>[number];
type ProductionOption = ReturnType<RtsEngineInstance['getProductionOptions']>[number];
type ProductionStructureGroup = ReturnType<RtsEngineInstance['getProductionStructureGroups']>[number];
type ResearchQueueEntry = ReturnType<RtsEngineInstance['getResearchQueue']>[number];
type ResearchOption = ReturnType<RtsEngineInstance['getResearchOptions']>[number];
type ResearchState = ReturnType<RtsEngineInstance['getResearchState']>;
type RallyPointSummary = ReturnType<RtsEngineInstance['getSelectedRallyPoint']>;
type MinimapBlip = ReturnType<RtsEngineInstance['getMinimapBlips']>[number];
type ViewportBounds = ReturnType<RtsEngineInstance['getViewportBounds']>;
type EngineMissionState = ReturnType<RtsEngineInstance['getMissionState']>;
type EngineMissionEnemyActivity = EngineMissionState['enemyActivity'];
type FeedTone = 'info' | 'success' | 'warning';

type ArmedOrderKind = 'attackMove' | 'patrol' | 'repair' | 'rally';

export interface RtsToast {
  id: string;
  message: string;
  tone: FeedTone;
}

export interface RtsFeedEvent {
  id: string;
  title: string;
  detail: string;
  tone: FeedTone;
}

export interface RtsMatchStats {
  mineralMined: number;
  gasMined: number;
  enemyLosses: number;
  friendlyLosses: number;
  unitsCompleted: number;
  structuresCompleted: number;
}

export interface RtsMatchOutcome {
  winner: string;
  durationMs: number;
  mapTitle: string;
  stats: RtsMatchStats;
}

export interface RtsCombatPing {
  id: string;
  tile: DomainRts.TilePos;
  severity: 'warning' | 'danger';
  label: string;
  startedAtMs: number;
  ageMs: number;
  durationMs: number;
}

export interface RtsCameraAlertHint {
  title: string;
  detail: string;
  direction: string;
  severity: 'warning' | 'danger';
  tile: DomainRts.TilePos;
}

export interface RtsEdgeAlertMarker {
  id: string;
  severity: 'warning' | 'danger';
  side: 'top' | 'right' | 'bottom' | 'left';
  offsetPercent: number;
  label: string;
}

export interface RtsControlGroup {
  slot: number;
  entityIds: number[];
  count: number;
  label: string;
}

export interface RtsOrderPreview {
  mode: 'build' | ArmedOrderKind;
  from: { x: number; y: number } | null;
  to: { x: number; y: number };
  tile: DomainRts.TilePos;
  label: string;
}

export interface RtsProductionQueueGroup {
  producerId: number;
  producerKind: BuildingKind;
  itemCount: number;
  items: QueueEntry[];
  selected: boolean;
}

type RtsMissionTone = 'calm' | 'warning' | 'danger' | 'success' | 'failure';

interface RtsThreatSample {
  severity: 'warning' | 'danger';
  atMs: number;
}

export interface RtsMissionState {
  status: 'active' | 'victory' | 'defeat';
  tone: RtsMissionTone;
  title: string;
  objective: string;
  directive: string;
  statusLabel: string;
  statusDetail: string;
  pressureLabel: string;
  pressureDetail: string;
  waveLabel: string;
  waveDetail: string;
  countdownLabel: string;
  countdownValue: string;
  enemyForceLabel: string;
  enemyForceValue: string;
}

const PLAYER_FACTION_ID = 'p1';
const AI_FACTION_ID = 'p2';

const DEFAULT_GEN_PARAMS: MapGenerationParams = {
  seed: 1234,
  archetype: 'open-field',
  size: { cols: 32, rows: 32 },
  maxAltitude: 1,
  factionCount: 2,
  symmetry: 'mirrorH',
  resourceDensity: 'normal',
  altitudeRoughness: 'flat',
  waterAmount: 0,
  ramps: 1,
  version: 1,
};

export interface RtsPageDeps {
  transport: RtsTransport;
  audioBus?: AudioBus;
}

export interface MatchSetupChoice {
  mapId: string;
  aiDifficulty: AiDifficulty;
  fogOfWar: boolean;
  seed: number;
}

export function createRtsPageModel({ transport, audioBus }: RtsPageDeps) {
  let catalog = $state<ResolvedRtsMap[]>([]);
  let isLoading = $state(false);
  let errorMessage = $state<string | null>(null);
  let runActive = $state(false);
  let paused = $state(false);
  let lastWinner = $state<string | null>(null);
  let elapsedMs = $state(0);
  let rendererMode = $state<'sprite' | 'vector'>('vector');
  let muted = $state(false);
  let view = $state<'lobby' | 'match' | 'mapgen'>('lobby');
  let generationParams = $state<MapGenerationParams>({ ...DEFAULT_GEN_PARAMS });
  let lastGenerated = $state<{ map: DomainRts.MapDefinition; params: MapGenerationParams } | null>(null);
  let mapgenError = $state<string | null>(null);
  let toasts = $state<RtsToast[]>([]);
  let currentMap = $state<DomainRts.MapDefinition | null>(null);
  let fogSnapshot = $state<FogSnapshot | null>(null);
  let cameraTile = $state<DomainRts.TilePos>({ col: 0, row: 0 });
  let viewportBounds = $state<ViewportBounds>({ minCol: 0, maxCol: 0, minRow: 0, maxRow: 0 });
  let minimapBlips = $state<MinimapBlip[]>([]);
  let selectionSummary = $state<SelectionSummary>(emptySelectionSummary());
  let selectedEntityIds = $state<number[]>([]);
  let selectedRallyPoint = $state<RallyPointSummary>(null);
  let productionOptions = $state<ProductionOption[]>([]);
  let productionStructureGroups = $state<ProductionStructureGroup[]>([]);
  let productionQueue = $state<QueueEntry[]>([]);
  let productionQueueGroups = $state<RtsProductionQueueGroup[]>([]);
  let researchState = $state<ResearchState>({
    researched: [],
    totalArmorBonus: 0,
    totalDamageBonus: 0,
    totalSightBonus: 0,
  });
  let researchOptions = $state<ResearchOption[]>([]);
  let researchQueue = $state<ResearchQueueEntry[]>([]);
  let eventFeed = $state<RtsFeedEvent[]>([]);
  let lastMatchChoice = $state<MatchSetupChoice | null>(null);
  let matchOutcome = $state<RtsMatchOutcome | null>(null);
  let matchStats = $state<RtsMatchStats>({
    mineralMined: 0,
    gasMined: 0,
    enemyLosses: 0,
    friendlyLosses: 0,
    unitsCompleted: 0,
    structuresCompleted: 0,
  });
  let lastResourceSnapshot = $state<{ mineral: number; gas: number } | null>(null);
  let combatPings = $state<RtsCombatPing[]>([]);
  let combatAlertHint = $state<RtsCameraAlertHint | null>(null);
  let edgeAlertMarkers = $state<RtsEdgeAlertMarker[]>([]);
  let hoverTile = $state<DomainRts.TilePos | null>(null);
  let orderPreview = $state<RtsOrderPreview | null>(null);
  let controlGroups = $state<RtsControlGroup[]>(Array.from({ length: 5 }, (_, index) => ({
    slot: index + 1,
    entityIds: [],
    count: 0,
    label: 'Empty',
  })));
  let latestEnemyWave = $state<{
    index: number;
    size: number;
    launchedAtMs: number | null;
    cadenceMs: number | null;
    nextWaveAtMs: number | null;
  }>({
    index: 0,
    size: 0,
    launchedAtMs: null,
    cadenceMs: null,
    nextWaveAtMs: null,
  });
  let threatSamples = $state<RtsThreatSample[]>([]);
  let engineMission = $state<EngineMissionState | null>(null);

  const hud = createRtsHudModel();

  let engine: InstanceType<typeof RtsEngine> | null = null;
  let ai: InstanceType<typeof AiController> | null = null;
  let aiTickHandle: number | null = null;
  let mountTarget: HTMLDivElement | null = null;
  let mountResolvers: Array<(target: HTMLDivElement) => void> = [];
  let unsubs: Array<() => void> = [];
  let dragStart = $state<{ x: number; y: number; tile: DomainRts.TilePos } | null>(null);
  let dragCurrent = $state<{ x: number; y: number } | null>(null);
  let cursorState = $state('default');
  let buildingMode = $state<BuildingKind | null>(null);
  let armedOrder = $state<ArmedOrderKind | null>(null);

  function whenMounted(): Promise<HTMLDivElement> {
    if (mountTarget) return Promise.resolve(mountTarget);
    return new Promise((resolve) => {
      mountResolvers.push(resolve);
    });
  }

  function emptySelectionSummary(): SelectionSummary {
    return {
      count: 0,
      label: 'No selection',
      detail: 'Click or drag-select units to issue commands.',
      averageHpRatio: null,
      composition: [],
    };
  }

  function emptyControlGroups(): RtsControlGroup[] {
    return Array.from({ length: 5 }, (_, index) => ({
      slot: index + 1,
      entityIds: [],
      count: 0,
      label: 'Empty',
    }));
  }

  function groupProductionQueue(entries: QueueEntry[], selectionIds: number[]): RtsProductionQueueGroup[] {
    const selected = new Set(selectionIds);
    const groups = new Map<number, RtsProductionQueueGroup>();
    for (const entry of entries) {
      const current = groups.get(entry.producerId) ?? {
        producerId: entry.producerId,
        producerKind: entry.producerKind,
        itemCount: 0,
        items: [],
        selected: selected.has(entry.producerId),
      };
      current.items.push(entry);
      current.itemCount += 1;
      current.selected = selected.has(entry.producerId);
      groups.set(entry.producerId, current);
    }
    return [...groups.values()].sort((a, b) => {
      if (a.selected !== b.selected) return a.selected ? -1 : 1;
      return a.producerId - b.producerId;
    });
  }

  function cloneFog(snapshot: FogSnapshot | undefined): FogSnapshot | null {
    if (!snapshot) return null;
    return {
      cols: snapshot.cols,
      rows: snapshot.rows,
      cells: new Uint8Array(snapshot.cells),
    };
  }

  function titleCase(input: string): string {
    return input
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  function pushEvent(title: string, detail: string, tone: FeedTone = 'info'): void {
    eventFeed = [
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title,
        detail,
        tone,
      },
      ...eventFeed,
    ].slice(0, 8);
  }

  function dismissToast(id: string): void {
    toasts = toasts.filter((toast) => toast.id !== id);
  }

  function showToast(message: string, tone: FeedTone = 'info'): void {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    toasts = [{ id, message, tone }, ...toasts].slice(0, 3);
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        dismissToast(id);
      }, 2600);
    }
  }

  function resetMatchStats(): void {
    matchStats = {
      mineralMined: 0,
      gasMined: 0,
      enemyLosses: 0,
      friendlyLosses: 0,
      unitsCompleted: 0,
      structuresCompleted: 0,
    };
    lastResourceSnapshot = null;
  }

  function nowMs(): number {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  function currentMatchMs(): number {
    return engine?.getElapsedMs() ?? elapsedMs;
  }

  function resetMissionTracking(): void {
    latestEnemyWave = {
      index: 0,
      size: 0,
      launchedAtMs: null,
      cadenceMs: null,
      nextWaveAtMs: null,
    };
    threatSamples = [];
    engineMission = null;
  }

  function pushThreatSample(severity: 'warning' | 'danger', atMs = currentMatchMs()): void {
    threatSamples = [...threatSamples, { severity, atMs }]
      .filter((sample) => atMs - sample.atMs < 18_000)
      .slice(-12);
  }

  function cloneMissionSnapshot(state: EngineMissionState | null | undefined): EngineMissionState | null {
    if (!state) return null;
    return {
      ...state,
      enemyActivity: { ...state.enemyActivity },
    };
  }

  function readEngineMissionState(): EngineMissionState | null {
    const currentEngine = engine;
    if (!currentEngine || typeof currentEngine.getMissionState !== 'function') return null;
    return cloneMissionSnapshot(currentEngine.getMissionState());
  }

  function syncMissionSnapshot(nextState?: EngineMissionState | null): void {
    engineMission = nextState === undefined ? readEngineMissionState() : cloneMissionSnapshot(nextState);
  }

  function formatMissionClock(ms: number): string {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  function pluralize(count: number, singular: string, plural = `${singular}s`): string {
    return `${count} ${count === 1 ? singular : plural}`;
  }

  function resolveMissionStatus(phase: EngineMissionState['phase']): RtsMissionState['status'] {
    if (phase === 'victory') return 'victory';
    if (phase === 'defeat') return 'defeat';
    return 'active';
  }

  function resolveMissionTone(status: RtsMissionState['status'], pressure: EngineMissionState['pressure']): RtsMissionTone {
    if (status === 'victory') return 'success';
    if (status === 'defeat') return 'failure';
    if (pressure === 'critical') return 'danger';
    if (pressure === 'high' || pressure === 'rising') return 'warning';
    return 'calm';
  }

  function describeMissionStatusLabel(
    phase: EngineMissionState['phase'],
    enemyActivity: EngineMissionEnemyActivity,
  ): string {
    if (phase === 'victory') return 'Mission complete';
    if (phase === 'defeat') return 'Mission failed';
    if (phase === 'defense') {
      if (enemyActivity.status === 'inbound') return 'Wave contact';
      if (enemyActivity.status === 'imminent') return 'Wave imminent';
      return 'Defensive posture';
    }
    if (phase === 'build-up') return 'Force build-up';
    return 'Opening window';
  }

  function describeMissionStatusDetail(
    phase: EngineMissionState['phase'],
    enemyActivity: EngineMissionEnemyActivity,
  ): string {
    if (phase === 'victory') {
      return `${pluralize(enemyActivity.wavesLaunched, 'wave')} absorbed before the enemy base collapsed.`;
    }
    if (phase === 'defeat') {
      return `${pluralize(enemyActivity.wavesLaunched, 'wave')} launched before your HQ was lost.`;
    }
    if (phase === 'opening') {
      return enemyActivity.cadenceMs == null
        ? 'Enemy timings are still forming.'
        : `Expect repeated attack timings around ${formatMissionClock(enemyActivity.cadenceMs)}.`;
    }
    if (enemyActivity.activeCombatUnits > 0) {
      return `${pluralize(enemyActivity.activeCombatUnits, 'hostile combat unit')} active near the frontline.`;
    }
    return `${pluralize(enemyActivity.wavesLaunched, 'wave')} launched so far.`;
  }

  function describeMissionDirective(mission: EngineMissionState): string {
    if (mission.phase === 'victory') return 'Sweep remaining contacts and prepare to redeploy.';
    if (mission.phase === 'defeat') return 'Fortify earlier, absorb the first push, and keep production alive.';
    if (mission.enemyActivity.status === 'inbound') return 'Hold the line, preserve production, then counter once the push breaks.';
    if (mission.enemyActivity.status === 'imminent') return 'Pull units home, queue reinforcements, and meet the next wave at your perimeter.';
    if (mission.phase === 'build-up') return 'Stay on economy and static defense before the next contact window opens.';
    return 'Use the first lull to expand cleanly before the enemy timing starts.';
  }

  function describeMissionPressureDetail(mission: EngineMissionState, status: RtsMissionState['status']): string {
    const { enemyActivity, pressure } = mission;
    if (status === 'victory') {
      return `${matchStats.enemyLosses} enemy losses recorded as the threat collapsed.`;
    }
    if (status === 'defeat') {
      return `${matchStats.friendlyLosses} friendly losses recorded before the defense broke.`;
    }
    if (pressure === 'critical') {
      const exposed = Math.max(enemyActivity.activeCombatUnits, enemyActivity.lastWaveSize ?? 0, 1);
      return `${pluralize(exposed, 'hostile combat unit')} are threatening your base right now.`;
    }
    if (pressure === 'high') {
      if (enemyActivity.status === 'imminent' && enemyActivity.countdownMs != null) {
        return `Contact window opens in ${formatMissionClock(enemyActivity.countdownMs)}. Keep units close.`;
      }
      return `${pluralize(Math.max(enemyActivity.activeCombatUnits, 1), 'hostile combat unit')} are contesting the frontline.`;
    }
    if (pressure === 'rising') {
      return enemyActivity.countdownMs == null
        ? 'Enemy forces are massing outside sensor range.'
        : `Enemy activity is climbing ahead of the next wave in ${formatMissionClock(enemyActivity.countdownMs)}.`;
    }
    return enemyActivity.activeCombatUnits > 0
      ? `${pluralize(enemyActivity.activeCombatUnits, 'hostile combat unit')} remain on radar, but your perimeter is holding.`
      : 'No active enemy combat units are currently pushing your perimeter.';
  }

  function describeMissionWaveDetail(mission: EngineMissionState, status: RtsMissionState['status']): string {
    const { enemyActivity } = mission;
    if (status === 'victory') {
      return `${pluralize(enemyActivity.wavesLaunched, 'wave')} launched before the enemy camp was cleared.`;
    }
    if (status === 'defeat') {
      return `${pluralize(enemyActivity.wavesLaunched, 'wave')} launched before the field was lost.`;
    }
    if (enemyActivity.status === 'forming') {
      return enemyActivity.cadenceMs == null
        ? 'Wave timing is not available yet.'
        : `Expected cadence: roughly every ${formatMissionClock(enemyActivity.cadenceMs)}.`;
    }
    if (enemyActivity.status === 'inbound') {
      return enemyActivity.lastWaveSize == null
        ? `${pluralize(enemyActivity.activeCombatUnits, 'hostile combat unit')} currently active.`
        : `${pluralize(enemyActivity.lastWaveSize, 'hostile')} committed in the latest push.`;
    }
    if (enemyActivity.lastWaveSize != null) {
      return `${pluralize(enemyActivity.wavesLaunched, 'wave')} launched · last wave ${pluralize(enemyActivity.lastWaveSize, 'hostile')}.`;
    }
    return `${pluralize(enemyActivity.wavesLaunched, 'wave')} launched so far.`;
  }

  function describeMissionCountdownValue(
    enemyActivity: EngineMissionEnemyActivity,
    status: RtsMissionState['status'],
  ): string {
    if (status === 'victory') return 'Secured';
    if (status === 'defeat') return 'Broken';
    if (enemyActivity.countdownMs == null) {
      return enemyActivity.status === 'forming' ? 'Scanning' : 'Stand by';
    }
    return formatMissionClock(enemyActivity.countdownMs);
  }

  function describeMissionEnemyForceValue(
    enemyActivity: EngineMissionEnemyActivity,
    status: RtsMissionState['status'],
  ): string {
    if (status === 'victory') return 'Cleared';
    if (status === 'defeat') return 'Overrun';
    if (enemyActivity.activeCombatUnits > 0) return `${enemyActivity.activeCombatUnits} active`;
    if (enemyActivity.lastWaveSize != null) return `${enemyActivity.lastWaveSize} last wave`;
    return 'No contact';
  }

  function buildMissionShellFromEngine(mission: EngineMissionState): RtsMissionState {
    const status = resolveMissionStatus(mission.phase);
    const tone = resolveMissionTone(status, mission.pressure);
    return {
      status,
      tone,
      title: status === 'active' ? mission.objectiveTitle : status === 'victory' ? 'Mission complete' : 'Mission failed',
      objective: mission.objectiveDetail,
      directive: describeMissionDirective(mission),
      statusLabel: describeMissionStatusLabel(mission.phase, mission.enemyActivity),
      statusDetail: describeMissionStatusDetail(mission.phase, mission.enemyActivity),
      pressureLabel: status === 'active' ? mission.pressureLabel : mission.enemyActivity.statusLabel,
      pressureDetail: describeMissionPressureDetail(mission, status),
      waveLabel: mission.enemyActivity.statusLabel,
      waveDetail: describeMissionWaveDetail(mission, status),
      countdownLabel: status === 'active' ? 'Next wave' : 'Status',
      countdownValue: describeMissionCountdownValue(mission.enemyActivity, status),
      enemyForceLabel: status === 'active' ? 'Enemy fielded' : 'Field state',
      enemyForceValue: describeMissionEnemyForceValue(mission.enemyActivity, status),
    };
  }

  function buildLegacyMissionState(): RtsMissionState {
    const matchMs = currentMatchMs();
    const waveAgeMs = latestEnemyWave.launchedAtMs == null ? null : Math.max(0, matchMs - latestEnemyWave.launchedAtMs);
    const nextWaveCountdownMs = latestEnemyWave.nextWaveAtMs == null ? null : Math.max(0, latestEnemyWave.nextWaveAtMs - matchMs);
    const recentThreats = threatSamples.filter((sample) => matchMs - sample.atMs < 12_000);
    const dangerThreats = recentThreats.filter((sample) => sample.severity === 'danger').length;
    const waveLabel = latestEnemyWave.index > 0
      ? `Wave ${latestEnemyWave.index} · ${latestEnemyWave.size} hostiles`
      : 'No enemy wave detected';
    const waveDetail = latestEnemyWave.launchedAtMs == null
      ? 'The enemy camp is still massing forces beyond the ridge.'
      : waveAgeMs != null && waveAgeMs < 12_000
        ? `Wave ${latestEnemyWave.index} made contact ${Math.max(1, Math.round(waveAgeMs / 1000))}s ago.`
        : `Last contact from wave ${latestEnemyWave.index} was ${Math.max(1, Math.round((waveAgeMs ?? 0) / 1000))}s ago.`;

    if (matchOutcome?.winner === PLAYER_FACTION_ID) {
      return {
        status: 'victory',
        tone: 'success',
        title: 'Objective secured',
        objective: 'Enemy camp neutralized. The ridge is under your control.',
        directive: 'Consolidate the perimeter and prepare for extraction.',
        statusLabel: 'Mission complete',
        statusDetail: `${matchStats.enemyLosses} enemy losses recorded during the operation.`,
        pressureLabel: latestEnemyWave.index > 0 ? 'Final wave broken' : 'Enemy resistance collapsed',
        pressureDetail: latestEnemyWave.index > 0
          ? `Wave ${latestEnemyWave.index} was the last coordinated push and has been destroyed.`
          : 'No enemy counterattack remains in the field.',
        waveLabel: latestEnemyWave.index > 0 ? `Wave ${latestEnemyWave.index} defeated` : 'No active wave',
        waveDetail: `${matchStats.enemyLosses} enemy losses recorded during the operation.`,
        countdownLabel: 'Status',
        countdownValue: 'Secured',
        enemyForceLabel: 'Field state',
        enemyForceValue: 'Cleared',
      };
    }

    if (matchOutcome) {
      return {
        status: 'defeat',
        tone: 'failure',
        title: 'Mission failed',
        objective: 'Your HQ fell before the enemy camp could be destroyed.',
        directive: 'Stabilize the opening, absorb the first assault, then counterattack.',
        statusLabel: 'Mission failed',
        statusDetail: `${matchStats.friendlyLosses} friendly losses recorded before collapse.`,
        pressureLabel: latestEnemyWave.index > 0 ? `Wave ${latestEnemyWave.index} broke the line` : 'Enemy pressure held',
        pressureDetail: latestEnemyWave.index > 0
          ? `${latestEnemyWave.size} hostiles were committed in the decisive assault.`
          : 'The enemy maintained enough pressure to overrun your base.',
        waveLabel: latestEnemyWave.index > 0 ? `Wave ${latestEnemyWave.index} decisive` : 'Wave data unavailable',
        waveDetail: `${matchStats.friendlyLosses} friendly losses recorded before collapse.`,
        countdownLabel: 'Status',
        countdownValue: 'Broken',
        enemyForceLabel: 'Field state',
        enemyForceValue: 'Overrun',
      };
    }

    let tone: RtsMissionTone = 'calm';
    let pressureLabel = 'Enemy buildup';
    let pressureDetail = 'No full strike wave yet. Use the lull to expand and fortify.';
    let statusLabel = 'Opening window';
    let statusDetail = 'Enemy timing data is still coming online.';

    if (dangerThreats >= 2 || (waveAgeMs != null && waveAgeMs < 9_000 && latestEnemyWave.size >= 6)) {
      tone = 'danger';
      pressureLabel = 'Heavy assault';
      pressureDetail = latestEnemyWave.index > 0
        ? `Wave ${latestEnemyWave.index} is pressing your lines right now.`
        : 'Enemy contact is escalating near your base.';
      statusLabel = 'Wave contact';
      statusDetail = `${latestEnemyWave.size} hostiles pressing your current defense.`;
    } else if (waveAgeMs != null && waveAgeMs < 15_000) {
      tone = 'warning';
      pressureLabel = 'Wave in contact';
      pressureDetail = `Enemy units from wave ${latestEnemyWave.index} are still active on the field.`;
      statusLabel = 'Defensive posture';
      statusDetail = `${latestEnemyWave.size} hostiles remain active from the latest wave.`;
    } else if (latestEnemyWave.index > 0) {
      tone = 'warning';
      pressureLabel = 'Enemy regrouping';
      pressureDetail = `The camp is rebuilding after wave ${latestEnemyWave.index}. Expect another push.`;
      statusLabel = 'Force build-up';
      statusDetail = `${latestEnemyWave.index} waves launched so far.`;
    }

    return {
      status: 'active',
      tone,
      title: 'Destroy the enemy camp',
      objective: 'Keep your HQ alive, build up a strike force, and eliminate the enemy base.',
      directive: 'Expand early, blunt each wave, then push once their line thins.',
      statusLabel,
      statusDetail,
      pressureLabel,
      pressureDetail,
      waveLabel,
      waveDetail,
      countdownLabel: 'Next wave',
      countdownValue: nextWaveCountdownMs == null ? (latestEnemyWave.index > 0 ? 'Stand by' : 'Scanning') : formatMissionClock(nextWaveCountdownMs),
      enemyForceLabel: 'Enemy fielded',
      enemyForceValue: waveAgeMs != null && waveAgeMs < 15_000
        ? `${latestEnemyWave.size} active`
        : latestEnemyWave.size > 0
          ? `${latestEnemyWave.size} last wave`
          : 'No contact',
    };
  }

  function buildMissionState(): RtsMissionState {
    return engineMission ? buildMissionShellFromEngine(engineMission) : buildLegacyMissionState();
  }

  function describeDirection(from: DomainRts.TilePos, to: DomainRts.TilePos): string {
    const dx = to.col - from.col;
    const dy = to.row - from.row;
    const vertical = Math.abs(dy) <= 2 ? '' : dy < 0 ? 'north' : 'south';
    const horizontal = Math.abs(dx) <= 2 ? '' : dx < 0 ? 'west' : 'east';
    if (!vertical && !horizontal) return 'nearby';
    return [vertical, horizontal].filter(Boolean).join('-');
  }

  function syncControlGroups(): void {
    const currentEngine = engine;
    controlGroups = controlGroups.map((group) => {
      const ids = currentEngine ? group.entityIds.filter((id) => currentEngine.world.isAlive(id)) : [];
      return {
        ...group,
        entityIds: ids,
        count: ids.length,
        label: ids.length > 0 ? group.label : 'Empty',
      };
    });
  }

  function syncOrderPreview(): void {
    if (!engine) {
      orderPreview = null;
      return;
    }
    const anchorTile = engine.getSelectionAnchorTile();
    const from = anchorTile ? engine.tileToScreen(anchorTile) : null;

    if (buildingMode || armedOrder) {
      if (!hoverTile) {
        orderPreview = null;
        return;
      }
      const to = engine.tileToScreen(hoverTile);
      if (!to) {
        orderPreview = null;
        return;
      }
      if (buildingMode) {
        orderPreview = {
          mode: 'build',
          from: null,
          to,
          tile: { ...hoverTile },
          label: `Place ${titleCase(buildingMode)}`,
        };
        return;
      }
      const activeOrder = armedOrder;
      if (!activeOrder) {
        orderPreview = null;
        return;
      }
      orderPreview = {
        mode: activeOrder,
        from,
        to,
        tile: { ...hoverTile },
        label: activeOrder === 'rally'
          ? `Set rally point to ${hoverTile.col},${hoverTile.row}`
          : `${titleCase(activeOrder)} to ${hoverTile.col},${hoverTile.row}`,
      };
      return;
    }

    if (!selectedRallyPoint) {
      orderPreview = null;
      return;
    }
    const to = engine.tileToScreen(selectedRallyPoint.tile);
    if (!to) {
      orderPreview = null;
      return;
    }
    orderPreview = {
      mode: 'rally',
      from,
      to,
      tile: { ...selectedRallyPoint.tile },
      label: `Rally point · ${selectedRallyPoint.producerCount} structure${selectedRallyPoint.producerCount === 1 ? '' : 's'}`,
    };
  }

  function syncCombatReadability(referenceMs = nowMs()): void {
    combatPings = combatPings
      .map((ping) => ({ ...ping, ageMs: Math.max(0, referenceMs - ping.startedAtMs) }))
      .filter((ping) => ping.ageMs < ping.durationMs);

    edgeAlertMarkers = combatPings.flatMap((ping) => {
      const insideViewport =
        ping.tile.col >= viewportBounds.minCol &&
        ping.tile.col <= viewportBounds.maxCol &&
        ping.tile.row >= viewportBounds.minRow &&
        ping.tile.row <= viewportBounds.maxRow;
      if (insideViewport) return [];

      const spanCols = Math.max(1, viewportBounds.maxCol - viewportBounds.minCol + 1);
      const spanRows = Math.max(1, viewportBounds.maxRow - viewportBounds.minRow + 1);
      const leftGap = viewportBounds.minCol - ping.tile.col;
      const rightGap = ping.tile.col - viewportBounds.maxCol;
      const topGap = viewportBounds.minRow - ping.tile.row;
      const bottomGap = ping.tile.row - viewportBounds.maxRow;

      let side: RtsEdgeAlertMarker['side'] = 'top';
      let offsetPercent = 50;
      const maxGap = Math.max(leftGap, rightGap, topGap, bottomGap);
      if (maxGap === leftGap) {
        side = 'left';
        offsetPercent = ((ping.tile.row - viewportBounds.minRow + 0.5) / spanRows) * 100;
      } else if (maxGap === rightGap) {
        side = 'right';
        offsetPercent = ((ping.tile.row - viewportBounds.minRow + 0.5) / spanRows) * 100;
      } else if (maxGap === bottomGap) {
        side = 'bottom';
        offsetPercent = ((ping.tile.col - viewportBounds.minCol + 0.5) / spanCols) * 100;
      } else {
        side = 'top';
        offsetPercent = ((ping.tile.col - viewportBounds.minCol + 0.5) / spanCols) * 100;
      }

      return [{
        id: ping.id,
        severity: ping.severity,
        side,
        offsetPercent: Math.max(8, Math.min(92, offsetPercent)),
        label: ping.label,
      }];
    }).slice(0, 3);

    const nextAlert = combatPings.find((ping) => ping.severity === 'danger') ?? combatPings[0] ?? null;
    if (!nextAlert) {
      combatAlertHint = null;
      return;
    }

    const direction = describeDirection(cameraTile, nextAlert.tile);
    combatAlertHint = {
      title: nextAlert.label,
      detail:
        direction === 'nearby'
          ? 'Combat is breaking close to the current camera.'
          : `Contact ${direction} of the camera. Click the minimap to jump.`,
      direction,
      severity: nextAlert.severity,
      tile: { ...nextAlert.tile },
    };
  }

  function pushCombatPing(tile: DomainRts.TilePos, severity: 'warning' | 'danger', label: string): void {
    const startedAtMs = nowMs();
    combatPings = [
      {
        id: `${startedAtMs}-${Math.random().toString(16).slice(2)}`,
        tile: { ...tile },
        severity,
        label,
        startedAtMs,
        ageMs: 0,
        durationMs: severity === 'danger' ? 2600 : 1800,
      },
      ...combatPings,
    ].slice(0, 6);
    syncCombatReadability(startedAtMs);
  }

  function syncHudResearchState(): void {
    const activeResearch = researchQueue[0] ?? null;
    hud.setResearch(
      activeResearch ? TECH_STATS[activeResearch.kind].label : null,
      activeResearch?.progress ?? null,
      researchState.researched.length,
    );
  }

  function refreshRuntimeState(): void {
    if (!engine) {
      currentMap = null;
      fogSnapshot = null;
      cameraTile = { col: 0, row: 0 };
      viewportBounds = { minCol: 0, maxCol: 0, minRow: 0, maxRow: 0 };
      minimapBlips = [];
      selectionSummary = emptySelectionSummary();
      selectedEntityIds = [];
      selectedRallyPoint = null;
      productionOptions = [];
      productionStructureGroups = [];
      productionQueue = [];
      productionQueueGroups = [];
      researchState = { researched: [], totalArmorBonus: 0, totalDamageBonus: 0, totalSightBonus: 0 };
      researchOptions = [];
      researchQueue = [];
      combatPings = [];
      combatAlertHint = null;
      edgeAlertMarkers = [];
      hoverTile = null;
      orderPreview = null;
      engineMission = null;
      syncHudResearchState();
      return;
    }

    currentMap = engine.map.definition;
    syncMissionSnapshot();
    fogSnapshot = cloneFog(engine.getFog(PLAYER_FACTION_ID));
    cameraTile = { ...engine.getCameraTile() };
    viewportBounds = engine.getViewportBounds();
    minimapBlips = engine.getMinimapBlips(PLAYER_FACTION_ID);
    selectedEntityIds = engine.getSelection();
    selectionSummary = engine.getSelectionSummary();
    selectedRallyPoint = engine.getSelectedRallyPoint();
    productionOptions = engine.getProductionOptions(PLAYER_FACTION_ID);
    productionStructureGroups = engine.getProductionStructureGroups(PLAYER_FACTION_ID);
    productionQueue = engine.getProductionQueue(PLAYER_FACTION_ID);
    productionQueueGroups = groupProductionQueue(productionQueue, selectedEntityIds);
    researchState = engine.getResearchState(PLAYER_FACTION_ID);
    researchOptions = engine.getResearchOptions(PLAYER_FACTION_ID);
    researchQueue = engine.getResearchQueue(PLAYER_FACTION_ID);
    syncHudResearchState();
    syncControlGroups();
    syncCombatReadability();
    syncOrderPreview();
  }

  async function bootstrap() {
    if (isLoading) return;
    isLoading = true;
    errorMessage = null;
    try {
      catalog = await transport.listMaps();
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Failed to load RTS map catalog';
    } finally {
      isLoading = false;
    }
  }

  function setMountTarget(target: HTMLDivElement | null) {
    mountTarget = target;
    if (target && mountResolvers.length > 0) {
      const pending = mountResolvers;
      mountResolvers = [];
      for (const resolve of pending) resolve(target);
    }
  }

  function disposeEngine() {
    if (aiTickHandle != null && typeof window !== 'undefined') {
      window.clearInterval(aiTickHandle);
      aiTickHandle = null;
    }
    for (const unsub of unsubs) unsub();
    unsubs = [];
    engine?.dispose();
    engine = null;
    ai = null;
    runActive = false;
    paused = false;
    hud.setPaused(false);
    currentMap = null;
    fogSnapshot = null;
    cameraTile = { col: 0, row: 0 };
    viewportBounds = { minCol: 0, maxCol: 0, minRow: 0, maxRow: 0 };
    minimapBlips = [];
    selectionSummary = emptySelectionSummary();
    selectedEntityIds = [];
    selectedRallyPoint = null;
    productionOptions = [];
    productionStructureGroups = [];
    productionQueue = [];
    productionQueueGroups = [];
    researchState = { researched: [], totalArmorBonus: 0, totalDamageBonus: 0, totalSightBonus: 0 };
    researchOptions = [];
    researchQueue = [];
    syncHudResearchState();
    eventFeed = [];
    matchOutcome = null;
    engineMission = null;
    toasts = [];
    combatPings = [];
    combatAlertHint = null;
    edgeAlertMarkers = [];
    hoverTile = null;
    orderPreview = null;
    controlGroups = emptyControlGroups();
    elapsedMs = 0;
    resetMatchStats();
    resetMissionTracking();
  }

  async function startMatch(choice: MatchSetupChoice): Promise<void> {
    errorMessage = null;
    disposeEngine();
    view = 'match';
    try {
      const factions: Faction[] = [
        { id: PLAYER_FACTION_ID, label: 'You', color: '#4dabff', isPlayer: true, isAi: false },
        {
          id: AI_FACTION_ID,
          label: 'AI',
          color: '#ff6b6b',
          isPlayer: false,
          isAi: true,
          aiDifficulty: choice.aiDifficulty,
        },
      ];
      lastMatchChoice = { ...choice };
      const { match, map } = await transport.startMatch({
        mapId: choice.mapId,
        factions,
        rules: {
          fogOfWar: choice.fogOfWar,
          aiDifficulty: choice.aiDifficulty,
          rngSeed: choice.seed,
        },
      });

      const next = new RtsEngine({
        match: match as MatchDefinition,
        map,
        rendererFactory: createPixiRtsRendererFactory({ width: 960, height: 540 }),
        audioBus,
      });
      engine = next;

      const aiFaction = factions.find((f) => f.isAi);
      if (aiFaction) {
        ai = new AiController(next, aiFaction.id, aiFaction.aiDifficulty ?? 'normal', choice.seed);
      }

      hud.setFactionId(PLAYER_FACTION_ID);
      const initialResources = next.getResources(PLAYER_FACTION_ID);
      hud.setResources(initialResources.mineral, initialResources.gas);
      hud.setSupply(initialResources.supplyUsed, initialResources.supplyCap);
      hud.setSelection(0, '');
      hud.setElapsed(0);
      hud.setBuildingMode(null);
      hud.setArmedOrder(null);
      hud.setResearch(null, null, 0);
      hud.setPaused(false);
      eventFeed = [];
      matchOutcome = null;
      combatPings = [];
      combatAlertHint = null;
      edgeAlertMarkers = [];
      hoverTile = null;
      orderPreview = null;
      controlGroups = emptyControlGroups();
      elapsedMs = 0;
      researchState = { researched: [], totalArmorBonus: 0, totalDamageBonus: 0, totalSightBonus: 0 };
      researchOptions = [];
      researchQueue = [];
      resetMatchStats();
      resetMissionTracking();
      lastResourceSnapshot = { mineral: initialResources.mineral, gas: initialResources.gas };
      pushEvent('Match started', `${map.metadata.title} · ${choice.aiDifficulty} AI · ${choice.fogOfWar ? 'fog on' : 'fog off'}`, 'success');
      showToast('Briefing: secure your base, expand, and break the enemy camp.', 'info');

      unsubs.push(
        next.emitter.on('missionUpdated', ({ state }) => {
          syncMissionSnapshot(state);
        }),
      );
      unsubs.push(
        next.emitter.on('resourceChanged', (payload) => {
          if (payload.factionId !== PLAYER_FACTION_ID) return;
          if (lastResourceSnapshot) {
            matchStats = {
              ...matchStats,
              mineralMined: matchStats.mineralMined + Math.max(0, payload.mineral - lastResourceSnapshot.mineral),
              gasMined: matchStats.gasMined + Math.max(0, payload.gas - lastResourceSnapshot.gas),
            };
          }
          lastResourceSnapshot = { mineral: payload.mineral, gas: payload.gas };
          hud.setResources(payload.mineral, payload.gas);
          const supply = next.getResources(PLAYER_FACTION_ID);
          hud.setSupply(supply.supplyUsed, supply.supplyCap);
          refreshRuntimeState();
        }),
      );
      unsubs.push(
        next.emitter.on('selectionChanged', ({ entityIds }) => {
          const summary = next.getSelectionSummary();
          selectionSummary = summary;
          hud.setSelection(entityIds.length, entityIds.length > 0 ? summary.label : '');
          refreshRuntimeState();
        }),
      );
      unsubs.push(
        next.emitter.on('productionStarted', ({ factionId, kind }) => {
          if (factionId !== PLAYER_FACTION_ID) return;
          pushEvent('Production queued', titleCase(kind), 'info');
          refreshRuntimeState();
        }),
      );
      unsubs.push(
        next.emitter.on('productionCanceled', ({ factionId, kind }) => {
          if (factionId !== PLAYER_FACTION_ID) return;
          pushEvent('Production canceled', titleCase(kind), 'warning');
          refreshRuntimeState();
        }),
      );
      unsubs.push(
        next.emitter.on('productionCompleted', ({ factionId, kind }) => {
          if (factionId !== PLAYER_FACTION_ID) return;
          matchStats = { ...matchStats, unitsCompleted: matchStats.unitsCompleted + 1 };
          pushEvent('Production complete', titleCase(kind), 'success');
          refreshRuntimeState();
        }),
      );
      unsubs.push(
        next.emitter.on('researchStarted', ({ factionId, kind }) => {
          if (factionId !== PLAYER_FACTION_ID) return;
          pushEvent('Research started', TECH_STATS[kind].label, 'info');
          showToast(`${TECH_STATS[kind].label} research started.`, 'info');
          refreshRuntimeState();
        }),
      );
      unsubs.push(
        next.emitter.on('researchCompleted', ({ factionId, kind }) => {
          if (factionId !== PLAYER_FACTION_ID) return;
          pushEvent('Research complete', TECH_STATS[kind].label, 'success');
          showToast(`${TECH_STATS[kind].label} complete.`, 'success');
          refreshRuntimeState();
        }),
      );
      unsubs.push(
        next.emitter.on('researchCanceled', ({ factionId, kind }) => {
          if (factionId !== PLAYER_FACTION_ID) return;
          pushEvent('Research canceled', TECH_STATS[kind].label, 'warning');
          refreshRuntimeState();
        }),
      );
      unsubs.push(
        next.emitter.on('buildingPlaced', ({ factionId, kind }) => {
          if (factionId !== PLAYER_FACTION_ID) return;
          matchStats = { ...matchStats, structuresCompleted: matchStats.structuresCompleted + 1 };
          pushEvent('Structure online', titleCase(kind), 'success');
          refreshRuntimeState();
        }),
      );
      unsubs.push(
        next.emitter.on('unitKilled', ({ factionId }) => {
          if (factionId === PLAYER_FACTION_ID) {
            matchStats = { ...matchStats, friendlyLosses: matchStats.friendlyLosses + 1 };
            pushEvent('Unit lost', 'One of your forces was destroyed.', 'warning');
          } else {
            matchStats = { ...matchStats, enemyLosses: matchStats.enemyLosses + 1 };
            pushEvent('Enemy destroyed', `Enemy ${factionId} asset eliminated.`, 'success');
          }
          refreshRuntimeState();
        }),
      );
      unsubs.push(
        next.emitter.on('combatAlert', ({ tile, severity, kind, factionId }) => {
          pushCombatPing(tile, severity, kind === 'critical' ? 'Critical impact' : 'Incoming fire');
          if (factionId === PLAYER_FACTION_ID) {
            pushThreatSample(severity, next.getElapsedMs());
          }
          if (severity === 'danger' && factionId === PLAYER_FACTION_ID) {
            pushEvent('Contact report', `${kind === 'critical' ? 'Critical damage' : 'Incoming fire'} near your forces.`, 'warning');
          }
          syncMissionSnapshot();
        }),
      );
      unsubs.push(
        next.emitter.on('matchEnded', async ({ winner, durationMs }) => {
          lastWinner = winner;
          runActive = false;
          matchOutcome = { winner, durationMs, mapTitle: map.metadata.title, stats: { ...matchStats } };
          syncMissionSnapshot();
          pushEvent(winner === PLAYER_FACTION_ID ? 'Victory' : 'Match ended', `Winner: ${winner}`, winner === PLAYER_FACTION_ID ? 'success' : 'warning');
          showToast(winner === PLAYER_FACTION_ID ? 'Victory! Enemy camp destroyed.' : 'Defeat. Your base has fallen.', winner === PLAYER_FACTION_ID ? 'success' : 'warning');
          try {
            await transport.recordMatchResult({
              matchId: match.id,
              mapId: match.mapId,
              winner,
              durationMs,
              factions,
              finishedAt: new Date().toISOString(),
            });
          } catch (error) {
            errorMessage = error instanceof Error ? error.message : 'Failed to record match result';
          }
        }),
      );
      unsubs.push(
        next.emitter.on('squadLaunched', ({ size, waveIndex, launchedAtMs, cadenceMs }) => {
          const effectiveLaunchMs = launchedAtMs ?? next.getElapsedMs();
          latestEnemyWave = {
            index: waveIndex,
            size,
            launchedAtMs: effectiveLaunchMs,
            cadenceMs: cadenceMs ?? latestEnemyWave.cadenceMs,
            nextWaveAtMs: cadenceMs == null ? null : effectiveLaunchMs + cadenceMs,
          };
          syncMissionSnapshot();
          showToast(`Enemy wave ${waveIndex} launched (${size})`, 'warning');
          pushEvent('Enemy wave launched', `Wave ${waveIndex} is advancing with ${size} hostiles.`, 'warning');
        }),
      );

      const target = await whenMounted();
      await next.mount(target);
      rendererMode = next.getSpriteMode();
      next.start();
      runActive = true;
      lastWinner = null;
      refreshRuntimeState();

      if (typeof window !== 'undefined') {
        aiTickHandle = window.setInterval(() => {
          if (!engine) return;
          const ms = engine.getElapsedMs();
          elapsedMs = ms;
          hud.setElapsed(ms);
          ai?.tick(ms);
          refreshRuntimeState();
        }, 150);
      }
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Failed to start match';
    }
  }

  function handlePointerDown(event: PointerEvent): void {
    if (!engine) return;
    void engine.resumeAudio();
    if (event.button === 2) return; // context menu handled separately
    const tile = engine.screenToTile(event.clientX, event.clientY);
    if (!tile) return;
    (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
    dragStart = { x: event.clientX, y: event.clientY, tile };
    dragCurrent = { x: event.clientX, y: event.clientY };
  }

  function handlePointerMove(event: PointerEvent): void {
    if (dragStart) {
      dragCurrent = { x: event.clientX, y: event.clientY };
      return;
    }
    if (!engine) return;
    const tile = engine.screenToTile(event.clientX, event.clientY);
    hoverTile = tile;
    cursorState = tile ? engine.getCursorStateForTile(tile) : 'default';
    syncOrderPreview();
  }

  function handlePointerUp(event: PointerEvent): void {
    if (!engine || !dragStart) return;
    (event.currentTarget as HTMLElement | null)?.releasePointerCapture?.(event.pointerId);
    const tile = engine.screenToTile(event.clientX, event.clientY);
    const dx = event.clientX - dragStart.x;
    const dy = event.clientY - dragStart.y;
    const dragged = Math.hypot(dx, dy) > 6;
    if (dragged && tile) {
      engine.selectInBox(dragStart.tile, tile);
    } else if (tile) {
      if (buildingMode) {
        const pendingBuilding = buildingMode;
        const placed = engine.placeBuilding(PLAYER_FACTION_ID, pendingBuilding, tile);
        if (placed != null) {
          buildingMode = null;
          syncHudIntentState();
          showToast(`${titleCase(pendingBuilding)} placement confirmed.`, 'success');
        }
      } else if (armedOrder === 'rally') {
        setRallyPoint(tile);
        armedOrder = null;
        syncHudIntentState();
      } else if (armedOrder) {
        engine.issueContextOrderAtTile(tile, armedOrder);
        armedOrder = null;
        syncHudIntentState();
      } else {
        engine.handleClickAtTile(tile, event.shiftKey);
      }
    }
    dragStart = null;
    dragCurrent = null;
    syncOrderPreview();
  }

  function handleContextMenu(event: MouseEvent): void {
    event.preventDefault();
    if (!engine) return;
    void engine.resumeAudio();
    const tile = engine.screenToTile(event.clientX, event.clientY);
    if (!tile) return;
    if (hasOnlyProductionBuildingsSelected()) {
      setRallyPoint(tile);
      return;
    }
    const targetEntity = engine.pickEntityAtTile(tile);
    if (targetEntity != null) {
      const selectionIds = engine.getSelection();
      if (selectionIds.length > 0) {
        engine.orderAttackTarget(targetEntity);
        showToast('Attack order issued.', 'warning');
        return;
      }
    }
    engine.orderMoveSelectionTo(tile);
  }

  function toggleRendererMode(): void {
    if (!engine) return;
    rendererMode = engine.toggleSpriteMode();
    pushEvent('Renderer mode', `${rendererMode} mode`, 'info');
  }

  function setMuted(nextMuted = !muted): void {
    muted = nextMuted;
    engine?.setAudioMuted(muted);
    hud.setMuted(muted);
  }

  function produceUnit(kind: UnitKind): void {
    const queued = engine?.enqueueProductionFromSelection(kind) ?? 0;
    if (queued > 0) {
      const detail = queued > 1 ? `${queued} structures queued ${titleCase(kind)}.` : `${titleCase(kind)} queued.`;
      showToast(detail, 'success');
      pushEvent('Production queued', detail, 'success');
    } else {
      showToast(`No ready structure can train ${titleCase(kind)}.`, 'warning');
    }
    refreshRuntimeState();
  }

  function researchTech(kind: TechKind): void {
    const started = engine?.enqueueResearchFromSelection(kind) ?? 0;
    if (started > 0) {
      refreshRuntimeState();
      return;
    }

    const option = researchOptions.find((entry) => entry.kind === kind);
    if (option?.researched) {
      showToast(`${TECH_STATS[kind].label} is already complete.`, 'info');
    } else if (option?.queued) {
      showToast(`${TECH_STATS[kind].label} is already in progress.`, 'info');
    } else if (option && !option.prerequisitesMet) {
      const required = option.blockedBy.map((tech) => TECH_STATS[tech].label).join(', ');
      showToast(required ? `Need ${required} before ${TECH_STATS[kind].label}.` : `${TECH_STATS[kind].label} is locked.`, 'warning');
    } else if (option && option.available && !option.queueReady) {
      showToast('Your HQ is busy with another upgrade.', 'warning');
    } else if (option) {
      const missing: string[] = [];
      if (hud.state.mineral < TECH_STATS[kind].cost.mineral) {
        missing.push(`${TECH_STATS[kind].cost.mineral - hud.state.mineral} minerals`);
      }
      if (hud.state.gas < TECH_STATS[kind].cost.gas) {
        missing.push(`${TECH_STATS[kind].cost.gas - hud.state.gas} gas`);
      }
      if (missing.length > 0) {
        showToast(`Need ${missing.join(' and ')} for ${TECH_STATS[kind].label}.`, 'warning');
      } else {
        showToast(`No ready HQ can research ${TECH_STATS[kind].label}.`, 'warning');
      }
    } else {
      showToast(`No ready HQ can research ${TECH_STATS[kind].label}.`, 'warning');
    }
    refreshRuntimeState();
  }

  function hasOnlyProductionBuildingsSelected(): boolean {
    return selectionSummary.count > 0
      && selectionSummary.composition.every((entry) => entry.category === 'building')
      && productionOptions.some((option) => option.selectedProducerCount > 0);
  }

  function setRallyPoint(tile: DomainRts.TilePos): void {
    if (!engine) return;
    const updated = engine.setSelectedRallyPoint(tile);
    if (updated > 0) {
      const detail = updated > 1
        ? `Rally point updated for ${updated} structures.`
        : `Rally point updated to ${tile.col},${tile.row}.`;
      showToast(detail, 'success');
      pushEvent('Rally point updated', detail, 'info');
    } else {
      showToast('Select one or more ready production structures before setting a rally point.', 'warning');
    }
    refreshRuntimeState();
  }

  function syncHudIntentState(): void {
    hud.setBuildingMode(buildingMode);
    hud.setArmedOrder(armedOrder);
    syncOrderPreview();
  }

  function placeBuilding(kind: BuildingKind): void {
    buildingMode = kind;
    armedOrder = null;
    syncHudIntentState();
  }

  function cancelBuildingMode(): void {
    buildingMode = null;
    syncHudIntentState();
  }

  function armOrder(kind: ArmedOrderKind): void {
    if (selectionSummary.count === 0) {
      showToast(`Select units before ${kind === 'attackMove' ? 'attack-moving' : titleCase(kind).toLowerCase()}.`, 'warning');
      return;
    }
    if (kind === 'rally' && !hasOnlyProductionBuildingsSelected()) {
      showToast('Select one or more ready production structures before setting a rally point.', 'warning');
      return;
    }
    if (kind === 'repair' && !selectionSummary.composition.some((entry) => entry.kind === 'worker')) {
      showToast('Select at least one worker before repairing.', 'warning');
      return;
    }
    armedOrder = kind;
    buildingMode = null;
    syncHudIntentState();
    pushEvent('Order armed', titleCase(kind), 'info');
    showToast(`${titleCase(kind)} armed. Left-click a target tile${kind === 'repair' ? ' or damaged friendly building' : ''}.`, 'info');
  }

  function jumpCamera(tile: DomainRts.TilePos): void {
    if (!engine) return;
    engine.setCameraTile(tile);
    refreshRuntimeState();
  }

  function selectProductionGroup(kind: BuildingKind): void {
    if (!engine) return;
    const count = engine.selectProductionBuildings(kind);
    if (count === 0) {
      showToast(`No ${titleCase(kind)} structures are available.`, 'warning');
      return;
    }
    showToast(`${count} ${titleCase(kind)} structure${count === 1 ? '' : 's'} selected.`, 'info');
    refreshRuntimeState();
  }

  function focusProducer(producerId: number): void {
    if (!engine) return;
    engine.selectByIds([producerId]);
    const tile = engine.getEntityTile(producerId);
    if (tile) engine.setCameraTile(tile);
    showToast('Producer focused.', 'info');
    refreshRuntimeState();
  }

  function cancelProducerQueueItem(producerId: number): void {
    if (!engine) return;
    const canceled = engine.cancelLastProduction(producerId);
    if (!canceled) {
      showToast('Nothing to cancel for that producer.', 'warning');
      return;
    }
    showToast(`${titleCase(canceled.kind)} canceled. Resources refunded.`, 'warning');
    refreshRuntimeState();
  }

  function assignControlGroup(slot: number): void {
    if (!engine) return;
    const ids = engine.getSelection();
    controlGroups = controlGroups.map((group) =>
      group.slot === slot
        ? {
            ...group,
            entityIds: ids,
            count: ids.length,
            label: ids.length > 0 ? selectionSummary.label : 'Empty',
          }
        : group,
    );
    showToast(ids.length > 0 ? `Control group ${slot} assigned.` : `Control group ${slot} cleared.`, 'info');
  }

  function recallControlGroup(slot: number): void {
    if (!engine) return;
    const group = controlGroups.find((entry) => entry.slot === slot);
    if (!group || group.entityIds.length === 0) {
      showToast(`Control group ${slot} is empty.`, 'warning');
      return;
    }
    engine.selectByIds(group.entityIds);
    showToast(`Control group ${slot} recalled.`, 'info');
    refreshRuntimeState();
  }

  function selectArmy(): void {
    engine?.selectArmy();
    refreshRuntimeState();
  }

  function stopSelection(): void {
    armedOrder = null;
    syncHudIntentState();
    engine?.stopSelection();
    refreshRuntimeState();
  }

  function holdSelection(): void {
    armedOrder = null;
    syncHudIntentState();
    engine?.holdSelection();
    showToast('Hold position issued.', 'info');
    refreshRuntimeState();
  }

  async function restartMatch(): Promise<void> {
    if (!lastMatchChoice) return;
    await startMatch(lastMatchChoice);
  }

  function togglePause(): void {
    if (!engine) return;
    if (paused) {
      engine.start();
      paused = false;
    } else {
      engine.stop();
      paused = true;
    }
    hud.setPaused(paused);
  }

  function leaveMatch(): void {
    disposeEngine();
    view = 'lobby';
  }

  function openMapGen(): void {
    view = 'mapgen';
    mapgenError = null;
  }

  function closeMapGen(): void {
    view = 'lobby';
  }

  async function generate(params: MapGenerationParams): Promise<void> {
    mapgenError = null;
    try {
      const result = await transport.generateMap(params);
      lastGenerated = result;
      generationParams = result.params;
    } catch (error) {
      mapgenError = error instanceof Error ? error.message : 'Generation failed';
    }
  }

  async function saveGenerated(title: string, author: string): Promise<void> {
    if (!lastGenerated) return;
    mapgenError = null;
    try {
      await transport.saveUserMap({
        map: lastGenerated.map,
        params: lastGenerated.params,
        title,
        author,
      });
      catalog = await transport.listMaps();
    } catch (error) {
      mapgenError = error instanceof Error ? error.message : 'Save failed';
    }
  }

  function dispose(): void {
    disposeEngine();
    mountResolvers = [];
  }

  return {
    get catalog() { return catalog; },
    get isLoading() { return isLoading; },
    get errorMessage() { return errorMessage; },
    get runActive() { return runActive; },
    get paused() { return paused; },
    get lastWinner() { return lastWinner; },
    get elapsedMs() { return elapsedMs; },
    get rendererMode() { return rendererMode; },
    get muted() { return muted; },
    get cursorState() { return cursorState; },
    get armedOrder() { return armedOrder; },
    get buildingMode() { return buildingMode; },
    get matchOutcome() { return matchOutcome; },
    get view() { return view; },
    get hud() { return hud; },
    get currentMap() { return currentMap; },
    get fogSnapshot() { return fogSnapshot; },
    get cameraTile() { return cameraTile; },
    get viewportBounds() { return viewportBounds; },
    get minimapBlips() { return minimapBlips; },
    get selectionSummary() { return selectionSummary; },
    get selectedRallyPoint() { return selectedRallyPoint; },
    get productionOptions() { return productionOptions; },
    get productionStructureGroups() { return productionStructureGroups; },
    get researchState() { return researchState; },
    get researchOptions() { return researchOptions; },
    get researchQueue() { return researchQueue; },
    get activeResearch() { return researchQueue[0] ?? null; },
    get orderPreview() { return orderPreview; },
    get mission() { return buildMissionState(); },
    get controlGroups() { return controlGroups; },
    get productionQueue() { return productionQueue; },
    get productionQueueGroups() { return productionQueueGroups; },
    get eventFeed() { return eventFeed; },
    get matchStats() { return matchStats; },
    get combatPings() { return combatPings; },
    get combatAlertHint() { return combatAlertHint; },
    get edgeAlertMarkers() { return edgeAlertMarkers; },
    get toasts() { return toasts; },
    get generationParams() { return generationParams; },
    get lastGenerated() { return lastGenerated; },
    get mapgenError() { return mapgenError; },
    get dragRect() {
      if (!dragStart || !dragCurrent) return null;
      const x = Math.min(dragStart.x, dragCurrent.x);
      const y = Math.min(dragStart.y, dragCurrent.y);
      const width = Math.abs(dragCurrent.x - dragStart.x);
      const height = Math.abs(dragCurrent.y - dragStart.y);
      if (width < 4 && height < 4) return null;
      return { x, y, width, height };
    },
    bootstrap,
    setMountTarget,
    startMatch,
    togglePause,
    leaveMatch,
    openMapGen,
    closeMapGen,
    generate,
    saveGenerated,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleContextMenu,
    toggleRendererMode,
    setMuted,
    produceUnit,
    researchTech,
    placeBuilding,
    cancelBuildingMode,
    armOrder,
    jumpCamera,
    selectProductionGroup,
    focusProducer,
    cancelProducerQueueItem,
    assignControlGroup,
    recallControlGroup,
    selectArmy,
    stopSelection,
    holdSelection,
    restartMatch,
    dismissToast,
    dispose,
  };
}

export type RtsPageModel = ReturnType<typeof createRtsPageModel>;
