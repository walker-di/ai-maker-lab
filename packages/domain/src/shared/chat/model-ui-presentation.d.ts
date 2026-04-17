export interface ModelUiPresentation {
    readonly badges: readonly string[];
    readonly warnings: readonly string[];
    readonly disabledComposerControls: readonly string[];
    readonly fallbackHints: readonly string[];
    readonly hiddenToolToggles: readonly string[];
}
export declare const DEFAULT_UI_PRESENTATION: ModelUiPresentation;
