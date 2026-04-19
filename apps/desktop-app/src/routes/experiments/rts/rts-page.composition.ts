import { createRtsTransport } from '$lib/adapters/rts/create-rts-transport';
import { createRtsPageModel } from './rts-page.svelte.ts';

export function createRtsPage() {
  const model = createRtsPageModel({
    transport: createRtsTransport(),
  });
  void model.bootstrap();
  return model;
}
