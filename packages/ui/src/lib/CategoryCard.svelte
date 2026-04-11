<script lang="ts">
  import type { Snippet } from 'svelte';
  import {
    Card,
    CardAction,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle
  } from './components/ui/card/index.js';

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
  class="group block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
  {href}
>
  <Card
    class="h-full bg-card/95 shadow-sm transition duration-200 group-hover:-translate-y-0.5 group-hover:bg-accent/20 group-hover:shadow-md group-hover:ring-foreground/15"
  >
    <CardHeader class="gap-3">
      <div class="flex items-start justify-between gap-4">
        <div class="space-y-2">
          <CardTitle class="text-lg">{label}</CardTitle>
        </div>

        {#if icon}
          <CardAction>
            <div
              class="bg-muted text-muted-foreground rounded-lg p-3 transition group-hover:bg-primary group-hover:text-primary-foreground"
            >
              {@render icon()}
            </div>
          </CardAction>
        {/if}
      </div>
    </CardHeader>

    {#if description}
      <CardContent>
        <p class="text-muted-foreground text-sm leading-6">{description}</p>
      </CardContent>
    {/if}

    {#if ctaLabel}
      <CardFooter class="text-primary bg-transparent pt-0 font-medium">
        <span class="inline-flex items-center gap-2 transition group-hover:translate-x-0.5">
          {ctaLabel}
        </span>
      </CardFooter>
    {/if}
  </Card>
</a>
