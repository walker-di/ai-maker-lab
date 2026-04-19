import { type ModelMessage } from 'ai';
import { MockLanguageModelV3 } from 'ai/test';
import type { HostedNativeToolName, SystemAgentDefinition } from '../../../shared/chat/index.js';
import type { ISystemAgentDefinitionSource } from '../ports.js';
import type { ProviderRegistry } from '../../../infrastructure/ai/provider-registry.js';
export declare class InMemorySystemSource implements ISystemAgentDefinitionSource {
    private readonly agents;
    constructor(agents?: SystemAgentDefinition[]);
    loadAll(): SystemAgentDefinition[];
    findById(id: string): SystemAgentDefinition | undefined;
}
export declare const ONE_PIXEL_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9sZrxh8AAAAASUVORK5CYII=";
export declare const IMAGE_GENERATION_PREVIEW_URL = "https://cdn.openai.com/generated/panda";
export interface HostedToolFixture {
    readonly toolName: HostedNativeToolName;
    readonly toolCallId: string;
    readonly assistantText: string;
    readonly input: Record<string, unknown>;
    readonly output: Record<string, unknown>;
    readonly streamedParts: readonly Record<string, unknown>[];
    readonly responseMessages: readonly ModelMessage[];
    readonly expectsPreviewParts: boolean;
}
export declare const HOSTED_TOOL_FIXTURES: readonly HostedToolFixture[];
export declare function getHostedToolFixture(toolName: HostedNativeToolName): HostedToolFixture;
export declare function createMockLanguageModel(modelId?: string): MockLanguageModelV3;
export declare function createMockRegistry(model?: MockLanguageModelV3): ProviderRegistry;
