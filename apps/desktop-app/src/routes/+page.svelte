<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { CategoryCard } from 'ui/source';

  const todoHref = '/experiments/todo';
</script>

{#snippet todoIcon()}
  <svg aria-hidden="true" viewBox="0 0 24 24" class="h-6 w-6 fill-none stroke-current stroke-[1.75]">
    <path stroke-linecap="round" stroke-linejoin="round" d="M9 6.75h11.25" />
    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h11.25" />
    <path stroke-linecap="round" stroke-linejoin="round" d="M9 17.25h11.25" />
    <path stroke-linecap="round" stroke-linejoin="round" d="m3.75 6.75 1.5 1.5 3-3" />
    <path stroke-linecap="round" stroke-linejoin="round" d="m3.75 12 1.5 1.5 3-3" />
    <path stroke-linecap="round" stroke-linejoin="round" d="m3.75 17.25 1.5 1.5 3-3" />
  </svg>
{/snippet}

<svelte:head>
  <title>{m.lab_home_title()}</title>
</svelte:head>

<div class="mx-auto flex min-h-screen max-w-6xl flex-col gap-12 px-6 py-12 lg:px-8">
  <section class="max-w-3xl space-y-4">
    <h1 class="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
      {m.lab_home_title()}
    </h1>
    <p class="text-lg leading-8 text-slate-600">
      {m.lab_home_intro()}
    </p>
  </section>

  <section class="space-y-4">
    <div class="space-y-2">
      <h2 class="text-2xl font-semibold text-slate-900">{m.lab_category_game()}</h2>
      <p class="max-w-3xl text-base leading-7 text-slate-600">
        {m.lab_category_game_description()}
      </p>
    </div>
  </section>

  <section class="space-y-6">
    <div class="space-y-2">
      <h2 class="text-2xl font-semibold text-slate-900">{m.lab_category_ui()}</h2>
      <p class="max-w-3xl text-base leading-7 text-slate-600">
        {m.lab_category_ui_description()}
      </p>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <CategoryCard
        href={todoHref}
        label={m.lab_experiment_todo_label()}
        description={m.lab_experiment_todo_description()}
        ctaLabel={m.lab_open_experiment()}
        icon={todoIcon}
      />
    </div>
  </section>

  <section class="space-y-4">
    <div class="space-y-2">
      <h2 class="text-2xl font-semibold text-slate-900">{m.lab_category_ai()}</h2>
      <p class="max-w-3xl text-base leading-7 text-slate-600">
        {m.lab_category_ai_description()}
      </p>
    </div>
  </section>
</div>
