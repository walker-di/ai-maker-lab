<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';
  import { cn } from '../../../utils';
  import { buttonVariants, type ButtonSize, type ButtonVariant } from './index';

  type Props = HTMLButtonAttributes & {
    children?: Snippet;
    label?: string;
    variant?: ButtonVariant;
    size?: ButtonSize;
  };

  let {
    children,
    class: className,
    label,
    variant = 'default',
    size = 'default',
    type = 'button',
    ...restProps
  }: Props = $props();
</script>

<button
  class={cn(buttonVariants({ variant, size }), className)}
  {type}
  {...restProps}
>
  {#if label}
    {label}
  {:else}
    {@render children?.()}
  {/if}
</button>
