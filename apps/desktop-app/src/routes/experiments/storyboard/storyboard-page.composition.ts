import { createStoryboardTransport } from '$lib/adapters/storyboard/create-storyboard-transport';
import { createStoryboardPageModel } from './storyboard-page.svelte';

export function createStoryboardPageComposition() {
	return createStoryboardPageModel(createStoryboardTransport());
}
