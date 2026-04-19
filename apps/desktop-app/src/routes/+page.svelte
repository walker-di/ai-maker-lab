<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { Button, CategoryCard } from 'ui/source';
  import SettingsIcon from '@lucide/svelte/icons/settings';

  const todoHref = '/experiments/todo';
  const chatHref = '/experiments/chat';
  const platformerHref = '/experiments/platformer';
  const platformerEditorHref = '/experiments/platformer/editor';
  const agentRegistryHref = '/agents';
  const settingsHref = '/settings';
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

{#snippet agentRegistryIcon()}
  <svg aria-hidden="true" viewBox="0 0 24 24" class="h-6 w-6 fill-none stroke-current stroke-[1.75]">
    <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 6.75A2.25 2.25 0 0 1 6.75 4.5h10.5a2.25 2.25 0 0 1 2.25 2.25v10.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 17.25V6.75Z" />
    <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 9h7.5" />
    <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 12h7.5" />
    <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 15h4.5" />
  </svg>
{/snippet}

{#snippet settingsIcon()}
  <SettingsIcon class="h-6 w-6" aria-hidden="true" />
{/snippet}

{#snippet platformerIcon()}
  <svg aria-hidden="true" viewBox="0 0 24 24" class="h-6 w-6 fill-none stroke-current stroke-[1.75]">
    <path stroke-linecap="round" stroke-linejoin="round" d="M3 18h18" />
    <path stroke-linecap="round" stroke-linejoin="round" d="M5 18v-3h3v3" />
    <path stroke-linecap="round" stroke-linejoin="round" d="M14 18v-6h4v6" />
    <circle cx="9" cy="10" r="1.5" />
  </svg>
{/snippet}

<svelte:head>
  <title>{m.lab_home_title()}</title>
</svelte:head>

<div class="mx-auto flex min-h-screen max-w-6xl flex-col gap-12 px-6 py-12 lg:px-8">
  <header class="flex items-start justify-between gap-4">
    <section class="max-w-3xl space-y-4">
      <h1 class="text-foreground text-4xl font-semibold tracking-tight sm:text-5xl">
        {m.lab_home_title()}
      </h1>
      <p class="text-muted-foreground text-lg leading-8">
        {m.lab_home_intro()}
      </p>
    </section>
    <Button
      href={settingsHref}
      variant="ghost"
      size="icon"
      aria-label={m.lab_settings_label()}
      data-testid="home-settings-icon"
    >
      <SettingsIcon class="h-5 w-5" aria-hidden="true" />
    </Button>
  </header>

  <section class="space-y-6">
    <div class="space-y-2">
      <h2 class="text-foreground text-2xl font-semibold">{m.lab_category_game()}</h2>
      <p class="text-muted-foreground max-w-3xl text-base leading-7">
        {m.lab_category_game_description()}
      </p>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <CategoryCard
        href={platformerHref}
        label="Platformer"
        description="Run a small side-scroller with the in-app engine."
        ctaLabel="Play"
        icon={platformerIcon}
      />
      <CategoryCard
        href={platformerEditorHref}
        label="Platformer Editor"
        description="Paint tiles, place entities, save user maps."
        ctaLabel="Open editor"
        icon={platformerIcon}
      />
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
        href={agentRegistryHref}
        label={m.lab_experiment_agent_registry_label()}
        description={m.lab_experiment_agent_registry_description()}
        ctaLabel={m.lab_open_experiment()}
        icon={agentRegistryIcon}
      />
      <CategoryCard
        href={chatHref}
        label={m.lab_experiment_chat_label()}
        description={m.lab_experiment_chat_description()}
        ctaLabel={m.lab_open_experiment()}
        icon={chatIcon}
      />
    </div>
  </section>

  <section class="space-y-6">
    <div class="space-y-2">
      <h2 class="text-foreground text-2xl font-semibold">{m.lab_category_system()}</h2>
      <p class="text-muted-foreground max-w-3xl text-base leading-7">
        {m.lab_category_system_description()}
      </p>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <CategoryCard
        href={settingsHref}
        label={m.lab_settings_label()}
        description={m.lab_settings_description()}
        ctaLabel={m.lab_open_settings()}
        icon={settingsIcon}
      />
    </div>
  </section>
</div>
