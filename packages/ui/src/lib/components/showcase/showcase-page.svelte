<script lang="ts">
  import type { DemoUser, WorkspaceChecklistItem } from '@ai-maker-lab/domain';
  import Button from '../ui/button/button.svelte';
  import Card from '../ui/card/card.svelte';
  import CardContent from '../ui/card/card-content.svelte';
  import CardDescription from '../ui/card/card-description.svelte';
  import CardFooter from '../ui/card/card-footer.svelte';
  import CardHeader from '../ui/card/card-header.svelte';
  import CardTitle from '../ui/card/card-title.svelte';
  import ShowcaseHeader from './showcase-header.svelte';
  import { createShowcasePageModel } from './showcase-page.svelte.ts';

  interface Props {
    checklist: WorkspaceChecklistItem[];
    initialUser?: DemoUser;
  }

  let { checklist, initialUser }: Props = $props();

  const model = createShowcasePageModel();

  $effect(() => {
    model.state.user = initialUser;
  });
</script>

<article class="min-h-screen bg-gradient-to-b from-background via-background to-muted/30 px-6 py-10 sm:px-10 lg:px-16">
  <div class="mx-auto flex max-w-6xl flex-col gap-8">
    <ShowcaseHeader
      user={model.state.user}
      onLogin={model.login}
      onLogout={model.logout}
      onCreateAccount={model.createAccount}
    />

    <section class="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
      <Card class="overflow-hidden border-border/70 bg-card/90">
        <CardHeader class="gap-3">
          <div class="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
            Architecture shift
          </div>
          <CardTitle class="text-2xl sm:text-3xl">
            The app shell now consumes shared packages instead of owning everything locally.
          </CardTitle>
          <CardDescription class="max-w-3xl text-base">
            This starter page is rendered from `@ai-maker-lab/ui`, fed by data from `@ai-maker-lab/domain`, and mounted by `app/desktop-app` as the thin desktop composition boundary.
          </CardDescription>
        </CardHeader>
        <CardContent class="grid gap-4 sm:grid-cols-3">
          {#each checklist as item}
            <div class="rounded-2xl border border-border/70 bg-background/80 p-4">
              <div class="mb-3 text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
                Ready
              </div>
              <h3 class="text-base font-semibold text-foreground">{item.title}</h3>
              <p class="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
            </div>
          {/each}
        </CardContent>
        <CardFooter class="flex flex-col items-start gap-3 border-t border-border/60 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p class="text-sm text-muted-foreground">
            Use the shared primitives below to keep future screens consistent.
          </p>
          <div class="flex flex-wrap gap-3">
            <Button variant="outline" onclick={model.login}>Preview login state</Button>
            <Button onclick={model.createAccount}>Preview signup state</Button>
          </div>
        </CardFooter>
      </Card>

      <Card class="border-border/70 bg-card/95">
        <CardHeader>
          <CardTitle>Package responsibilities</CardTitle>
          <CardDescription>
            Keep the boundaries visible while the project is still small.
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-4 text-sm leading-6 text-muted-foreground">
          <div class="rounded-2xl border border-border/70 bg-muted/50 p-4">
            <div class="font-medium text-foreground">`@ai-maker-lab/ui`</div>
            <p>Reusable Shadcn-based components, paired presentation models, and shared styling tokens.</p>
          </div>
          <div class="rounded-2xl border border-border/70 bg-muted/50 p-4">
            <div class="font-medium text-foreground">`@ai-maker-lab/domain`</div>
            <p>Framework-free types and small workflow helpers that can move with future apps.</p>
          </div>
          <div class="rounded-2xl border border-border/70 bg-muted/50 p-4">
            <div class="font-medium text-foreground">`app/desktop-app`</div>
            <p>Routes, runtime adapters, platform wiring, and app-specific integrations like Paraglide.</p>
          </div>
        </CardContent>
      </Card>
    </section>
  </div>
</article>
