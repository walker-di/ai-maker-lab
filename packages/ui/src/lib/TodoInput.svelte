<script lang="ts">
  import { Button } from './components/ui/button/index.js';
  import { Card, CardContent } from './components/ui/card/index.js';
  import { Input } from './components/ui/input/index.js';

  interface Props {
    placeholder: string;
    addLabel: string;
    onAdd?: (value: string) => void;
  }

  const { placeholder, addLabel, onAdd }: Props = $props();

  let value = $state('');
  let normalizedValue = $derived(value.trim());

  function submit() {
    if (!normalizedValue) {
      return;
    }

    onAdd?.(normalizedValue);
    value = '';
  }
</script>

<Card class="border-border/60">
  <CardContent class="pt-4">
    <form
      class="flex flex-col gap-3 sm:flex-row"
      onsubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Input bind:value class="h-11 flex-1" {placeholder} />

      <Button type="submit" disabled={!normalizedValue} class="h-11 sm:min-w-28">
        {addLabel}
      </Button>
    </form>
  </CardContent>
</Card>
