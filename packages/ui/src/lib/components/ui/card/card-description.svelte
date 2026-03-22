<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';
  import { cn } from '../../../utils';

  type Props = HTMLAttributes<HTMLElement> & {
    children?: Snippet;
  };

  let { children, class: className, ...restProps }: Props = $props();
</script>

<p class={cn('text-muted-foreground text-sm leading-relaxed', className)} {...restProps}>
  {@render children?.()}
</p>
