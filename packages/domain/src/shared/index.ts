export const workspaceGreeting = 'Bun workspace packages are wired into the desktop app.';

export const workspacePackages = ['desktop-app', 'ui', 'domain'] as const;

export type WorkspacePackage = (typeof workspacePackages)[number];

export * from './todo';
export * from './chat';
export * as Platformer from './platformer/index.js';
