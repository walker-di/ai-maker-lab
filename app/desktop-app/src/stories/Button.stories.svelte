<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { fn } from 'storybook/test';
  import { Button } from '@ai-maker-lab/ui';

  // More on how to set up stories at: https://storybook.js.org/docs/writing-stories
  const { Story } = defineMeta({
    title: 'Example/Button',
    component: Button,
    tags: ['autodocs'],
    argTypes: {
      variant: {
        control: { type: 'select' },
        options: ['default', 'secondary', 'outline', 'ghost', 'link', 'destructive'],
      },
      size: {
        control: { type: 'select' },
        options: ['default', 'sm', 'lg', 'icon'],
      },
    },
    args: {
      onclick: fn(),
      label: 'Button'
    }
  });
</script>

<!-- More on writing stories with args: https://storybook.js.org/docs/writing-stories/args -->
<Story name="Primary" />

<Story name="Secondary" args={{ variant: 'secondary' }} />

<Story name="Large" args={{ size: 'lg' }} />

<Story name="Small" args={{ size: 'sm' }} />
