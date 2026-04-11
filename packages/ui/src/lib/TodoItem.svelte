<script lang="ts">
  import { Button } from './components/ui/button/index.js';
  import { Card, CardContent } from './components/ui/card/index.js';
  import { Checkbox } from './components/ui/checkbox/index.js';

  interface Props {
    label: string;
    completed: boolean;
    removeLabel: string;
    onToggle?: () => void;
    onRemove?: () => void;
  }

  const { label, completed, removeLabel, onToggle, onRemove }: Props = $props();
</script>

<Card class="border-border/60">
  <CardContent class="flex items-center gap-3 py-4">
    <Checkbox checked={completed} onCheckedChange={() => onToggle?.()} aria-label={label} />

    <div class="min-w-0 flex-1">
      <p class={completed ? 'text-muted-foreground truncate line-through' : 'text-foreground truncate'}>
        {label}
      </p>
    </div>

    <Button type="button" variant="outline" size="sm" onclick={() => onRemove?.()}>
      {removeLabel}
    </Button>
  </CardContent>
</Card>
