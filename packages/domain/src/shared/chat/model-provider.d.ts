export declare const ModelProvider: {
    readonly OpenAI: "openai";
    readonly Anthropic: "anthropic";
    readonly Google: "google";
};
export type ModelProvider = (typeof ModelProvider)[keyof typeof ModelProvider];
export declare const SupportedModelId: {
    readonly Gpt41: "gpt-4.1";
    readonly Gpt41Mini: "gpt-4.1-mini";
    readonly Gpt4o: "gpt-4o";
    readonly Claude4Sonnet: "claude-sonnet-4-20250514";
    readonly Claude35Haiku: "claude-3-5-haiku-20241022";
    readonly Gemini25Pro: "gemini-2.5-pro";
    readonly Gemini25Flash: "gemini-2.5-flash";
    readonly Gemini25FlashLite: "gemini-2.5-flash-lite";
    readonly Gemini31ProPreview: "gemini-3.1-pro-preview";
    readonly Gemini31FlashLitePreview: "gemini-3.1-flash-lite-preview";
};
export type SupportedModelId = (typeof SupportedModelId)[keyof typeof SupportedModelId];
export declare function formatRegistryId(provider: ModelProvider, modelId: string): string;
