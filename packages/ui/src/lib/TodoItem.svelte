<script lang="ts">
  interface Props {
    label: string;
    completed: boolean;
    removeLabel: string;
    onToggle?: () => void;
    onRemove?: () => void;
  }

  const { label, completed, removeLabel, onToggle, onRemove }: Props = $props();
</script>

<div class="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
  <label class="flex min-w-0 flex-1 items-center gap-3">
    <input
      type="checkbox"
      checked={completed}
      onchange={() => onToggle?.()}
      class="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
    />
    <span class={completed ? 'truncate text-slate-400 line-through' : 'truncate text-slate-900'}>
      {label}
    </span>
  </label>

  <button
    type="button"
    class="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
    onclick={() => onRemove?.()}
  >
    {removeLabel}
  </button>
</div>
