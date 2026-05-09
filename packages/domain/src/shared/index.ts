export { clamp } from './clamp.js';

export const workspaceGreeting = 'Bun workspace packages are wired into the desktop app.';

export const workspacePackages = ['desktop-app', 'ui', 'domain'] as const;

export type WorkspacePackage = (typeof workspacePackages)[number];

export * from './todo';
export * from './chat';
export * as Platformer from './platformer/index.js';
export * as Racing from './racing/index.js';
export * as Rts from './rts/index.js';
export * as Marketing from './marketing/index.js';
export * as AiModels from './ai-models/index.js';
export { CanvasAspectRatio } from './marketing/constants.js';
