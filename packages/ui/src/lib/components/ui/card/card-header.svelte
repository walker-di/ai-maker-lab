<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';
  import { cn } from '../../../utils';

  type Props = HTMLAttributes<HTMLElement> & {
    children?: Snippet;
  };

  let { children, class: className, ...restProps }: Props = $props();
</script>

<div class={cn('grid auto-rows-min items-start gap-1.5 px-6 pt-6', className)} {...restProps}>
  {@render children?.()}
</div>
