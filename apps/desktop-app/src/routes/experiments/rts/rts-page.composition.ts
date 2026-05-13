import { createRtsTransport } from '$lib/adapters/rts/create-rts-transport';
import { Rts } from 'ui/source';
import { createRtsPageModel } from './rts-page.svelte.ts';

const { WebAudioBus } = Rts.Engine;

export function createRtsPage() {
  const model = createRtsPageModel({
    transport: createRtsTransport(),
    audioBus: new WebAudioBus(),
  });
  void model.bootstrap();
  return model;
}
