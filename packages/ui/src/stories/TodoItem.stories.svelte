<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { fn } from 'storybook/test';
  import { TodoItem } from '../lib/index.js';

  const { Story } = defineMeta({
    title: 'Lab/TodoItem',
    component: TodoItem,
    tags: ['autodocs'],
    args: {
      label: 'Draft the first home page experiment',
      completed: false,
      removeLabel: 'Remove',
      onToggle: fn(),
      onRemove: fn()
    }
  });
</script>

<Story name="Active" />
<Story name="Completed" args={{ completed: true }} />
