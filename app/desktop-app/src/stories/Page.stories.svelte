<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { createWorkspaceChecklist } from '@ai-maker-lab/domain';
  import { expect, userEvent, waitFor, within } from 'storybook/test';
  import { ShowcasePage } from '@ai-maker-lab/ui';

  // More on how to set up stories at: https://storybook.js.org/docs/writing-stories
  const { Story } = defineMeta({
    title: 'Example/Page',
    component: ShowcasePage,
    parameters: {
      // More on how to position stories at: https://storybook.js.org/docs/configure/story-layout
      layout: 'fullscreen',
    },
  });

  const checklist = createWorkspaceChecklist();
</script>

<Story name="Interactive" play={async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const loginButton = canvas.getByRole('button', { name: /Log in/i });
    await expect(loginButton).toBeInTheDocument();
    await userEvent.click(loginButton);
    await waitFor(() => expect(loginButton).not.toBeInTheDocument());

    const logoutButton = canvas.getByRole('button', { name: /Log out/i });
    await expect(logoutButton).toBeInTheDocument();
  }}
  args={{ checklist }}
/>

<Story name="Logged In" args={{ checklist, initialUser: { name: 'Jane Doe', role: 'builder' } }} />
