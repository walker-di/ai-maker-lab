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
type AudioBus = ConstructorParameters<typeof RtsEngine>[0]['audioBus'];

const {
  Engine: { RtsEngine, AiController, createPixiRtsRendererFactory },
  Runtime: { createRtsHudModel },
} = Rts;

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
  let toastMessage = $state<string | null>(null);

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
  let armedOrder = $state<'patrol' | 'repair' | null>(null);

  function whenMounted(): Promise<HTMLDivElement> {
    if (mountTarget) return Promise.resolve(mountTarget);
    return new Promise((resolve) => {
      mountResolvers.push(resolve);
    });
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
      hud.setPaused(false);

      unsubs.push(
        next.emitter.on('resourceChanged', (payload) => {
          if (payload.factionId !== PLAYER_FACTION_ID) return;
          hud.setResources(payload.mineral, payload.gas);
          const supply = next.getResources(PLAYER_FACTION_ID);
          hud.setSupply(supply.supplyUsed, supply.supplyCap);
        }),
      );
      unsubs.push(
        next.emitter.on('selectionChanged', ({ entityIds }) => {
          hud.setSelection(entityIds.length, entityIds.length === 1 ? `Unit ${entityIds[0]}` : '');
        }),
      );
      unsubs.push(
        next.emitter.on('matchEnded', async ({ winner, durationMs }) => {
          lastWinner = winner;
          runActive = false;
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
        next.emitter.on('squadLaunched', ({ size }) => {
          toastMessage = `Enemy squad launched (${size})`;
          if (typeof window !== 'undefined') {
            window.setTimeout(() => {
              toastMessage = null;
            }, 2500);
          }
        }),
      );

      const target = await whenMounted();
      await next.mount(target);
      rendererMode = next.getSpriteMode();
      next.start();
      runActive = true;
      lastWinner = null;

      if (typeof window !== 'undefined' && ai) {
        aiTickHandle = window.setInterval(() => {
          if (!engine || !ai) return;
          const ms = engine.getElapsedMs();
          elapsedMs = ms;
          hud.setElapsed(ms);
          ai.tick(ms);
        }, 200);
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
    cursorState = tile ? engine.getCursorStateForTile(tile) : 'default';
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
        const placed = engine.placeBuilding(PLAYER_FACTION_ID, buildingMode, tile);
        if (placed != null) {
          buildingMode = null;
          hud.setBuildingMode(null);
        }
      } else if (armedOrder) {
        engine.issueContextOrderAtTile(tile, armedOrder);
        armedOrder = null;
      } else {
        engine.handleClickAtTile(tile, event.shiftKey);
      }
    }
    dragStart = null;
    dragCurrent = null;
  }

  function handleContextMenu(event: MouseEvent): void {
    event.preventDefault();
    if (!engine) return;
    void engine.resumeAudio();
    const tile = engine.screenToTile(event.clientX, event.clientY);
    if (!tile) return;
    const targetEntity = engine.pickEntityAtTile(tile);
    if (targetEntity != null) {
      const selectionIds = engine.getSelection();
      if (selectionIds.length > 0) {
        engine.orderAttackTarget(targetEntity);
        return;
      }
    }
    engine.orderMoveSelectionTo(tile);
  }

  function toggleRendererMode(): void {
    if (!engine) return;
    rendererMode = engine.toggleSpriteMode();
  }

  function setMuted(nextMuted = !muted): void {
    muted = nextMuted;
    engine?.setAudioMuted(muted);
    hud.setMuted(muted);
  }

  function produceUnit(kind: UnitKind): void {
    engine?.enqueueProductionFromSelection(kind);
  }

  function placeBuilding(kind: BuildingKind): void {
    buildingMode = kind;
    armedOrder = null;
    hud.setBuildingMode(kind);
  }

  function cancelBuildingMode(): void {
    buildingMode = null;
    hud.setBuildingMode(null);
  }

  function armOrder(kind: 'patrol' | 'repair'): void {
    armedOrder = kind;
    buildingMode = null;
    hud.setBuildingMode(null);
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
    get view() { return view; },
    get hud() { return hud; },
    get generationParams() { return generationParams; },
    get lastGenerated() { return lastGenerated; },
    get mapgenError() { return mapgenError; },
    get toastMessage() { return toastMessage; },
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
    placeBuilding,
    cancelBuildingMode,
    armOrder,
    dispose,
  };
}

export type RtsPageModel = ReturnType<typeof createRtsPageModel>;
