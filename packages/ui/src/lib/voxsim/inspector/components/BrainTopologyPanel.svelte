<script lang="ts">
  import type { InspectorBrainGraph } from '../types.js';

  let { graph }: { graph: InspectorBrainGraph | null } = $props();

  const layout = $derived.by(() => buildPositions(graph));

  function buildPositions(g: InspectorBrainGraph | null) {
    if (!g) return { width: 0, height: 0, positions: new Map<string, { x: number; y: number }>() };
    const positions = new Map<string, { x: number; y: number }>();
    const columnWidth = 110;
    const rowHeight = 32;
    const padding = 16;
    if (g.topology === 'mlp' || g.topology === 'recurrentMlp') {
      const columns = new Map<number, string[]>();
      for (const node of g.nodes) {
        let column = columns.get(node.layerIndex);
        if (!column) {
          column = [];
          columns.set(node.layerIndex, column);
        }
        column.push(node.id);
      }
      const sortedLayerIndices = Array.from(columns.keys()).sort((a, b) => a - b);
      let maxRows = 0;
      sortedLayerIndices.forEach((layerIndex, columnIndex) => {
        const ids = columns.get(layerIndex) ?? [];
        ids.forEach((id, rowIndex) => {
          positions.set(id, {
            x: padding + columnIndex * columnWidth,
            y: padding + rowIndex * rowHeight,
          });
        });
        if (ids.length > maxRows) maxRows = ids.length;
      });
      return {
        width: padding * 2 + sortedLayerIndices.length * columnWidth,
        height: padding * 2 + maxRows * rowHeight,
        positions,
      };
    }
    g.nodes.forEach((node, index) => {
      const angle = (index / Math.max(1, g.nodes.length)) * Math.PI * 2;
      positions.set(node.id, {
        x: padding + 200 + Math.cos(angle) * 180,
        y: padding + 200 + Math.sin(angle) * 180,
      });
    });
    return { width: 440, height: 440, positions };
  }

  function nodeColor(kind: string, speciesId?: number, palette?: Record<number, string>): string {
    if (speciesId !== undefined && palette?.[speciesId]) return palette[speciesId]!;
    switch (kind) {
      case 'input': return '#7aa6ff';
      case 'output': return '#ffb87a';
      case 'lstm': return '#a37aff';
      case 'cppn': return '#ff7ab8';
      case 'bias': return '#888888';
      default: return '#7affb8';
    }
  }

  function edgeStroke(weight: number): string {
    if (weight >= 0) return `rgba(122, 200, 255, ${Math.min(1, Math.abs(weight))})`;
    return `rgba(255, 122, 138, ${Math.min(1, Math.abs(weight))})`;
  }

  function edgeWidth(weight: number): number {
    return Math.max(0.5, Math.min(4, Math.abs(weight) * 3));
  }
</script>

<div class="topology-panel" data-testid="brain-topology-panel">
  {#if !graph}
    <div class="empty">No brain attached</div>
  {:else}
    <header>
      <span class="label">{graph.topology}</span>
      <span class="meta">{graph.nodes.length} nodes / {graph.edges.length} edges</span>
    </header>
    <svg viewBox={`0 0 ${layout.width} ${layout.height}`} role="img" aria-label="brain topology">
      {#each graph.edges as edge (edge.id)}
        {@const source = layout.positions.get(edge.sourceId)}
        {@const target = layout.positions.get(edge.targetId)}
        {#if source && target}
          <line
            x1={source.x}
            y1={source.y}
            x2={target.x}
            y2={target.y}
            stroke={edgeStroke(edge.weight)}
            stroke-width={edgeWidth(edge.weight)}
            stroke-dasharray={edge.enabled === false ? '4 3' : undefined}
            opacity={edge.enabled === false ? 0.4 : 1}
          />
        {/if}
      {/each}
      {#each graph.nodes as node (node.id)}
        {@const position = layout.positions.get(node.id)}
        {#if position}
          <g transform={`translate(${position.x}, ${position.y})`}>
            <circle r="6" fill={nodeColor(node.kind, node.speciesId, graph.speciesPalette)} />
            {#if node.label}
              <text x="9" y="3" font-size="9" fill="#cfd2dc">{node.label}</text>
            {/if}
          </g>
        {/if}
      {/each}
    </svg>
  {/if}
</div>

<style>
  .topology-panel {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    background: rgba(15, 20, 30, 0.85);
    border-radius: 0.5rem;
    padding: 0.75rem;
    color: #d6d6df;
    font-family: ui-sans-serif, system-ui, sans-serif;
    font-size: 0.8rem;
  }
  header {
    display: flex;
    justify-content: space-between;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-size: 0.7rem;
    color: #8b8fa0;
  }
  .label {
    color: #ffffff;
  }
  svg {
    width: 100%;
    height: 320px;
    background: rgba(8, 10, 18, 0.6);
    border-radius: 0.4rem;
  }
  .empty {
    text-align: center;
    color: #707184;
    padding: 2rem 0;
  }
</style>
