import type { ModelProvider } from './model-provider.js';
import type { ModelCapabilityMatrix } from './model-capability-matrix.js';
import type { ModelUiPresentation } from './model-ui-presentation.js';
import type { ModelInputPolicy } from './model-input-policy.js';
import type { NativeToolSupportLevel, HostedNativeToolName, NativeToolFamily } from './model-native-tools.js';
import type { ModelToolPolicy } from './model-tool-policy.js';
export interface ModelCard {
    readonly familyId: string;
    readonly provider: ModelProvider;
    readonly modelId: string;
    readonly registryId: string;
    readonly label: string;
    readonly description: string;
    readonly capabilities: ModelCapabilityMatrix;
    readonly uiPresentation: ModelUiPresentation;
    readonly inputPolicy: ModelInputPolicy;
    readonly nativeToolSupportLevel: NativeToolSupportLevel;
    readonly nativeTools: readonly HostedNativeToolName[];
    readonly nativeToolFamilies: readonly NativeToolFamily[];
    readonly toolPolicy: ModelToolPolicy;
    readonly providerOptionsPreset: Record<string, unknown>;
}
