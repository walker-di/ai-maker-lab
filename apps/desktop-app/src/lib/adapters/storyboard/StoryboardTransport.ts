import type { Marketing } from 'domain/shared';

export type StoryboardSummary = Marketing.StoryboardSummary;
export type StoryboardDetail = Marketing.StoryboardDetail;
export type StoryboardFrame = Marketing.StoryboardFrame;
export type StoryboardPromptType = Marketing.StoryboardPromptType;
export type StoryboardAssetType = Marketing.StoryboardAssetType;
export type StoryboardTransitionType = Marketing.StoryboardTransitionType;

export interface StoryboardTransport {
	listStoryboards(): Promise<StoryboardSummary[]>;
	getStoryboard(id: string): Promise<StoryboardDetail>;
	createStoryboard(input: Marketing.CreateStoryboardDto): Promise<StoryboardSummary>;
	generateFrames(storyboardId: string, input: Marketing.GenerateStoryboardFramesDto): Promise<StoryboardDetail>;
	insertBlankFrame(storyboardId: string, input: Marketing.InsertBlankStoryboardFrameDto): Promise<StoryboardDetail>;
	updateFrameText(storyboardId: string, frameId: string, input: Marketing.UpdateStoryboardFrameTextDto): Promise<StoryboardFrame>;
	deleteFrame(storyboardId: string, frameId: string): Promise<StoryboardDetail>;
	reorderFrame(storyboardId: string, frameId: string, input: Marketing.ReorderStoryboardFrameDto): Promise<StoryboardDetail>;
	regeneratePrompt(storyboardId: string, frameId: string, promptType: StoryboardPromptType): Promise<{ prompt: string; frame: StoryboardFrame }>;
	generateFrameAsset(storyboardId: string, frameId: string, assetType: StoryboardAssetType): Promise<StoryboardFrame>;
	attachFrameAsset(storyboardId: string, frameId: string, input: Marketing.AttachStoryboardFrameAssetDto): Promise<StoryboardFrame>;
	updateTransition(storyboardId: string, frameId: string, input: Marketing.UpdateStoryboardTransitionDto): Promise<StoryboardFrame>;
	exportUnifiedVideo(storyboardId: string): Promise<Marketing.StoryboardExportResult>;
}
