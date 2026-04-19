<script lang="ts">
  import type { AgentInspectorModel } from '../agent-inspector-model.js';
  import BrainTopologyPanel from './BrainTopologyPanel.svelte';
  import TrainingChartsPanel from './TrainingChartsPanel.svelte';
  import NeuronActivityPanel from './NeuronActivityPanel.svelte';
  import CppnSubstratePanel from './CppnSubstratePanel.svelte';
  import LstmCellPanel from './LstmCellPanel.svelte';
  import SpeciesListPanel from './SpeciesListPanel.svelte';
  import ReplayViewer from './ReplayViewer.svelte';

  let { model }: { model: AgentInspectorModel } = $props();

  let revision = $state(0);

  $effect(() => {
    const unsubscribe = model.subscribe(() => {
      revision = (revision + 1) | 0;
    });
    return unsubscribe;
  });

  const graph = $derived(revision >= 0 ? model.computeBrainGraph() : null);
  const chartSeries = $derived(revision >= 0 ? model.charts.snapshot() : []);
  const activityWindow = $derived(revision >= 0 ? model.activityView.window : []);
  const lstmIds = $derived(revision >= 0 ? model.lstmCellView.nodeIds : ([] as readonly number[]));
  const speciesRows = $derived(revision >= 0 ? model.speciesList.rows() : []);
  const speciesSelectedId = $derived(revision >= 0 ? model.speciesList.selectedId : null);
  const cursor = $derived(revision >= 0 ? model.replayCursor : null);
  const panels = $derived(revision >= 0 ? model.panels : null);
</script>

<section class="agent-inspector" data-testid="agent-inspector" data-mode={model.mode}>
  <aside class="sidebar">
    {#if panels?.species}
      <SpeciesListPanel
        rows={speciesRows}
        selectedId={speciesSelectedId}
        onSelect={(id) => model.setSelectedSpeciesId(id)}
      />
    {/if}
  </aside>
  <main class="main">
    {#if panels?.topology}
      <BrainTopologyPanel {graph} />
    {/if}
    {#if panels?.charts}
      <TrainingChartsPanel series={chartSeries} />
    {/if}
    {#if panels?.activity}
      <NeuronActivityPanel window={activityWindow} />
    {/if}
    {#if panels?.lstmCell}
      <LstmCellPanel
        nodeIds={lstmIds}
        windowFor={(id) => model.lstmCellView.windowFor(id)}
      />
    {/if}
    {#if panels?.cppnSubstrate}
      <CppnSubstratePanel cells={[]} />
    {/if}
    {#if panels?.replay}
      <ReplayViewer
        cursor={cursor}
        onSeek={(frameIndex) => model.seek(frameIndex)}
        onPlay={() => model.play()}
        onPause={() => model.pause()}
        onSetRate={(rate) => model.setPlaybackRate(rate)}
      />
    {/if}
  </main>
</section>

<style>
  .agent-inspector {
    display: grid;
    grid-template-columns: 280px 1fr;
    gap: 0.75rem;
    padding: 0.75rem;
    background: rgba(8, 10, 18, 0.4);
    border-radius: 0.5rem;
  }
  .sidebar,
  .main {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    min-width: 0;
  }
  .sidebar:empty {
    display: none;
  }
  .agent-inspector:not(:has(.sidebar > *)) {
    grid-template-columns: 1fr;
  }
</style>
