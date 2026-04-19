export interface ProviderRegistryConfig {
    openaiApiKey?: string;
    anthropicApiKey?: string;
    googleApiKey?: string;
}
export declare function buildProviderRegistry(config?: ProviderRegistryConfig): import("ai").ProviderRegistryProvider<{
    openai: import("@ai-sdk/openai").OpenAIProvider;
    anthropic: import("@ai-sdk/anthropic").AnthropicProvider;
    google: import("@ai-sdk/google").GoogleGenerativeAIProvider;
}, ":">;
export type ProviderRegistry = ReturnType<typeof buildProviderRegistry>;
