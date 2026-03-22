<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';
  import { cn } from '../../../utils';

  type Props = HTMLAttributes<HTMLElement> & {
    children?: Snippet;
  };

  let { children, class: className, ...restProps }: Props = $props();
</script>

<div
  class={cn('bg-card text-card-foreground flex flex-col gap-6 rounded-3xl border shadow-sm', className)}
  {...restProps}
>
  {@render children?.()}
</div>
