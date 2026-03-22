export interface WorkspaceChecklistItem {
  title: string;
  description: string;
}

const defaultChecklist: WorkspaceChecklistItem[] = [
  {
    title: 'Shared UI library',
    description: 'Expose Shadcn-based Svelte primitives from packages/ui through @ai-maker-lab/ui.'
  },
  {
    title: 'Shared domain package',
    description: 'Keep application and domain rules in packages/domain so the app shell stays thin.'
  },
  {
    title: 'Desktop composition shell',
    description: 'Limit app/desktop-app to routing, runtime wiring, platform adapters, and demos.'
  }
];

export function createWorkspaceChecklist(): WorkspaceChecklistItem[] {
  return defaultChecklist.map((item) => ({ ...item }));
}
