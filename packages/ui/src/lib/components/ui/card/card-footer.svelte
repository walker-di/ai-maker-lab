<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';
  import { cn } from '../../../utils';

  type Props = HTMLAttributes<HTMLElement> & {
    children?: Snippet;
  };

  let { children, class: className, ...restProps }: Props = $props();
</script>

<div class={cn('flex items-center px-6 pb-6', className)} {...restProps}>
  {@render children?.()}
</div>
