<script lang="ts">
  interface Props {
    placeholder: string;
    addLabel: string;
    onAdd?: (value: string) => void;
  }

  const { placeholder, addLabel, onAdd }: Props = $props();

  let value = $state('');
  let normalizedValue = $derived(value.trim());

  function submit() {
    if (!normalizedValue) {
      return;
    }

    onAdd?.(normalizedValue);
    value = '';
  }
</script>

<form
  class="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row"
  onsubmit={(event) => {
    event.preventDefault();
    submit();
  }}
>
  <input
    bind:value
    class="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-300"
    {placeholder}
  />

  <button
    type="submit"
    disabled={!normalizedValue}
    class="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300"
  >
    {addLabel}
  </button>
</form>
