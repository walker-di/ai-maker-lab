import type {
  ChatThread,
  ChatMessage,
  ResolvedAgentProfile,
  RouterDecision,
  ChatRun,
} from 'domain/shared';

export interface SendMessageParams {
  threadId: string;
  text: string;
  parentMessageId?: string;
}

export interface SendMessageResponse {
  userMessage: ChatMessage;
  run: ChatRun;
  routerDecision: RouterDecision;
  response: {
    text: string;
    usage: { inputTokens: number; outputTokens: number; totalTokens: number };
    finishReason: string;
  };
}

export type ChatRpcSchema = {
  bun: {
    requests: {
      listAgents: { params: undefined; response: ResolvedAgentProfile[] };
      listThreads: { params: undefined; response: ChatThread[] };
      createThread: {
        params: { title: string; participantIds: string[]; defaultAgentId?: string };
        response: ChatThread;
      };
      getThread: { params: { threadId: string }; response: ChatThread | null };
      getMessages: { params: { threadId: string }; response: ChatMessage[] };
      sendMessage: { params: SendMessageParams; response: SendMessageResponse };
    };
    messages: {};
  };
  webview: {
    requests: {};
    messages: {};
  };
};
