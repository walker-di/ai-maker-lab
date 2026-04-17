import type { ModelMessage, ToolSet } from 'ai';
import type { ModelCard } from './model-card.js';
export interface ModelFamilyStrategy {
    prepareMessages?(messages: ModelMessage[], card: ModelCard): ModelMessage[];
    resolveTools?(requestedState: Record<string, boolean>): ToolSet;
    providerOptions?: Record<string, Record<string, unknown>>;
}
export declare const Gpt41ModelCard: ModelCard;
export declare const Gpt41MiniModelCard: ModelCard;
export declare const Gpt4oModelCard: ModelCard;
export declare const Claude4SonnetModelCard: ModelCard;
export declare const Claude35HaikuModelCard: ModelCard;
export declare const Gemini25ProModelCard: ModelCard;
export declare const Gemini25FlashModelCard: ModelCard;
export declare const Gemini25FlashLiteModelCard: ModelCard;
export declare const Gemini31ProPreviewModelCard: ModelCard;
export declare const Gemini31FlashLitePreviewModelCard: ModelCard;
export declare const MODEL_CARD_CATALOG: readonly ModelCard[];
export declare const FAMILY_STRATEGIES: Record<string, ModelFamilyStrategy>;
