<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { CategoryCard } from '../lib';

  const { Story } = defineMeta({
    title: 'Lab/CategoryCard',
    component: CategoryCard,
    tags: ['autodocs'],
    args: {
      label: 'Todo App',
      description: 'A focused UI experiment for task capture and list interaction.',
      href: '#',
      ctaLabel: 'Open'
    }
  });
</script>

<Story name="Default" />
