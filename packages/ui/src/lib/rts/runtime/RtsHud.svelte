<script lang="ts">
  import {
    BUILDING_STATS,
    TECH_STATS,
    UNIT_STATS,
    type BuildingKind,
    type ResourceCost,
    type TechKind,
    type UnitKind,
  } from '../types.js';
  import type { RtsProductionOptionSummary, RtsResearchOptionSummary } from '../engine/index.js';
  import {
    RTS_HUD_BUILD_ACTIONS,
    RTS_HUD_ORDER_ACTIONS,
    RTS_HUD_RESEARCH_ACTIONS,
    RTS_HUD_TRAIN_ACTIONS,
    RTS_HUD_UTILITY_ACTIONS,
    type RtsHudCombatReadout,
    type RtsHudIntentPreview,
    type RtsHudModel,
    type RtsHudOrderKind,
    type RtsHudResearchKind,
    type RtsHudUtilityKind,
  } from './RtsHud.svelte.ts';

  let {
    model,
    onProduceUnit,
    onPlaceBuilding,
    onCancelBuilding,
    onOrder,
    onResearch,
    onStopSelection,
    onHoldSelection,
    onSelectArmy,
    productionOptions = [],
    researchOptions = [],
    completedResearch = [],
    combatReadout = null,
    intentPreview = null,
  }: {
    model: RtsHudModel;
    onProduceUnit?: (kind: UnitKind) => void;
    onPlaceBuilding?: (kind: BuildingKind) => void;
    onCancelBuilding?: () => void;
    onOrder?: (kind: RtsHudOrderKind) => void;
    onResearch?: (kind: TechKind) => void;
    onStopSelection?: () => void;
    onHoldSelection?: () => void;
    onSelectArmy?: () => void;
    productionOptions?: RtsProductionOptionSummary[];
    researchOptions?: RtsResearchOptionSummary[];
    completedResearch?: TechKind[];
    combatReadout?: RtsHudCombatReadout | null;
    intentPreview?: RtsHudIntentPreview | null;
  } = $props();

  function optionFor(kind: UnitKind): RtsProductionOptionSummary | undefined {
    return productionOptions.find((option) => option.kind === kind);
  }

  function researchOptionFor(kind: TechKind): RtsResearchOptionSummary | undefined {
    return researchOptions.find((option) => option.kind === kind);
  }

  function formatCost(cost: ResourceCost, supply = 0): string {
    const parts = [`${cost.mineral}M`];
    if (cost.gas > 0) parts.push(`${cost.gas}G`);
    if (supply > 0) parts.push(`${supply}S`);
    return parts.join(' ');
  }

  function requirementCue(cost: ResourceCost, supply = 0): string | null {
    const missing: string[] = [];
    if (model.state.mineral < cost.mineral) missing.push(`${cost.mineral - model.state.mineral}M`);
    if (model.state.gas < cost.gas) missing.push(`${cost.gas - model.state.gas}G`);
    if (supply > 0 && model.state.supplyUsed + supply > model.state.supplyCap) missing.push('supply');
    return missing.length > 0 ? `Need ${missing.join(' ')}` : null;
  }

  function trainDisabled(kind: UnitKind): boolean {
    const option = optionFor(kind);
    if (!option?.available) return true;
    return requirementCue(UNIT_STATS[kind].cost, UNIT_STATS[kind].supply) !== null;
  }

  function trainCue(kind: UnitKind): string {
    const option = optionFor(kind);
    if (!option?.available) return 'No producer';
    const blocked = requirementCue(UNIT_STATS[kind].cost, UNIT_STATS[kind].supply);
    if (blocked) return blocked;
    if (option.selectedProducerCount > 0) return `${option.selectedProducerCount} selected`;
    if (option.totalProducerCount > 0) return `${option.totalProducerCount} ready`;
    return 'Ready';
  }

  function buildCue(kind: BuildingKind): string {
    if (model.state.buildingMode === kind) return 'Armed';
    return requirementCue(BUILDING_STATS[kind].cost) ?? 'Place structure';
  }

  function formatResearchEffect(kind: TechKind): string {
    const effects = TECH_STATS[kind].effects;
    if (effects.armorBonus) return `+${effects.armorBonus} armor`;
    if (effects.damageBonus) return `+${effects.damageBonus} damage`;
    if (effects.sightBonus) return `+${effects.sightBonus} sight`;
    return 'Upgrade';
  }

  function researchDisabled(kind: RtsHudResearchKind): boolean {
    const option = researchOptionFor(kind);
    if (!option || option.researched || option.queued || !option.queueReady) return true;
    return requirementCue(TECH_STATS[kind].cost) !== null;
  }

  function researchCue(kind: RtsHudResearchKind): string {
    const option = researchOptionFor(kind);
    if (option?.researched) return 'Completed';
    if (option?.queued) return option.progress != null ? `Researching ${Math.round(option.progress * 100)}%` : 'Researching';
    if (!option?.available) return 'No HQ';
    if (!option.prerequisitesMet) {
      const [required] = option.blockedBy;
      return required ? `Need ${TECH_STATS[required].label}` : 'Locked';
    }
    const blocked = requirementCue(TECH_STATS[kind].cost);
    if (blocked) return blocked;
    if (!option.queueReady && option.busyResearcherCount > 0) return 'HQ busy';
    if (option.selectedResearcherCount > 0) return `${option.selectedResearcherCount} selected`;
    if (option.totalResearcherCount > 0) return `${option.totalResearcherCount} ready`;
    return 'Ready';
  }

  function researchDetail(kind: RtsHudResearchKind): string {
    const option = researchOptionFor(kind);
    if (option?.queued) return `${Math.round((option.progress ?? 0) * 100)}% complete`;
    if (option?.researched) return formatResearchEffect(kind);
    if (!option) return formatResearchEffect(kind);
    if (!option.prerequisitesMet) {
      return option.blockedBy.map((required) => TECH_STATS[required].label).join(' -> ');
    }
    if (option.busyResearcherCount && !option.queueReady) return `${option.busyResearcherCount}/${option.totalResearcherCount} busy`;
    return formatResearchEffect(kind);
  }

  function orderDisabled(kind: RtsHudOrderKind): boolean {
    return !onOrder || (model.state.selectionCount === 0 && model.state.armedOrder !== kind);
  }

  function orderCue(kind: RtsHudOrderKind): string {
    if (model.state.armedOrder === kind) {
      return kind === 'repair' ? 'Target damaged ally' : 'Click target';
    }
    if (model.state.selectionCount === 0) return 'Select units';
    if (kind === 'repair') return 'Needs worker';
    if (kind === 'rally') return 'Prod. structures';
    return 'Ready';
  }

  function utilityDisabled(kind: RtsHudUtilityKind): boolean {
    if (kind === 'army') return !onSelectArmy;
    if (kind === 'hold') return !onHoldSelection || model.state.selectionCount === 0;
    return !onStopSelection || model.state.selectionCount === 0;
  }

  function utilityCue(kind: RtsHudUtilityKind): string {
    if (kind === 'army') return 'Global select';
    if (model.state.selectionCount === 0) return 'Select units';
    return kind === 'hold' ? 'Stand ground' : 'Clear orders';
  }

  function selectionHeadline(): string {
    if (model.state.selectionCount === 0) return 'No selection';
    if (model.state.selectionLabel) return `${model.state.selectionCount} ${model.state.selectionLabel}`;
    return `${model.state.selectionCount} selected`;
  }

  function intentLabel(): string {
    if (model.state.buildingMode) return `Build armed: ${model.state.buildingMode}`;
    if (model.state.armedOrder) return `Order armed: ${model.state.armedOrder}`;
    if (model.state.activeResearchLabel) return `Researching ${model.state.activeResearchLabel}`;
    if (model.state.paused) return 'Paused';
    return 'Command ready';
  }

  function buildHotkeyTone(hotkey: string): string {
    return hotkey === '--' ? 'Mouse only' : hotkey;
  }

  const elapsedLabel = $derived.by(() => {
    const total = Math.floor(model.state.elapsedMs / 1000);
    const minutes = Math.floor(total / 60).toString().padStart(2, '0');
    const seconds = (total % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  });
</script>

<div class="rts-hud" data-testid="rts-hud">
  <div class="status-strip">
    <div class="resource-card" data-testid="hud-mineral">
      <span class="label">Minerals</span>
      <span class="resource-value">{model.state.mineral}</span>
    </div>
    <div class="resource-card" data-testid="hud-gas">
      <span class="label">Gas</span>
      <span class="resource-value">{model.state.gas}</span>
    </div>
    <div class="resource-card" data-testid="hud-supply">
      <span class="label">Supply</span>
      <span class="resource-value">{model.state.supplyUsed} / {model.state.supplyCap}</span>
    </div>
    <div class="resource-card" data-testid="hud-time">
      <span class="label">Time</span>
      <span class="resource-value">{elapsedLabel}</span>
    </div>
    <div class="resource-card compact" data-testid="hud-audio">
      <span class="label">Audio</span>
      <span class="resource-value">{model.state.muted ? 'Muted' : 'Live'}</span>
    </div>
    <div class="resource-card compact" data-testid="hud-faction">
      <span class="label">Faction</span>
      <span class="resource-value">{model.state.factionId}</span>
    </div>
  </div>

  <div class="command-layout">
    <section class="command-panel selection-panel" data-testid="hud-selection">
      <div class="panel-head">
        <div>
          <span class="label">Selection</span>
          <div class="selection-value">{selectionHeadline()}</div>
        </div>
        <span class:live-indicator={!model.state.paused} class:paused-indicator={model.state.paused} class="status-indicator">
          {model.state.paused ? 'Paused' : 'Live'}
        </span>
      </div>

      <div class="selection-meta">
        <div class="meta-row">
          <span class="meta-label">State</span>
          <span class="meta-value">{intentLabel()}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Focus</span>
          <span class="meta-value">{model.state.selectionCount > 0 ? (model.state.selectionLabel || 'Mixed') : 'Awaiting command'}</span>
        </div>
        {#if combatReadout}
          <div class={`combat-snapshot is-${combatReadout.tone}`} data-testid="hud-combat-snapshot">
            <div class="combat-snapshot-head">
              <span class="meta-label">Battlefield</span>
              <strong>{combatReadout.statusLabel}</strong>
            </div>
            <p class="combat-snapshot-copy">{combatReadout.headline}</p>
            <p class="combat-snapshot-detail">{combatReadout.detail}</p>
            <div class="combat-snapshot-grid">
              <div>
                <span class="meta-label">Contact</span>
                <span class="meta-value">{combatReadout.contactLabel}</span>
              </div>
              <div>
                <span class="meta-label">Enemy</span>
                <span class="meta-value">{combatReadout.enemyForceLabel}</span>
              </div>
              <div>
                <span class="meta-label">Hotspot</span>
                <span class="meta-value">{combatReadout.directionLabel}</span>
              </div>
              <div>
                <span class="meta-label">{combatReadout.timerLabel}</span>
                <span class="meta-value">{combatReadout.timerValue}</span>
              </div>
            </div>
            <p class="combat-snapshot-direction">{combatReadout.directionDetail}</p>
          </div>
        {/if}
        {#if intentPreview}
          <div class="intent-preview" data-testid="hud-intent-preview">
            <div class="combat-snapshot-head">
              <span class="meta-label">Queued intent</span>
              <strong>{intentPreview.label}</strong>
            </div>
            <p class="combat-snapshot-detail">{intentPreview.detail}</p>
          </div>
        {/if}
      </div>

      <div class="status-pills">
        <span class="pill">{model.state.muted ? 'Audio off' : 'Audio on'}</span>
        {#if model.state.buildingMode}
          <span class="pill pill-armed">Build: {model.state.buildingMode}</span>
        {/if}
        {#if model.state.armedOrder}
          <span class="pill pill-armed">Order: {model.state.armedOrder}</span>
        {/if}
        {#if model.state.activeResearchLabel}
          <span class="pill pill-research">
            Research: {model.state.activeResearchLabel}
            {#if model.state.activeResearchProgress != null}
              {Math.round(model.state.activeResearchProgress * 100)}%
            {/if}
          </span>
        {/if}
        {#if model.state.completedResearchCount > 0}
          <span class="pill">{model.state.completedResearchCount} upgrade{model.state.completedResearchCount === 1 ? '' : 's'} online</span>
        {/if}
        {#if !model.state.buildingMode && !model.state.armedOrder && !model.state.activeResearchLabel}
          <span class="pill">Ready</span>
        {/if}
      </div>
    </section>

    <section class="command-panel">
      <div class="panel-head">
        <div>
          <span class="label">Production</span>
          <div class="panel-title">Units and upgrades</div>
        </div>
      </div>

      <div class="panel-section">
        <div class="section-head">
          <span class="section-title">Train</span>
          <span class="section-meta">Queue by structure availability</span>
        </div>
        <div class="command-grid">
          {#each RTS_HUD_TRAIN_ACTIONS as action (action.kind)}
            {@const stats = UNIT_STATS[action.kind]}
            {@const option = optionFor(action.kind)}
            <button
              type="button"
              class="command-button"
              class:is-disabled={trainDisabled(action.kind)}
              onclick={() => onProduceUnit?.(action.kind)}
              disabled={!onProduceUnit || trainDisabled(action.kind)}
              data-testid={`train-${action.kind}`}
            >
              <span class="button-topline">
                <span>
                  <span class="button-title">{action.label}</span>
                  <span class="button-detail">{action.detail}</span>
                </span>
                <span class="hotkey-badge">{action.hotkey}</span>
              </span>
              <span class="button-bottomline">
                <span class="cost-badge">{formatCost(stats.cost, stats.supply)}</span>
                <span class="command-cue">{trainCue(action.kind)}</span>
              </span>
              <span class="producer-cue">
                {option?.selectedProducerCount || 0}/{option?.totalProducerCount || 0} selected/ready
              </span>
            </button>
          {/each}
        </div>
      </div>

      <div class="panel-section research-section">
        <div class="section-head">
          <span class="section-title">Research</span>
          <span class="section-meta">
            {model.state.activeResearchLabel ? '1 active' : `${completedResearch.length} complete`}
          </span>
        </div>
        <div class="command-grid research-grid">
          {#each RTS_HUD_RESEARCH_ACTIONS as action (action.kind)}
            {@const stats = TECH_STATS[action.kind]}
            {@const option = researchOptionFor(action.kind)}
            <button
              type="button"
              class="command-button research-button"
              class:is-active={Boolean(option?.queued)}
              class:is-complete={Boolean(option?.researched)}
              class:is-disabled={researchDisabled(action.kind)}
              onclick={() => onResearch?.(action.kind)}
              disabled={!onResearch || researchDisabled(action.kind)}
              data-testid={`research-${action.kind}`}
            >
              <span class="button-topline">
                <span>
                  <span class="button-title">{action.label}</span>
                  <span class="button-detail">{action.detail}</span>
                </span>
                <span class="hotkey-badge">{action.hotkey}</span>
              </span>
              <span class="button-bottomline">
                <span class="cost-badge">{formatCost(stats.cost)}</span>
                <span class="command-cue">{researchCue(action.kind)}</span>
              </span>
              <span class="producer-cue">{researchDetail(action.kind)}</span>
              {#if option?.queued && option.progress != null}
                <span class="research-progress-track" aria-hidden="true">
                  <span class="research-progress-fill" style:width={`${Math.max(0, Math.min(100, option.progress * 100))}%`}></span>
                </span>
              {/if}
            </button>
          {/each}
        </div>
      </div>
    </section>

    <section class="command-panel">
      <div class="panel-head">
        <div>
          <span class="label">Build</span>
          <div class="panel-title">Construction grid</div>
        </div>
        {#if model.state.buildingMode}
          <button type="button" class="command-cancel" onclick={() => onCancelBuilding?.()}>
            <span>Cancel {model.state.buildingMode}</span>
            <span class="hotkey-badge hotkey-badge-danger">Esc</span>
          </button>
        {/if}
      </div>

      <div class="command-grid">
        {#each RTS_HUD_BUILD_ACTIONS as action (action.kind)}
          {@const stats = BUILDING_STATS[action.kind]}
          {@const blocked = requirementCue(stats.cost)}
          <button
            type="button"
            class="command-button"
            class:is-active={model.state.buildingMode === action.kind}
            class:is-blocked={Boolean(blocked) && model.state.buildingMode !== action.kind}
            onclick={() => model.state.buildingMode === action.kind ? onCancelBuilding?.() : onPlaceBuilding?.(action.kind)}
            aria-pressed={model.state.buildingMode === action.kind}
            data-testid={`build-${action.kind}`}
          >
            <span class="button-topline">
              <span>
                <span class="button-title">{action.label}</span>
                <span class="button-detail">{action.detail}</span>
              </span>
              <span class="hotkey-badge hotkey-badge-muted">{buildHotkeyTone(action.hotkey)}</span>
            </span>
            <span class="button-bottomline">
              <span class="cost-badge">{formatCost(stats.cost)}</span>
              <span class="command-cue">{buildCue(action.kind)}</span>
            </span>
          </button>
        {/each}
      </div>
    </section>

    <section class="command-panel">
      <div class="panel-head">
        <div>
          <span class="label">Orders</span>
          <div class="panel-title">Combat and control</div>
        </div>
      </div>

      <div class="command-grid compact-grid">
        {#each RTS_HUD_ORDER_ACTIONS as action (action.kind)}
          <button
            type="button"
            class="command-button"
            class:is-active={model.state.armedOrder === action.kind}
            class:is-blocked={model.state.selectionCount === 0 && model.state.armedOrder !== action.kind}
            onclick={() => onOrder?.(action.kind)}
            disabled={orderDisabled(action.kind)}
            aria-pressed={model.state.armedOrder === action.kind}
            data-testid={`order-${action.kind === 'attackMove' ? 'attack-move' : action.kind}`}
          >
            <span class="button-topline">
              <span>
                <span class="button-title">{action.label}</span>
                <span class="button-detail">{action.detail}</span>
              </span>
              <span class="hotkey-badge">{action.hotkey}</span>
            </span>
            <span class="button-bottomline">
              <span class="command-cue">{orderCue(action.kind)}</span>
            </span>
          </button>
        {/each}

        {#each RTS_HUD_UTILITY_ACTIONS as action (action.kind)}
          <button
            type="button"
            class="command-button utility-button"
            class:is-blocked={action.kind !== 'army' && model.state.selectionCount === 0}
            onclick={() => {
              if (action.kind === 'stop') onStopSelection?.();
              if (action.kind === 'hold') onHoldSelection?.();
              if (action.kind === 'army') onSelectArmy?.();
            }}
            disabled={utilityDisabled(action.kind)}
            data-testid={action.kind === 'army' ? 'select-army' : `order-${action.kind}`}
          >
            <span class="button-topline">
              <span>
                <span class="button-title">{action.label}</span>
                <span class="button-detail">{action.detail}</span>
              </span>
              <span class="hotkey-badge">{action.hotkey}</span>
            </span>
            <span class="button-bottomline">
              <span class="command-cue">{utilityCue(action.kind)}</span>
            </span>
          </button>
        {/each}
      </div>
    </section>
  </div>
</div>

<style>
  .rts-hud {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.75rem;
    background:
      linear-gradient(180deg, rgba(29, 36, 52, 0.98), rgba(12, 16, 24, 0.98)),
      rgba(10, 14, 22, 0.96);
    color: #f7f4e9;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.82rem;
    letter-spacing: 0.03em;
    border: 1px solid rgba(123, 152, 196, 0.24);
    border-radius: 0.8rem;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.06),
      0 14px 28px rgba(0, 0, 0, 0.28);
  }

  .status-strip {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 0.5rem;
  }

  .resource-card {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-height: 4.1rem;
    padding: 0.55rem 0.7rem;
    background: linear-gradient(180deg, rgba(51, 63, 86, 0.8), rgba(22, 28, 40, 0.94));
    border: 1px solid rgba(164, 194, 232, 0.14);
    border-radius: 0.65rem;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  }

  .resource-card.compact {
    min-height: auto;
  }

  .label {
    color: #95a6c4;
    text-transform: uppercase;
    font-size: 0.66rem;
    letter-spacing: 0.14em;
  }

  .resource-value,
  .selection-value,
  .panel-title {
    color: #fff7d9;
    font-weight: 700;
  }

  .resource-value {
    font-size: 1rem;
  }

  .command-layout {
    display: grid;
    grid-template-columns: minmax(15rem, 1.15fr) repeat(3, minmax(0, 1fr));
    gap: 0.75rem;
    align-items: start;
  }

  .command-panel {
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
    min-height: 100%;
    padding: 0.75rem;
    background: linear-gradient(180deg, rgba(33, 41, 58, 0.94), rgba(15, 20, 30, 0.98));
    border: 1px solid rgba(132, 160, 205, 0.15);
    border-radius: 0.75rem;
  }

  .selection-panel {
    background:
      radial-gradient(circle at top left, rgba(68, 94, 138, 0.26), transparent 48%),
      linear-gradient(180deg, rgba(38, 46, 64, 0.96), rgba(15, 20, 31, 0.98));
  }

  .panel-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .selection-value,
  .panel-title {
    margin-top: 0.2rem;
    font-size: 0.96rem;
  }

  .status-indicator {
    padding: 0.22rem 0.48rem;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }

  .live-indicator {
    color: #9af1bb;
    background: rgba(33, 99, 58, 0.25);
  }

  .paused-indicator {
    color: #ffd98c;
    background: rgba(128, 91, 26, 0.28);
  }

  .selection-meta {
    display: grid;
    gap: 0.45rem;
  }

  .meta-row {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.45rem 0.55rem;
    background: rgba(7, 12, 20, 0.3);
    border-radius: 0.55rem;
  }

  .meta-label {
    color: #95a6c4;
    text-transform: uppercase;
    font-size: 0.66rem;
  }

  .meta-value {
    color: #f7f4e9;
    text-align: right;
  }

  .combat-snapshot,
  .intent-preview {
    display: grid;
    gap: 0.45rem;
    padding: 0.65rem 0.7rem;
    border-radius: 0.7rem;
    border: 1px solid rgba(148, 163, 184, 0.14);
    background: rgba(8, 14, 24, 0.42);
  }

  .combat-snapshot.is-warning {
    border-color: rgba(250, 204, 21, 0.24);
    background: rgba(71, 52, 10, 0.18);
  }

  .combat-snapshot.is-danger,
  .combat-snapshot.is-failure {
    border-color: rgba(248, 113, 113, 0.28);
    background: rgba(82, 24, 24, 0.18);
  }

  .combat-snapshot.is-success {
    border-color: rgba(74, 222, 128, 0.24);
    background: rgba(17, 68, 45, 0.16);
  }

  .combat-snapshot-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .combat-snapshot-head strong {
    color: #fff6d8;
    font-size: 0.84rem;
  }

  .combat-snapshot-copy {
    color: #f8fbff;
    font-size: 0.8rem;
    font-weight: 700;
  }

  .combat-snapshot-detail,
  .combat-snapshot-direction {
    color: #b9c7dc;
    font-size: 0.72rem;
    line-height: 1.4;
  }

  .combat-snapshot-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.45rem 0.75rem;
  }

  .combat-snapshot-grid > div {
    display: grid;
    gap: 0.12rem;
  }

  .status-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .pill {
    padding: 0.28rem 0.52rem;
    background: rgba(75, 97, 136, 0.22);
    border: 1px solid rgba(148, 179, 221, 0.15);
    border-radius: 999px;
    color: #d4e0f7;
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .pill-armed {
    color: #9de6ff;
    border-color: rgba(111, 216, 255, 0.35);
    background: rgba(26, 95, 130, 0.26);
  }

  .pill-research {
    color: #dfcbff;
    border-color: rgba(192, 132, 252, 0.35);
    background: rgba(88, 55, 130, 0.28);
  }

  .panel-section {
    display: grid;
    gap: 0.55rem;
  }

  .research-section {
    padding-top: 0.15rem;
    border-top: 1px solid rgba(148, 163, 184, 0.1);
  }

  .section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .section-title,
  .section-meta {
    font-size: 0.68rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .section-title {
    color: #bfd2f0;
    font-weight: 700;
  }

  .section-meta {
    color: #8397bb;
    text-align: right;
  }

  .command-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.55rem;
  }

  .compact-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .command-button,
  .command-cancel {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 0.38rem;
    min-height: 5.15rem;
    padding: 0.68rem 0.72rem;
    color: #f8fbff;
    background: linear-gradient(180deg, rgba(62, 77, 104, 0.9), rgba(24, 33, 48, 0.96));
    border: 1px solid rgba(213, 229, 255, 0.16);
    border-radius: 0.65rem;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition:
      transform 120ms ease,
      border-color 120ms ease,
      background 120ms ease,
      box-shadow 120ms ease,
      opacity 120ms ease;
  }

  .command-button:hover,
  .command-cancel:hover {
    transform: translateY(-1px);
    background: linear-gradient(180deg, rgba(76, 95, 128, 0.94), rgba(30, 40, 58, 0.98));
    border-color: rgba(226, 237, 255, 0.28);
  }

  .command-button:disabled {
    cursor: not-allowed;
    opacity: 0.56;
    transform: none;
  }

  .command-button.is-disabled {
    background: linear-gradient(180deg, rgba(50, 56, 70, 0.9), rgba(25, 29, 38, 0.96));
  }

  .command-button.is-blocked {
    border-color: rgba(204, 162, 91, 0.22);
    box-shadow: inset 0 0 0 1px rgba(204, 162, 91, 0.08);
  }

  .command-button.is-active {
    border-color: rgba(111, 216, 255, 0.54);
    background: linear-gradient(180deg, rgba(50, 100, 143, 0.92), rgba(28, 53, 88, 0.98));
    box-shadow:
      inset 0 0 0 1px rgba(201, 239, 255, 0.12),
      0 0 0 1px rgba(66, 145, 202, 0.15);
  }

  .command-button.is-complete {
    border-color: rgba(134, 239, 172, 0.34);
    background: linear-gradient(180deg, rgba(39, 90, 73, 0.9), rgba(18, 46, 37, 0.98));
    box-shadow: inset 0 0 0 1px rgba(187, 247, 208, 0.08);
  }

  .research-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .research-button {
    min-height: 5.45rem;
  }

  .utility-button {
    min-height: 4.6rem;
  }

  .button-topline,
  .button-bottomline {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .button-title {
    display: block;
    color: #fff6d8;
    font-weight: 700;
    font-size: 0.92rem;
  }

  .button-detail,
  .producer-cue {
    color: #98aacb;
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .producer-cue {
    margin-top: auto;
  }

  .research-progress-track {
    margin-top: 0.1rem;
    height: 0.28rem;
    overflow: hidden;
    border-radius: 999px;
    background: rgba(15, 23, 42, 0.78);
  }

  .research-progress-fill {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, rgba(56, 189, 248, 0.92), rgba(192, 132, 252, 0.92));
  }

  .hotkey-badge,
  .cost-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 2rem;
    padding: 0.18rem 0.4rem;
    border-radius: 0.45rem;
    font-size: 0.68rem;
    line-height: 1.1;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    white-space: nowrap;
  }

  .hotkey-badge {
    color: #d6ecff;
    background: rgba(9, 19, 33, 0.5);
    border: 1px solid rgba(171, 206, 255, 0.24);
  }

  .hotkey-badge-muted {
    color: #b9c7dc;
  }

  .hotkey-badge-danger {
    color: #ffd1d1;
    border-color: rgba(255, 170, 170, 0.28);
  }

  .cost-badge {
    color: #f8e8b0;
    background: rgba(95, 72, 23, 0.28);
    border: 1px solid rgba(214, 184, 105, 0.18);
  }

  .command-cue {
    color: #c7d5ed;
    font-size: 0.74rem;
    text-align: right;
  }

  .command-cancel {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    min-height: auto;
    padding: 0.48rem 0.62rem;
    background: linear-gradient(180deg, rgba(110, 46, 46, 0.82), rgba(63, 24, 24, 0.92));
    border-color: rgba(255, 164, 164, 0.2);
  }

  @media (max-width: 1120px) {
    .command-layout {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .selection-panel {
      grid-column: 1 / -1;
    }
  }

  @media (max-width: 860px) {
    .status-strip,
    .command-layout,
    .command-grid,
    .compact-grid,
    .combat-snapshot-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
