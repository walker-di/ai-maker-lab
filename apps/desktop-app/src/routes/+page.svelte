<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { CategoryCard } from 'ui/source';

  const todoHref = '/experiments/todo';
  const chatHref = '/experiments/chat';
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

{#snippet chatIcon()}
  <svg aria-hidden="true" viewBox="0 0 24 24" class="h-6 w-6 fill-none stroke-current stroke-[1.75]">
    <path stroke-linecap="round" stroke-linejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
  </svg>
{/snippet}

<svelte:head>
  <title>{m.lab_home_title()}</title>
</svelte:head>

<div class="mx-auto flex min-h-screen max-w-6xl flex-col gap-12 px-6 py-12 lg:px-8">
  <section class="max-w-3xl space-y-4">
    <h1 class="text-foreground text-4xl font-semibold tracking-tight sm:text-5xl">
      {m.lab_home_title()}
    </h1>
    <p class="text-muted-foreground text-lg leading-8">
      {m.lab_home_intro()}
    </p>
  </section>

  <section class="space-y-4">
    <div class="space-y-2">
      <h2 class="text-foreground text-2xl font-semibold">{m.lab_category_game()}</h2>
      <p class="text-muted-foreground max-w-3xl text-base leading-7">
        {m.lab_category_game_description()}
      </p>
    </div>
  </section>

  <section class="space-y-6">
    <div class="space-y-2">
      <h2 class="text-foreground text-2xl font-semibold">{m.lab_category_ui()}</h2>
      <p class="text-muted-foreground max-w-3xl text-base leading-7">
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

  <section class="space-y-6">
    <div class="space-y-2">
      <h2 class="text-foreground text-2xl font-semibold">{m.lab_category_ai()}</h2>
      <p class="text-muted-foreground max-w-3xl text-base leading-7">
        {m.lab_category_ai_description()}
      </p>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <CategoryCard
        href={chatHref}
        label="Multi-Agent Chat"
        description="Chat with AI agents backed by multiple models and configurable tool sets."
        ctaLabel={m.lab_open_experiment()}
        icon={chatIcon}
      />
    </div>
  </section>
</div>
