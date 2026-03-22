<script lang="ts">
  import type { DemoUser } from '@ai-maker-lab/domain';
  import Button from '../ui/button/button.svelte';

  interface Props {
    user?: DemoUser;
    onLogin?: () => void;
    onLogout?: () => void;
    onCreateAccount?: () => void;
  }

  let { user, onLogin, onLogout, onCreateAccount }: Props = $props();
</script>

<header class="rounded-[2rem] border border-border/80 bg-background/80 p-6 shadow-sm backdrop-blur">
  <div class="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
    <div class="space-y-3">
      <div class="inline-flex items-center rounded-full border border-border/80 bg-muted px-3 py-1 text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
        AI Maker Lab
      </div>
      <div class="space-y-2">
        <h1 class="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Shared UI for the desktop shell
        </h1>
        <p class="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
          `@ai-maker-lab/ui` now owns the reusable presentation layer, while `@ai-maker-lab/domain` keeps the app workflow language out of the shell.
        </p>
      </div>
    </div>

    <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
      {#if user}
        <div class="rounded-2xl border border-border/80 bg-card px-4 py-3 text-sm text-card-foreground shadow-sm">
          <div class="font-medium">{user.name}</div>
          <div class="text-xs uppercase tracking-[0.2em] text-muted-foreground">{user.role}</div>
        </div>
        <Button variant="outline" onclick={onLogout}>Log out</Button>
      {:else}
        <Button variant="outline" onclick={onLogin}>Log in</Button>
        <Button onclick={onCreateAccount}>Create account</Button>
      {/if}
    </div>
  </div>
</header>
