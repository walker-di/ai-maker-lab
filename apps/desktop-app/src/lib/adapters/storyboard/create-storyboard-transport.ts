import type { StoryboardTransport } from './StoryboardTransport';
import { WebStoryboardTransport } from './web-storyboard-transport';

export function createStoryboardTransport(): StoryboardTransport {
	return new WebStoryboardTransport();
}
