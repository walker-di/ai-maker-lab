<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    label: string;
    description?: string;
    href: string;
    ctaLabel?: string;
    icon?: Snippet;
  }

  const { label, description, href, ctaLabel, icon }: Props = $props();
</script>

<a
  class="group flex h-full flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
  {href}
>
  <div class="flex items-start justify-between gap-4">
    <div class="space-y-2">
      <p class="text-lg font-semibold text-slate-900">{label}</p>
      {#if description}
        <p class="text-sm leading-6 text-slate-600">{description}</p>
      {/if}
    </div>

    {#if icon}
      <div class="rounded-xl bg-slate-100 p-3 text-slate-700 transition group-hover:bg-slate-900 group-hover:text-white">
        {@render icon()}
      </div>
    {/if}
  </div>

  {#if ctaLabel}
    <span class="mt-auto text-sm font-medium text-slate-500 transition group-hover:text-slate-900">
      {ctaLabel}
    </span>
  {/if}
</a>
