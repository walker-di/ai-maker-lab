import { createPlatformerTransport } from '$lib/adapters/platformer/create-platformer-transport';
import { createEditorPageModel } from './editor-page.svelte.ts';

export function createEditorPage() {
  const model = createEditorPageModel({
    transport: createPlatformerTransport(),
  });
  void model.bootstrap();
  return model;
}
