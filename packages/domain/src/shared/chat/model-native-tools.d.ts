export type NativeToolSupportLevel = 'none' | 'hosted' | 'host-executed';
export type HostedNativeToolName = 'google_search' | 'file_search' | 'url_context' | 'google_maps' | 'code_execution' | 'web_search' | 'web_fetch' | 'image_generation' | 'code_interpreter';
export type NativeToolFamily = 'search' | 'retrieval' | 'urlContext' | 'maps' | 'codeExecution' | 'imageGeneration' | 'shell' | 'editor' | 'computer' | 'memory' | 'mcp';
export declare function isHostedNativeToolName(value: string): value is HostedNativeToolName;
