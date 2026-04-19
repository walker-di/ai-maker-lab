import { createPlatformerTransport } from '$lib/adapters/platformer/create-platformer-transport';
import { createPlatformerPageModel } from './platformer-page.svelte.ts';

export function createPlatformerPage() {
  const model = createPlatformerPageModel({
    transport: createPlatformerTransport(),
  });
  void model.bootstrap();
  return model;
}
