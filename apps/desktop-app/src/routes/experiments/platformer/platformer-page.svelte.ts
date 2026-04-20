import type { Platformer as DomainPlatformer } from 'domain/shared';
import { Platformer } from 'ui/source';
import type { PlatformerTransport } from '$lib/adapters/platformer/PlatformerTransport';

type ResolvedMapEntry = DomainPlatformer.ResolvedMapEntry;
type RunResult = DomainPlatformer.RunResult;
type PowerUpKind = DomainPlatformer.PowerUpKind;

const {
  PlatformerEngine,
  KeyboardSource,
  createPlatformerHudModel,
  createPixiRendererFactory,
  PixiAudioBus,
  DEFAULT_BUNDLE,
} = Platformer;

const PLAYER_ID = 'local';

export interface PlatformerPageDeps {
  transport: PlatformerTransport;
}

export function createPlatformerPageModel({ transport }: PlatformerPageDeps) {
  let catalog = $state<ResolvedMapEntry[]>([]);
  let isLoading = $state(false);
  let errorMessage = $state<string | null>(null);
  let selectedMapId = $state<string | null>(null);
  let runActive = $state(false);
  let lastResult = $state<RunResult | null>(null);
  let paused = $state(false);

  const hud = createPlatformerHudModel();

  let engine: InstanceType<typeof PlatformerEngine> | null = null;
  let mountTarget: HTMLDivElement | null = null;
  let unsubs: Array<() => void> = [];
  let keyboard: ReturnType<typeof keyboardFactory> | null = null;

  function keyboardFactory() {
    if (typeof window === 'undefined') return null;
    return new KeyboardSource(window);
  }

  async function bootstrap() {
    if (isLoading) return;
    isLoading = true;
    errorMessage = null;
    try {
      const list = await transport.listMaps({ source: 'all', playerId: PLAYER_ID });
      catalog = list;
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Failed to load catalog';
    } finally {
      isLoading = false;
    }
  }

  function disposeEngine() {
    for (const unsub of unsubs) unsub();
    unsubs = [];
    engine?.dispose();
    engine = null;
    runActive = false;
    paused = false;
    hud.setPaused(false);
  }

  async function selectMap(id: string) {
    const entry = catalog.find((c) => c.id === id);
    if (!entry || !mountTarget) {
      selectedMapId = id;
      return;
    }
    selectedMapId = id;
    disposeEngine();
    const tileSize = entry.definition.tileSize;
    const viewportCols = 20;
    const viewportRows = entry.definition.size.rows;
    const next = new PlatformerEngine({
      mode: 'play',
      audio: typeof window !== 'undefined' ? new PixiAudioBus(DEFAULT_BUNDLE) : undefined,
      rendererFactory: createPixiRendererFactory({
        width: tileSize * viewportCols,
        height: tileSize * viewportRows,
      }),
    });
    engine = next;
    keyboard ??= keyboardFactory();
    if (keyboard) next.setInput(keyboard);
    next.loadMap(entry.definition);
    hud.reset({ worldLabel: entry.metadata.title });
    hud.setLives(next.getLives());
    hud.setScore(next.getScore());
    hud.setCoins(next.getCoins());
    hud.setTimeMs(next.getTimeRemainingMs());
    hud.setPower(next.getPlayerPower());

    unsubs.push(next.on('score', ({ total }) => hud.setScore(total)));
    unsubs.push(next.on('coin', ({ total }) => hud.setCoins(total)));
    unsubs.push(next.on('lifeLost', ({ lives }) => hud.setLives(lives)));
    unsubs.push(next.on('powerUp', ({ power }) => hud.setPower(power as PowerUpKind)));
    unsubs.push(next.on('runFinished', async (payload) => {
      const result: RunResult = {
        worldId: entry.id,
        levelId: entry.id,
        outcome: payload.outcome,
        score: payload.score,
        coins: payload.coins,
        timeMs: payload.timeMs,
        completedAt: new Date().toISOString(),
      };
      lastResult = result;
      runActive = false;
      try {
        await transport.recordRunResult({
          playerId: PLAYER_ID,
          result,
          profile: {
            lives: next.getLives(),
            score: next.getScore(),
            coins: next.getCoins(),
            power: next.getPlayerPower(),
          },
        });
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : 'Failed to record run';
      }
    }));

    await next.mount(mountTarget);
    next.start();
    runActive = true;
  }

  function setMountTarget(target: HTMLDivElement | null) {
    mountTarget = target;
  }

  function togglePause() {
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

  function dispose() {
    disposeEngine();
    keyboard?.dispose();
    keyboard = null;
  }

  return {
    get catalog() { return catalog; },
    get isLoading() { return isLoading; },
    get errorMessage() { return errorMessage; },
    get selectedMapId() { return selectedMapId; },
    get runActive() { return runActive; },
    get lastResult() { return lastResult; },
    get paused() { return paused; },
    get hud() { return hud; },
    bootstrap,
    selectMap,
    setMountTarget,
    togglePause,
    dispose,
  };
}

export type PlatformerPageModel = ReturnType<typeof createPlatformerPageModel>;
