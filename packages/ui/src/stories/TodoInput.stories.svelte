<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { fn } from 'storybook/test';
  import { TodoInput } from '../lib';

  const { Story } = defineMeta({
    title: 'Lab/TodoInput',
    component: TodoInput,
    tags: ['autodocs'],
    args: {
      placeholder: 'What needs to be done?',
      addLabel: 'Add todo',
      onAdd: fn()
    }
  });
</script>

<Story name="Default" />
