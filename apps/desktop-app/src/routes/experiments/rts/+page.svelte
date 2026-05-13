<script lang="ts">
  import { onDestroy } from 'svelte';
  import { Button, Tooltip, Rts } from 'ui/source';
  import { createRtsPage } from './rts-page.composition.ts';

  const { Runtime, TECH_STATS } = Rts;
  const { RtsHud, MatchSetup, MapGenerationPanel, MapPreview, Minimap } = Runtime;

  const model = createRtsPage();
  const mission = $derived(model.mission);
  const combatReadout = $derived(model.combatReadout);
  const activeResearch = $derived(model.activeResearch);

  let canvas = $state<HTMLDivElement | undefined>(undefined);

  $effect(() => {
    if (canvas) model.setMountTarget(canvas);
  });

  function formatDuration(ms: number) {
    const total = Math.floor(ms / 1000);
    const minutes = Math.floor(total / 60).toString().padStart(2, '0');
    const seconds = (total % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  function handleKeyDown(event: KeyboardEvent) {
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
      return;
    }
    if (!model.runActive) return;
    if (!canvas || document.activeElement !== canvas) return;

    const key = event.key.toLowerCase();
    if (event.key === 'F1') {
      event.preventDefault();
      model.selectArmy();
      return;
    }
    if (event.key === 'F2') {
      event.preventDefault();
      model.selectProductionGroup('hq');
      return;
    }
    if (event.key === 'F3') {
      event.preventDefault();
      model.selectProductionGroup('barracks');
      return;
    }
    if (event.key === 'F4') {
      event.preventDefault();
      model.selectProductionGroup('factory');
      return;
    }
    if (/^[1-5]$/.test(key)) {
      event.preventDefault();
      const slot = Number(key);
      if (event.ctrlKey || event.metaKey) model.assignControlGroup(slot);
      else model.recallControlGroup(slot);
      return;
    }
    if (key === ' ') {
      event.preventDefault();
      model.togglePause();
      return;
    }
    if (key === 'escape') {
      event.preventDefault();
      model.cancelBuildingMode();
      return;
    }
    if (key === 'y') {
      event.preventDefault();
      model.toggleRendererMode();
    } else if (key === 'm') {
      event.preventDefault();
      model.setMuted();
    } else if (key === 'a') {
      event.preventDefault();
      model.armOrder('attackMove');
    } else if (key === 'q') {
      event.preventDefault();
      model.produceUnit('worker');
    } else if (key === 'w') {
      event.preventDefault();
      model.produceUnit('rifleman');
    } else if (key === 'c') {
      event.preventDefault();
      model.produceUnit('scout');
    } else if (key === 'v') {
      event.preventDefault();
      model.produceUnit('rocket');
    } else if (key === 'e') {
      event.preventDefault();
      model.placeBuilding('depot');
    } else if (key === 'f') {
      event.preventDefault();
      model.placeBuilding('refinery');
    } else if (key === 'r') {
      event.preventDefault();
      model.placeBuilding('turret');
    } else if (key === 's') {
      event.preventDefault();
      model.stopSelection();
    } else if (key === 'h') {
      event.preventDefault();
      model.holdSelection();
    } else if (key === 'p') {
      event.preventDefault();
      model.armOrder('patrol');
    } else if (key === 't') {
      event.preventDefault();
      model.armOrder('repair');
    } else if (key === 'g') {
      event.preventDefault();
      model.armOrder('rally');
    } else if (key === 'z') {
      event.preventDefault();
      model.researchTech('armorT1');
    } else if (key === 'x') {
      event.preventDefault();
      model.researchTech('armorT2');
    } else if (key === 'b') {
      event.preventDefault();
      model.researchTech('weaponT1');
    } else if (key === 'n') {
      event.preventDefault();
      model.researchTech('weaponT2');
    } else if (key === 'l') {
      event.preventDefault();
      model.researchTech('sightRange');
    }
  }

  onDestroy(() => model.dispose());
</script>

<svelte:window onkeydown={handleKeyDown} />

<svelte:head>
  <title>RTS Skirmish</title>
</svelte:head>

<Tooltip.Provider>
  <div class={`flex min-h-screen flex-col ${model.view === 'match' ? 'gap-4 px-4 py-4 xl:px-6' : 'mx-auto max-w-6xl gap-6 px-6 py-8'}`}>
    {#if model.view !== 'match'}
      <header class="flex items-baseline justify-between">
        <h1 class="text-foreground text-3xl font-semibold tracking-tight">RTS Skirmish</h1>
        <p class="text-muted-foreground text-sm">
          {#if model.view === 'mapgen'}
            Tweak the generator and preview a new map before saving it to your library.
          {:else}
            Pick a map and difficulty to start a skirmish against the AI.
          {/if}
        </p>
      </header>
    {/if}

    {#if model.errorMessage}
      <p
        class="rounded-2xl border border-red-300/60 bg-red-50 px-5 py-3 text-sm text-red-700"
        data-testid="rts-error"
      >
        {model.errorMessage}
      </p>
    {/if}

    {#if model.view === 'lobby'}
      <section class="grid gap-6 lg:grid-cols-[24rem_1fr]" data-testid="rts-lobby">
        <div class="flex flex-col gap-4">
          {#if model.isLoading && model.catalog.length === 0}
            <p class="text-muted-foreground text-sm">Loading map catalog…</p>
          {:else if model.catalog.length === 0}
            <p class="text-muted-foreground text-sm">No maps available yet.</p>
          {:else}
            <MatchSetup
              maps={model.catalog}
              onStart={(choice) => void model.startMatch(choice)}
              onGenerateMap={() => model.openMapGen()}
            />
          {/if}
          {#if model.lastWinner}
            <p class="text-muted-foreground text-sm" data-testid="rts-last-winner">
              Last match winner: <strong>{model.lastWinner}</strong>
            </p>
          {/if}
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {#each model.catalog as entry (entry.id)}
            <article class="border-border bg-background flex flex-col gap-2 rounded-xl border p-3">
              <header class="flex items-baseline justify-between gap-2">
                <span class="text-foreground font-medium">{entry.metadata.title}</span>
                <span class="text-muted-foreground text-xs uppercase">{entry.source}</span>
              </header>
              <MapPreview map={entry.definition} pixelsPerTile={4} />
              <p class="text-muted-foreground text-xs">
                {entry.definition.size.cols}×{entry.definition.size.rows} ·
                {entry.definition.spawns.length} spawns ·
                {entry.definition.resources.length} resources
              </p>
            </article>
          {/each}
        </div>
      </section>
    {:else if model.view === 'mapgen'}
      <section class="grid gap-6 lg:grid-cols-[24rem_1fr]" data-testid="rts-mapgen-view">
        <div class="flex flex-col gap-4">
          <MapGenerationPanel
            initialParams={model.generationParams}
            onGenerate={(params) => void model.generate(params)}
            onSave={(title, author) => void model.saveGenerated(title, author)}
            lastError={model.mapgenError}
          />
          <Button variant="outline" size="sm" onclick={() => model.closeMapGen()}>
            Back to lobby
          </Button>
        </div>

        <div class="border-border bg-background flex flex-col gap-2 rounded-xl border p-4">
          {#if model.lastGenerated}
            <h2 class="text-lg font-semibold">Preview</h2>
            <MapPreview map={model.lastGenerated.map} pixelsPerTile={6} />
            <p class="text-muted-foreground text-xs">
              Seed {model.lastGenerated.params.seed} ·
              {model.lastGenerated.map.size.cols}×{model.lastGenerated.map.size.rows} ·
              {model.lastGenerated.map.spawns.length} spawns
            </p>
          {:else}
            <p class="text-muted-foreground text-sm">Generate a map to see a preview.</p>
          {/if}
        </div>
      </section>
    {:else}
      <section class="rts-match-shell" data-testid="rts-stage">
        <div class="rts-macro-bar" data-testid="rts-macro-bar">
          <div class="rts-macro-row">
            <div class="space-y-2">
              <p class="rts-macro-kicker">In-match command</p>
              <div class="flex flex-wrap items-center gap-2">
                <h2 class="text-foreground text-2xl font-semibold tracking-tight">
                  {model.currentMap?.metadata.title ?? 'Live skirmish'}
                </h2>
                <span class="rts-pill" data-testid="rts-renderer-mode">{model.rendererMode} mode</span>
                {#if model.paused}
                  <span class="rts-pill">paused</span>
                {/if}
                {#if model.buildingMode}
                  <span class="rts-pill rts-pill-warn">placing {model.buildingMode}</span>
                {/if}
                {#if model.armedOrder}
                  <span class="rts-pill rts-pill-accent">order: {model.armedOrder}</span>
                {/if}
                {#if activeResearch}
                  <span class="rts-pill rts-pill-tech">
                    research: {TECH_STATS[activeResearch.kind].label} {Math.round(activeResearch.progress * 100)}%
                  </span>
                {/if}
              </div>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onclick={() => model.selectArmy()} data-testid="rts-select-army-button">
                Select army
              </Button>
              <Button variant="outline" size="sm" onclick={() => model.setMuted()} data-testid="rts-mute-toggle">
                {model.muted ? 'Unmute' : 'Mute'}
              </Button>
              <Button variant="outline" size="sm" onclick={() => model.togglePause()} disabled={!model.runActive}>
                {model.paused ? 'Resume' : 'Pause'}
              </Button>
              <Button variant="ghost" size="sm" onclick={() => model.leaveMatch()}>
                Leave match
              </Button>
            </div>
          </div>

          <div class="rts-mission-strip" data-testid="rts-mission-strip">
            <article class={`rts-mission-card is-${mission.tone}`} data-testid="rts-mission-objective">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="rts-mission-kicker">Mission</p>
                  <h3 class="mt-1 text-base font-semibold text-white">{mission.title}</h3>
                </div>
                <span class={`rts-mission-badge is-${mission.tone}`}>
                  {mission.status === 'active' ? 'Active' : mission.status === 'victory' ? 'Complete' : 'Failed'}
                </span>
              </div>
              <p class="mt-2 text-sm text-slate-100">{mission.objective}</p>
              <div class="rts-mission-summary">
                <strong>{mission.statusLabel}</strong>
                <span>{mission.statusDetail}</span>
              </div>
              <p class="mt-2 text-xs text-slate-300">{mission.directive}</p>
            </article>

            <article class={`rts-mission-card is-${mission.tone}`} data-testid="rts-wave-status">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="rts-mission-kicker">Enemy pressure</p>
                  <h3 class="mt-1 text-base font-semibold text-white">{mission.pressureLabel}</h3>
                </div>
                <div class="rts-mission-countdown">
                  <span>{mission.countdownLabel}</span>
                  <strong>{mission.countdownValue}</strong>
                </div>
              </div>
              <div class="rts-mission-metrics">
                <div class="rts-mission-metric">
                  <span>Wave status</span>
                  <strong>{mission.waveLabel}</strong>
                </div>
                <div class="rts-mission-metric">
                  <span>{mission.enemyForceLabel}</span>
                  <strong>{mission.enemyForceValue}</strong>
                </div>
              </div>
              <p class="mt-3 text-sm text-slate-100">{mission.pressureDetail}</p>
              <p class="mt-2 text-xs text-slate-300">{mission.waveDetail}</p>
            </article>
          </div>

          <div class="rts-macro-stats" data-testid="rts-match-macro-stats">
            <article class="rts-macro-stat">
              <span>Mineral</span>
              <strong>{model.hud.state.mineral}</strong>
            </article>
            <article class="rts-macro-stat">
              <span>Gas</span>
              <strong>{model.hud.state.gas}</strong>
            </article>
            <article class="rts-macro-stat">
              <span>Supply</span>
              <strong>{model.hud.state.supplyUsed} / {model.hud.state.supplyCap}</strong>
            </article>
            <article class="rts-macro-stat">
              <span>Time</span>
              <strong>{formatDuration(model.elapsedMs)}</strong>
            </article>
            <article class="rts-macro-stat">
              <span>Selection</span>
              <strong>{model.selectionSummary.count > 0 ? model.selectionSummary.label : 'No selection'}</strong>
            </article>
            <article class="rts-macro-stat">
              <span>Threat</span>
              <strong>{combatReadout.statusLabel}</strong>
            </article>
          </div>
        </div>

        <div class="rts-match-grid">
          <div class="min-w-0 flex flex-col gap-4">
            <div class="relative rts-stage-frame">
              {#if model.toasts.length > 0}
                <div class="absolute right-3 top-3 z-10 flex w-72 flex-col gap-2" data-testid="rts-toast-stack">
                  {#each model.toasts as toast (toast.id)}
                    <button
                      type="button"
                      class={`rts-toast rts-toast-${toast.tone}`}
                      data-testid="rts-toast"
                      onclick={() => model.dismissToast(toast.id)}
                    >
                      {toast.message}
                    </button>
                  {/each}
                </div>
              {/if}
              <div class="absolute left-3 top-3 z-10 flex flex-wrap gap-2">
                <div class="rts-overlay-chip" data-testid="rts-cursor">
                  cursor: {model.armedOrder ?? model.cursorState}{model.muted ? ' · audio muted' : ''}
                </div>
                <div class="rts-overlay-chip">
                  {model.selectionSummary.label}
                </div>
              </div>
              {#if model.armedOrder || model.buildingMode}
                <div class="rts-intent-card" data-testid="rts-intent-card">
                  <p class="text-xs font-semibold uppercase tracking-[0.12em] text-sky-100/80">Active intent</p>
                  <p class="mt-1 text-sm font-medium text-white">
                    {model.orderPreview?.label ?? (model.buildingMode ? `Place ${model.buildingMode}` : model.armedOrder)}
                  </p>
                  <p class="mt-1 text-xs text-slate-300">
                    {#if model.orderPreview}
                      {model.orderPreview.detail}
                    {:else if model.buildingMode}
                      Left-click a valid tile to build, or press Esc to cancel.
                    {:else if model.armedOrder === 'repair'}
                      Left-click a damaged friendly building.
                    {:else if model.armedOrder === 'rally'}
                      Left-click a destination tile for produced units, or right-click for a quick set.
                    {:else}
                      Left-click a target tile, or press Esc to cancel.
                    {/if}
                  </p>
                </div>
              {/if}
              {#if model.combatAlertHint && !model.matchOutcome}
                <div class={`rts-alert-card rts-alert-${model.combatAlertHint.severity}`} data-testid="rts-alert-card">
                  <div class="flex items-start justify-between gap-3">
                    <p class="text-xs font-semibold uppercase tracking-[0.12em] text-white/75">Combat radar</p>
                    <span class={`rts-alert-badge is-${combatReadout.tone}`}>{combatReadout.statusLabel}</span>
                  </div>
                  <p class="mt-1 text-sm font-medium text-white">{model.combatAlertHint.title}</p>
                  <p class="mt-1 text-xs text-slate-200">{model.combatAlertHint.detail}</p>
                  <p class="mt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/70">
                    {combatReadout.directionLabel}
                  </p>
                </div>
              {/if}
              {#if model.edgeAlertMarkers.length > 0 && !model.matchOutcome}
                <div class="rts-edge-alerts" data-testid="rts-edge-alerts">
                  {#each model.edgeAlertMarkers as marker (marker.id)}
                    <div
                      class={`rts-edge-alert rts-edge-alert-${marker.severity} is-${marker.side}`}
                      style:left={marker.side === 'top' || marker.side === 'bottom' ? `${marker.offsetPercent}%` : undefined}
                      style:top={marker.side === 'left' || marker.side === 'right' ? `${marker.offsetPercent}%` : undefined}
                      aria-label={marker.label}
                    ></div>
                  {/each}
                </div>
              {/if}
              {#if model.orderPreview && !model.matchOutcome}
                <svg class="rts-order-preview" viewBox="0 0 960 540" preserveAspectRatio="none" data-testid="rts-order-preview">
                  {#if model.orderPreview.from}
                    <line
                      x1={model.orderPreview.from.x}
                      y1={model.orderPreview.from.y}
                      x2={model.orderPreview.to.x}
                      y2={model.orderPreview.to.y}
                      class={`rts-preview-line is-${model.orderPreview.mode}`}
                    />
                  {/if}
                  <circle
                    cx={model.orderPreview.to.x}
                    cy={model.orderPreview.to.y}
                    r="9"
                    class={`rts-preview-target is-${model.orderPreview.mode}`}
                  />
                </svg>
                <div class="rts-preview-label" data-testid="rts-order-preview-label">
                  {model.orderPreview.label}
                </div>
              {/if}
              {#if model.matchOutcome}
                <div class="rts-endgame" data-testid="rts-endgame">
                  <div class="rts-endgame-card">
                    <span class={`rts-endgame-badge ${mission.status === 'victory' ? 'is-victory' : 'is-defeat'}`}>
                      {mission.status === 'victory' ? 'Mission Complete' : 'Mission Failed'}
                    </span>
                    <h3 class="mt-3 text-3xl font-semibold">{mission.status === 'victory' ? 'Victory' : 'Defeat'}</h3>
                    <p class="mt-2 text-sm text-slate-100">{mission.objective}</p>
                    <p class="mt-2 text-xs text-slate-300">{mission.pressureDetail}</p>
                    <div class="mt-4 grid grid-cols-2 gap-2 text-left sm:grid-cols-3">
                      <div class="rts-endgame-stat">
                        <strong>{formatDuration(model.matchOutcome.durationMs)}</strong>
                        <small>Duration</small>
                      </div>
                      <div class="rts-endgame-stat">
                        <strong>{model.matchOutcome.stats.mineralMined}</strong>
                        <small>Minerals mined</small>
                      </div>
                      <div class="rts-endgame-stat">
                        <strong>{model.matchOutcome.stats.gasMined}</strong>
                        <small>Gas mined</small>
                      </div>
                      <div class="rts-endgame-stat">
                        <strong>{model.matchOutcome.stats.enemyLosses}</strong>
                        <small>Enemy losses</small>
                      </div>
                      <div class="rts-endgame-stat">
                        <strong>{model.matchOutcome.stats.friendlyLosses}</strong>
                        <small>Friendly losses</small>
                      </div>
                      <div class="rts-endgame-stat">
                        <strong>{model.matchOutcome.stats.unitsCompleted + model.matchOutcome.stats.structuresCompleted}</strong>
                        <small>Completed</small>
                      </div>
                    </div>
                    <p class="text-muted-foreground mt-3 text-xs">{model.matchOutcome.mapTitle} · {model.rendererMode} mode</p>
                    <div class="mt-5 flex items-center justify-center gap-2">
                      <Button variant="outline" size="sm" onclick={() => void model.restartMatch()}>
                        Play again
                      </Button>
                      <Button variant="ghost" size="sm" onclick={() => model.leaveMatch()}>
                        Back to lobby
                      </Button>
                    </div>
                  </div>
                </div>
              {/if}
              <div
                bind:this={canvas}
                class="rts-canvas-host border-border bg-background relative flex aspect-[16/9] w-full touch-none select-none items-center justify-center overflow-hidden rounded-2xl border"
                data-testid="rts-canvas"
                role="application"
                tabindex="-1"
                onpointerdown={(event) => {
                  (event.currentTarget as HTMLDivElement).focus();
                  model.handlePointerDown(event);
                }}
                onpointermove={(event) => model.handlePointerMove(event)}
                onpointerup={(event) => model.handlePointerUp(event)}
                oncontextmenu={(event) => model.handleContextMenu(event)}
              ></div>
            </div>
          </div>

          <aside class="rts-support-rail" data-testid="rts-support-rail">
            {#if model.currentMap}
              <section class="border-border bg-background rounded-2xl border p-3" data-testid="rts-minimap-panel">
                <div class="mb-2 flex items-center justify-between gap-2">
                  <h3 class="text-sm font-semibold">Minimap</h3>
                  <span class="text-muted-foreground text-[11px] uppercase tracking-[0.12em]">jump</span>
                </div>
                <Minimap
                  map={model.currentMap}
                  fog={model.fogSnapshot ?? undefined}
                  cameraTile={model.cameraTile}
                  viewport={model.viewportBounds}
                  blips={model.minimapBlips}
                  pings={model.combatPings}
                  onJump={(tile) => model.jumpCamera(tile)}
                  pixelsPerTile={4}
                />
              </section>
            {/if}

            <section class="border-border bg-background rounded-2xl border p-3" data-testid="rts-selection-panel">
              <div class="mb-2 flex items-center justify-between gap-2">
                <h3 class="text-sm font-semibold">Selection</h3>
                <span class="text-muted-foreground text-xs">{model.selectionSummary.count} active</span>
              </div>
              <p class="text-sm font-medium">{model.selectionSummary.label}</p>
              <p class="text-muted-foreground mt-1 text-xs">{model.selectionSummary.detail}</p>
              {#if model.selectedRallyPoint}
                <p class="mt-2 text-xs text-sky-300" data-testid="rts-rally-summary">
                  Rally: {model.selectedRallyPoint.tile.col},{model.selectedRallyPoint.tile.row} · {model.selectedRallyPoint.producerCount} structure{model.selectedRallyPoint.producerCount === 1 ? '' : 's'}
                </p>
              {/if}
              {#if model.selectionSummary.averageHpRatio != null}
                <div class="mt-3 h-2 overflow-hidden rounded-full bg-slate-800/80">
                  <div
                    class="h-full rounded-full bg-emerald-400 transition-[width]"
                    style:width="{Math.max(0, Math.min(100, model.selectionSummary.averageHpRatio * 100))}%"
                  ></div>
                </div>
              {/if}
              {#if model.selectionSummary.composition.length > 0}
                <div class="mt-3 grid grid-cols-2 gap-2">
                  {#each model.selectionSummary.composition as entry}
                    <article class="rts-selection-card">
                      <strong>{entry.count}x {entry.kind}</strong>
                      <small>{entry.category}</small>
                    </article>
                  {/each}
                </div>
              {/if}
            </section>

            <section class="border-border bg-background rounded-2xl border p-3" data-testid="rts-control-groups">
              <div class="mb-2 flex items-center justify-between gap-2">
                <h3 class="text-sm font-semibold">Control Groups</h3>
                <span class="text-muted-foreground text-xs">Ctrl+1-5</span>
              </div>
              <div class="grid grid-cols-1 gap-2">
                {#each model.controlGroups as group (group.slot)}
                  <button
                    type="button"
                    class="rts-control-group"
                    data-testid={`rts-control-group-${group.slot}`}
                    onclick={() => model.recallControlGroup(group.slot)}
                  >
                    <span class="rts-control-slot">{group.slot}</span>
                    <span class="rts-control-copy">
                      <strong>{group.label}</strong>
                      <small>{group.count > 0 ? `${group.count} units` : 'Empty'}</small>
                    </span>
                  </button>
                {/each}
              </div>
            </section>

            <section class="border-border bg-background rounded-2xl border p-3" data-testid="rts-production-groups">
              <div class="mb-2 flex items-center justify-between gap-2">
                <h3 class="text-sm font-semibold">Production Groups</h3>
                <span class="text-muted-foreground text-xs">F2-F4</span>
              </div>
              <div class="grid grid-cols-1 gap-2">
                {#each model.productionStructureGroups as group (group.kind)}
                  <button
                    type="button"
                    class={`rts-production-group ${group.selectedCount > 0 ? 'is-active' : ''}`}
                    data-testid={`rts-production-group-${group.kind}`}
                    onclick={() => model.selectProductionGroup(group.kind)}
                  >
                    <span class="rts-production-copy">
                      <strong>{group.kind}</strong>
                      <small>{group.readyCount}/{group.totalCount} ready · {group.queueCount} queued</small>
                    </span>
                    <span class="rts-production-meta">{group.selectedCount > 0 ? `${group.selectedCount} selected` : 'idle'}</span>
                  </button>
                {/each}
              </div>
            </section>

            <section class="border-border bg-background rounded-2xl border p-3" data-testid="rts-queue-panel">
              <div class="mb-2 flex items-center justify-between gap-2">
                <h3 class="text-sm font-semibold">Production Queue</h3>
                <span class="text-muted-foreground text-xs">{model.productionQueue.length} items</span>
              </div>
              {#if model.productionQueueGroups.length === 0}
                <p class="text-muted-foreground text-sm">No active production.</p>
              {:else}
                <div class="flex flex-col gap-2">
                  {#each model.productionQueueGroups as group (group.producerId)}
                    <article
                      class={`rts-queue-card ${group.selected ? 'is-active' : ''}`}
                      data-testid={`rts-queue-group-${group.producerId}`}
                    >
                      <div class="flex items-center justify-between gap-2 text-xs">
                        <span class="font-medium">{group.producerKind} #{group.producerId}</span>
                        <span class="text-muted-foreground">{group.itemCount} item{group.itemCount === 1 ? '' : 's'}</span>
                      </div>
                      <div class="mt-2 flex flex-col gap-2">
                        {#each group.items as entry, index (`${group.producerId}-${entry.kind}-${index}`)}
                          <div>
                            <div class="flex items-center justify-between gap-2 text-[11px]">
                              <span>{index === 0 ? 'Building' : 'Queued'} {entry.kind}</span>
                              <span class="text-muted-foreground">{Math.round(entry.progress * 100)}%</span>
                            </div>
                            <div class="mt-1 h-2 overflow-hidden rounded-full bg-slate-800/80">
                              <div class="h-full rounded-full bg-sky-400" style:width="{Math.max(0, Math.min(100, entry.progress * 100))}%"></div>
                            </div>
                          </div>
                        {/each}
                      </div>
                      <div class="mt-3 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          class="rts-queue-action"
                          data-testid={`rts-focus-producer-${group.producerId}`}
                          onclick={() => model.focusProducer(group.producerId)}
                        >
                          Focus
                        </button>
                        <button
                          type="button"
                          class="rts-queue-action is-danger"
                          data-testid={`rts-cancel-producer-${group.producerId}`}
                          onclick={() => model.cancelProducerQueueItem(group.producerId)}
                        >
                          Cancel Last
                        </button>
                      </div>
                    </article>
                  {/each}
                </div>
              {/if}
            </section>

            <section class="border-border bg-background rounded-2xl border p-3" data-testid="rts-combat-summary">
              <div class="mb-3 flex items-center justify-between gap-2">
                <h3 class="text-sm font-semibold">Battlefield</h3>
                <span class={`rts-readout-badge is-${combatReadout.tone}`}>{combatReadout.statusLabel}</span>
              </div>
              <p class="text-sm font-semibold text-white">{combatReadout.headline}</p>
              <p class="text-muted-foreground mt-1 text-xs">{combatReadout.detail}</p>
              <div class="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div class="rts-summary-stat">
                  <strong>{combatReadout.contactLabel}</strong>
                  <small>Contact</small>
                </div>
                <div class="rts-summary-stat">
                  <strong>{combatReadout.enemyForceLabel}</strong>
                  <small>Enemy fielded</small>
                </div>
                <div class="rts-summary-stat">
                  <strong>{combatReadout.directionLabel}</strong>
                  <small>Hotspot</small>
                </div>
                <div class="rts-summary-stat">
                  <strong>{combatReadout.timerValue}</strong>
                  <small>{combatReadout.timerLabel}</small>
                </div>
              </div>
              <p class="text-muted-foreground mt-2 text-xs">{combatReadout.directionDetail}</p>
              {#if model.combatAlertHint && !model.matchOutcome}
                <Button class="mt-3 w-full" variant="outline" size="sm" onclick={() => model.jumpCamera(model.combatAlertHint!.tile)}>
                  Jump to contact
                </Button>
              {/if}
              <div class="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div class="rts-summary-stat">
                  <strong>{model.matchStats.enemyLosses}</strong>
                  <small>Enemy losses</small>
                </div>
                <div class="rts-summary-stat">
                  <strong>{model.matchStats.friendlyLosses}</strong>
                  <small>Friendly losses</small>
                </div>
                <div class="rts-summary-stat">
                  <strong>{model.matchStats.unitsCompleted}</strong>
                  <small>Units complete</small>
                </div>
                <div class="rts-summary-stat">
                  <strong>{model.matchStats.structuresCompleted}</strong>
                  <small>Structures online</small>
                </div>
              </div>
            </section>

            <section class="border-border bg-background rounded-2xl border p-3" data-testid="rts-event-feed">
              <div class="mb-3 flex items-center justify-between gap-2">
                <h3 class="text-sm font-semibold">Feed</h3>
                <span class="text-muted-foreground text-[11px] uppercase tracking-[0.12em]">latest 8</span>
              </div>
              {#if model.eventFeed.length === 0}
                <p class="text-muted-foreground text-sm">No reports yet.</p>
              {:else}
                <div class="flex max-h-80 flex-col gap-2 overflow-auto pr-1">
                  {#each model.eventFeed as item (item.id)}
                    <article class={`rts-feed-item rts-feed-${item.tone}`}>
                      <p class="text-sm font-medium">{item.title}</p>
                      <p class="text-muted-foreground text-xs">{item.detail}</p>
                    </article>
                  {/each}
                </div>
              {/if}
            </section>
          </aside>
        </div>

        <div class="rts-bottom-dock" data-testid="rts-bottom-dock">
          <section class="rts-command-dock" data-testid="rts-command-dock">
            <div class="rts-command-dock-header">
              <div>
                <h3 class="text-sm font-semibold">Command Deck</h3>
                <p class="text-muted-foreground text-xs">Context and hotkeys stay visible here.</p>
              </div>
              <p class="rts-license-note">
                Assets: <code>/rts/towerDefense/License.txt</code>
              </p>
            </div>
            <RtsHud
              model={model.hud}
              productionOptions={model.productionOptions}
              researchOptions={model.researchOptions}
              completedResearch={model.researchState.researched}
              combatReadout={combatReadout}
              intentPreview={model.orderPreview ? { label: model.orderPreview.label, detail: model.orderPreview.detail } : null}
              onProduceUnit={(kind) => model.produceUnit(kind)}
              onResearch={(kind) => model.researchTech(kind)}
              onPlaceBuilding={(kind) => model.placeBuilding(kind)}
              onCancelBuilding={() => model.cancelBuildingMode()}
              onOrder={(kind) => model.armOrder(kind)}
              onStopSelection={() => model.stopSelection()}
              onHoldSelection={() => model.holdSelection()}
              onSelectArmy={() => model.selectArmy()}
            />
          </section>
        </div>

        {#if model.dragRect}
          <div
            class="pointer-events-none fixed border-2 border-sky-300/80 bg-sky-300/10"
            style:left="{model.dragRect.x}px"
            style:top="{model.dragRect.y}px"
            style:width="{model.dragRect.width}px"
            style:height="{model.dragRect.height}px"
          ></div>
        {/if}
      </section>
    {/if}

    {#if model.view !== 'match'}
      <p class="text-muted-foreground text-xs">
        Sprites use Kenney Tower Defense assets (CC0), bundled with the app under
        <code>/rts/towerDefense/License.txt</code>. Press <kbd>Y</kbd> to toggle sprite/vector mode.
      </p>
    {/if}
  </div>
</Tooltip.Provider>

<style>
  :global(.rts-canvas-host canvas) {
    image-rendering: pixelated;
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }
  .rts-match-shell {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .rts-macro-bar,
  .rts-stage-frame,
  .rts-bottom-dock {
    border-radius: 1.5rem;
    border: 1px solid rgba(148, 163, 184, 0.18);
    background: linear-gradient(180deg, rgba(8, 15, 28, 0.94), rgba(2, 6, 23, 0.96));
    box-shadow: 0 18px 42px rgba(2, 6, 23, 0.28);
  }
  .rts-macro-bar {
    padding: 1rem 1.1rem;
  }
  .rts-macro-row {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.9rem;
  }
  .rts-macro-kicker {
    color: rgb(125, 211, 252);
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }
  .rts-mission-strip {
    margin-top: 0.9rem;
    display: grid;
    gap: 0.75rem;
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  }
  .rts-mission-card {
    min-width: 0;
    border-radius: 1.1rem;
    border: 1px solid rgba(148, 163, 184, 0.18);
    background: linear-gradient(180deg, rgba(15, 23, 42, 0.68), rgba(2, 6, 23, 0.58));
    padding: 0.85rem 0.95rem;
  }
  .rts-mission-card.is-calm {
    border-color: rgba(56, 189, 248, 0.18);
  }
  .rts-mission-card.is-warning {
    border-color: rgba(250, 204, 21, 0.26);
  }
  .rts-mission-card.is-danger,
  .rts-mission-card.is-failure {
    border-color: rgba(248, 113, 113, 0.28);
  }
  .rts-mission-card.is-success {
    border-color: rgba(74, 222, 128, 0.26);
  }
  .rts-mission-kicker {
    color: rgb(148, 163, 184);
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .rts-mission-badge {
    display: inline-flex;
    align-items: center;
    border-radius: 9999px;
    border: 1px solid rgba(148, 163, 184, 0.28);
    padding: 0.25rem 0.65rem;
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .rts-mission-badge.is-calm {
    color: rgb(186, 230, 253);
  }
  .rts-mission-badge.is-warning {
    color: rgb(253, 230, 138);
  }
  .rts-mission-badge.is-danger,
  .rts-mission-badge.is-failure {
    color: rgb(254, 202, 202);
  }
  .rts-mission-badge.is-success {
    color: rgb(187, 247, 208);
  }
  .rts-mission-summary {
    margin-top: 0.7rem;
    display: grid;
    gap: 0.15rem;
  }
  .rts-mission-summary strong {
    color: white;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .rts-mission-summary span {
    color: rgb(148, 163, 184);
    font-size: 0.74rem;
    line-height: 1.4;
  }
  .rts-mission-countdown {
    display: inline-grid;
    justify-items: end;
    border-radius: 0.95rem;
    border: 1px solid rgba(148, 163, 184, 0.22);
    background: rgba(15, 23, 42, 0.58);
    padding: 0.45rem 0.7rem;
    text-align: right;
  }
  .rts-mission-countdown span {
    color: rgb(148, 163, 184);
    font-size: 0.64rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .rts-mission-countdown strong {
    color: white;
    font-size: 0.95rem;
    line-height: 1.2;
  }
  .rts-mission-metrics {
    margin-top: 0.75rem;
    display: grid;
    gap: 0.6rem;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .rts-mission-metric {
    min-width: 0;
    border-radius: 0.9rem;
    border: 1px solid rgba(148, 163, 184, 0.14);
    background: rgba(15, 23, 42, 0.48);
    padding: 0.65rem 0.75rem;
  }
  .rts-mission-metric span {
    display: block;
    color: rgb(148, 163, 184);
    font-size: 0.66rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .rts-mission-metric strong {
    display: block;
    margin-top: 0.2rem;
    overflow: hidden;
    color: white;
    font-size: 0.88rem;
    line-height: 1.3;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .rts-macro-stats {
    margin-top: 0.9rem;
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 0.75rem;
  }
  .rts-macro-stat {
    min-width: 0;
    border-radius: 1rem;
    border: 1px solid rgba(148, 163, 184, 0.14);
    background: rgba(15, 23, 42, 0.55);
    padding: 0.7rem 0.8rem;
  }
  .rts-macro-stat span {
    display: block;
    color: rgb(148, 163, 184);
    font-size: 0.68rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .rts-macro-stat strong {
    display: block;
    margin-top: 0.2rem;
    overflow: hidden;
    color: white;
    font-size: 0.95rem;
    line-height: 1.25;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .rts-match-grid {
    display: grid;
    gap: 1rem;
    grid-template-columns: minmax(0, 1fr) 16rem;
    align-items: start;
  }
  .rts-support-rail {
    display: grid;
    gap: 0.75rem;
    align-content: start;
  }
  .rts-stage-frame {
    padding: 0.5rem;
  }
  .rts-bottom-dock {
    padding: 0.8rem;
  }
  .rts-dock-layout {
    display: grid;
    gap: 0.75rem;
    grid-template-columns: minmax(18rem, 24rem) minmax(18rem, 24rem) minmax(0, 1fr);
    align-items: start;
  }
  .rts-dock-stack {
    display: grid;
    gap: 0.75rem;
  }
  .rts-command-dock {
    border-radius: 1.25rem;
    border: 1px solid rgba(148, 163, 184, 0.18);
    background: rgba(15, 23, 42, 0.62);
    padding: 0.85rem;
  }
  .rts-command-dock-header {
    margin-bottom: 0.75rem;
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
  }
  .rts-license-note {
    color: rgb(148, 163, 184);
    font-size: 0.72rem;
  }
  .rts-command-dock :global(.rts-hud) {
    gap: 0.75rem;
    border-radius: 1rem;
    border: 1px solid rgba(148, 163, 184, 0.14);
    background: rgba(2, 6, 23, 0.42);
    padding: 0.85rem;
  }
  .rts-command-dock :global(.rts-hud .row.top) {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  .rts-command-dock :global(.rts-hud .row.bottom) {
    display: grid;
    gap: 0.75rem;
  }
  .rts-command-dock :global(.rts-hud .group) {
    gap: 0.45rem;
  }
  .rts-command-dock :global(.rts-hud button) {
    border-radius: 0.7rem;
  }
  .rts-canvas-host {
    cursor: none;
  }
  @media (max-width: 1279px) {
    .rts-mission-strip,
    .rts-macro-stats {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .rts-match-grid {
      grid-template-columns: minmax(0, 1fr);
    }
    .rts-support-rail {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .rts-dock-layout {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .rts-command-dock {
      grid-column: 1 / -1;
    }
  }
  @media (max-width: 767px) {
    .rts-mission-strip,
    .rts-macro-stats,
    .rts-support-rail,
    .rts-dock-layout,
    .rts-command-dock :global(.rts-hud .row.top) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @media (max-width: 639px) {
    .rts-mission-strip,
    .rts-macro-stats,
    .rts-support-rail,
    .rts-dock-layout,
    .rts-command-dock :global(.rts-hud .row.top) {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .rts-pill {
    border-radius: 9999px;
    border: 1px solid rgba(148, 163, 184, 0.35);
    background: rgba(15, 23, 42, 0.72);
    color: rgb(226, 232, 240);
    padding: 0.2rem 0.55rem;
    font-size: 0.75rem;
    line-height: 1.2;
  }
  .rts-pill-accent {
    border-color: rgba(56, 189, 248, 0.5);
    color: rgb(186, 230, 253);
  }
  .rts-pill-tech {
    border-color: rgba(192, 132, 252, 0.45);
    color: rgb(233, 213, 255);
  }
  .rts-pill-warn {
    border-color: rgba(251, 191, 36, 0.45);
    color: rgb(253, 230, 138);
  }
  .rts-overlay-chip {
    pointer-events: none;
    border-radius: 9999px;
    border: 1px solid rgba(255, 255, 255, 0.25);
    background: rgba(10, 20, 30, 0.78);
    color: white;
    padding: 0.2rem 0.55rem;
    font-size: 0.75rem;
  }
  .rts-intent-card {
    position: absolute;
    left: 0.75rem;
    bottom: 0.75rem;
    z-index: 12;
    width: min(19rem, calc(100% - 1.5rem));
    border-radius: 1rem;
    border: 1px solid rgba(56, 189, 248, 0.28);
    background: rgba(15, 23, 42, 0.9);
    padding: 0.8rem 0.9rem;
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.3);
  }
  .rts-alert-card {
    position: absolute;
    right: 0.75rem;
    bottom: 0.75rem;
    z-index: 12;
    width: min(17rem, calc(100% - 1.5rem));
    border-radius: 1rem;
    border: 1px solid rgba(250, 204, 21, 0.28);
    background: rgba(15, 23, 42, 0.88);
    padding: 0.8rem 0.9rem;
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.28);
  }
  .rts-order-preview {
    position: absolute;
    inset: 0;
    z-index: 10;
    pointer-events: none;
  }
  .rts-preview-line {
    stroke: rgba(125, 211, 252, 0.95);
    stroke-width: 3;
  }
  .rts-preview-line.is-patrol {
    stroke: rgba(51, 215, 255, 0.95);
    stroke-dasharray: 10 6;
  }
  .rts-preview-line.is-repair {
    stroke: rgba(156, 255, 87, 0.95);
    stroke-dasharray: 5 5;
  }
  .rts-preview-line.is-attackMove {
    stroke: rgba(248, 113, 113, 0.95);
  }
  .rts-preview-line.is-rally {
    stroke: rgba(192, 132, 252, 0.95);
    stroke-dasharray: 8 4;
  }
  .rts-preview-target {
    fill: rgba(255, 255, 255, 0.16);
    stroke: rgba(125, 211, 252, 0.95);
    stroke-width: 3;
  }
  .rts-preview-target.is-build {
    stroke: rgba(250, 204, 21, 0.95);
  }
  .rts-preview-target.is-patrol {
    stroke: rgba(51, 215, 255, 0.95);
  }
  .rts-preview-target.is-repair {
    stroke: rgba(156, 255, 87, 0.95);
  }
  .rts-preview-target.is-attackMove {
    stroke: rgba(248, 113, 113, 0.95);
  }
  .rts-preview-target.is-rally {
    stroke: rgba(192, 132, 252, 0.95);
  }
  .rts-preview-label {
    position: absolute;
    left: 50%;
    bottom: 0.85rem;
    z-index: 12;
    transform: translateX(-50%);
    border-radius: 9999px;
    background: rgba(15, 23, 42, 0.88);
    border: 1px solid rgba(148, 163, 184, 0.24);
    color: white;
    padding: 0.3rem 0.7rem;
    font-size: 0.75rem;
  }
  .rts-edge-alerts {
    position: absolute;
    inset: 0;
    z-index: 11;
    pointer-events: none;
  }
  .rts-edge-alert {
    position: absolute;
    width: 0;
    height: 0;
    filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.4));
    transform: translate(-50%, -50%);
  }
  .rts-edge-alert.is-top {
    top: 0.65rem;
    border-left: 0.55rem solid transparent;
    border-right: 0.55rem solid transparent;
    border-top: 0;
    border-bottom: 0.95rem solid rgba(250, 204, 21, 0.95);
  }
  .rts-edge-alert.is-bottom {
    bottom: 0.65rem;
    border-left: 0.55rem solid transparent;
    border-right: 0.55rem solid transparent;
    border-top: 0.95rem solid rgba(250, 204, 21, 0.95);
    border-bottom: 0;
  }
  .rts-edge-alert.is-left {
    left: 0.65rem;
    border-top: 0.55rem solid transparent;
    border-bottom: 0.55rem solid transparent;
    border-left: 0;
    border-right: 0.95rem solid rgba(250, 204, 21, 0.95);
  }
  .rts-edge-alert.is-right {
    right: 0.65rem;
    border-top: 0.55rem solid transparent;
    border-bottom: 0.55rem solid transparent;
    border-left: 0.95rem solid rgba(250, 204, 21, 0.95);
    border-right: 0;
  }
  .rts-edge-alert-danger.is-top {
    border-bottom-color: rgba(248, 113, 113, 0.96);
  }
  .rts-edge-alert-danger.is-bottom {
    border-top-color: rgba(248, 113, 113, 0.96);
  }
  .rts-edge-alert-danger.is-left {
    border-right-color: rgba(248, 113, 113, 0.96);
  }
  .rts-edge-alert-danger.is-right {
    border-left-color: rgba(248, 113, 113, 0.96);
  }
  .rts-alert-danger {
    border-color: rgba(248, 113, 113, 0.32);
  }
  .rts-alert-warning {
    border-color: rgba(250, 204, 21, 0.28);
  }
  .rts-alert-badge,
  .rts-readout-badge {
    display: inline-flex;
    align-items: center;
    border-radius: 9999px;
    border: 1px solid rgba(148, 163, 184, 0.28);
    padding: 0.2rem 0.55rem;
    font-size: 0.64rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .rts-alert-badge.is-danger,
  .rts-readout-badge.is-danger,
  .rts-alert-badge.is-failure,
  .rts-readout-badge.is-failure {
    border-color: rgba(248, 113, 113, 0.34);
    color: rgb(254, 202, 202);
  }
  .rts-alert-badge.is-warning,
  .rts-readout-badge.is-warning {
    border-color: rgba(250, 204, 21, 0.34);
    color: rgb(253, 230, 138);
  }
  .rts-alert-badge.is-success,
  .rts-readout-badge.is-success {
    border-color: rgba(74, 222, 128, 0.32);
    color: rgb(187, 247, 208);
  }
  .rts-alert-badge.is-calm,
  .rts-readout-badge.is-calm {
    border-color: rgba(56, 189, 248, 0.28);
    color: rgb(186, 230, 253);
  }
  .rts-toast {
    border-radius: 0.9rem;
    border: 1px solid rgba(148, 163, 184, 0.24);
    background: rgba(15, 23, 42, 0.92);
    color: white;
    padding: 0.7rem 0.85rem;
    text-align: left;
    font-size: 0.8rem;
    box-shadow: 0 16px 32px rgba(0, 0, 0, 0.28);
  }
  .rts-toast-info {
    border-color: rgba(56, 189, 248, 0.28);
  }
  .rts-toast-success {
    border-color: rgba(74, 222, 128, 0.28);
  }
  .rts-toast-warning {
    border-color: rgba(251, 191, 36, 0.3);
  }
  .rts-endgame {
    position: absolute;
    inset: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(2, 6, 14, 0.72);
    backdrop-filter: blur(6px);
  }
  .rts-endgame-card {
    width: min(28rem, calc(100% - 2rem));
    border-radius: 1.5rem;
    border: 1px solid rgba(148, 163, 184, 0.25);
    background: linear-gradient(180deg, rgba(15, 23, 42, 0.95), rgba(2, 6, 23, 0.92));
    padding: 1.5rem;
    text-align: center;
  }
  .rts-endgame-badge {
    display: inline-flex;
    border-radius: 9999px;
    border: 1px solid rgba(148, 163, 184, 0.3);
    padding: 0.35rem 0.8rem;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .rts-endgame-badge.is-victory {
    border-color: rgba(74, 222, 128, 0.35);
    color: rgb(187, 247, 208);
  }
  .rts-endgame-badge.is-defeat {
    border-color: rgba(248, 113, 113, 0.35);
    color: rgb(254, 202, 202);
  }
  .rts-endgame-stat {
    border-radius: 0.9rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(15, 23, 42, 0.48);
    padding: 0.75rem;
  }
  .rts-endgame-stat strong {
    display: block;
    font-size: 1rem;
  }
  .rts-endgame-stat small {
    color: rgb(148, 163, 184);
    font-size: 0.72rem;
    text-transform: uppercase;
  }
  .rts-selection-card,
  .rts-summary-stat,
  .rts-production-group,
  .rts-queue-card {
    border-radius: 0.9rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(15, 23, 42, 0.48);
    padding: 0.7rem 0.75rem;
  }
  .rts-selection-card strong,
  .rts-summary-stat strong {
    display: block;
    font-size: 1rem;
    color: white;
  }
  .rts-selection-card small,
  .rts-summary-stat small {
    color: rgb(148, 163, 184);
    font-size: 0.72rem;
    text-transform: uppercase;
  }
  .rts-production-group,
  .rts-queue-card {
    width: 100%;
    text-align: left;
    appearance: none;
    transition: border-color 120ms ease, background 120ms ease;
  }
  .rts-queue-action {
    border-radius: 0.65rem;
    border: 1px solid rgba(148, 163, 184, 0.2);
    background: rgba(30, 41, 59, 0.72);
    color: white;
    padding: 0.35rem 0.65rem;
    font-size: 0.72rem;
    line-height: 1;
  }
  .rts-queue-action.is-danger {
    border-color: rgba(248, 113, 113, 0.3);
    color: rgb(254, 202, 202);
  }
  .rts-production-group:hover,
  .rts-queue-card:hover {
    border-color: rgba(125, 211, 252, 0.35);
    background: rgba(15, 23, 42, 0.72);
  }
  .rts-production-group.is-active,
  .rts-queue-card.is-active {
    border-color: rgba(125, 211, 252, 0.5);
    box-shadow: inset 0 0 0 1px rgba(125, 211, 252, 0.12);
  }
  .rts-production-group {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }
  .rts-production-copy {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 0.05rem;
  }
  .rts-production-copy strong {
    color: white;
    font-size: 0.82rem;
    text-transform: capitalize;
  }
  .rts-production-copy small,
  .rts-production-meta {
    color: rgb(148, 163, 184);
    font-size: 0.72rem;
  }
  .rts-control-group {
    width: 100%;
    justify-content: flex-start;
    border-radius: 0.85rem;
    background: rgba(15, 23, 42, 0.62);
    padding: 0.55rem 0.65rem;
  }
  .rts-control-slot {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.7rem;
    height: 1.7rem;
    border-radius: 9999px;
    background: rgba(59, 130, 246, 0.22);
    color: white;
    font-weight: 700;
  }
  .rts-control-copy {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.05rem;
  }
  .rts-control-copy strong {
    color: white;
    font-size: 0.82rem;
  }
  .rts-control-copy small {
    color: rgb(148, 163, 184);
    font-size: 0.72rem;
  }
  .rts-feed-item {
    border-radius: 0.9rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(15, 23, 42, 0.55);
    padding: 0.65rem 0.75rem;
  }
  .rts-feed-success {
    border-color: rgba(74, 222, 128, 0.22);
  }
  .rts-feed-warning {
    border-color: rgba(251, 191, 36, 0.24);
  }
</style>
