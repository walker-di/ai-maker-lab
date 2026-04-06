<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { Button } from 'ui/source';

  const { Story } = defineMeta({
    title: 'Shadcn/Button',
    component: Button,
    tags: ['autodocs'],
    argTypes: {
      variant: { control: false },
      size: { control: false },
    }
  });
</script>

<Story name="Default">
  <Button>Button</Button>
</Story>

<Story name="Outline">
  <Button variant="outline">Button</Button>
</Story>

<Story name="Destructive">
  <Button variant="destructive">Delete</Button>
</Story>

<Story name="Small">
  <Button variant="secondary" size="sm">Small Button</Button>
</Story>
