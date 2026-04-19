import type {
  ChatThread,
  ChatMessage,
  ChatSubthread,
  ResolvedAgentProfile,
  AttachmentRef,
} from 'domain/shared';

export interface SendMessageAttachmentInput
  extends Omit<AttachmentRef, 'id'> {}

export interface SendMessageParams {
  threadId: string;
  streamId: string;
  text: string;
  parentMessageId?: string;
  attachments?: SendMessageAttachmentInput[];
  toolOverrides?: Record<string, boolean>;
  /**
   * Original UI message array as posted by the AI SDK Chat client. Forwarded
   * to `streamResult.toUIMessageStreamResponse({ originalMessages })` so the
   * generated assistant message ID stays stable across the stream.
   */
  messages?: unknown[];
}

export interface SendMessageResponse {
  /**
   * Resolves to `true` once the bun side has finished pushing every
   * `chatStreamChunk` for this `streamId` and has emitted `chatStreamEnd`.
   * The renderer awaits this strictly as a completion barrier; the actual
   * stream payload is delivered out-of-band via `chatStream*` messages.
   */
  ok: true;
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
      updateThreadTitle: {
        params: { threadId: string; title: string };
        response: ChatThread;
      };
      setThreadAgent: { params: { threadId: string; agentId: string }; response: ChatThread };
      addThreadParticipant: { params: { threadId: string; agentId: string }; response: ChatThread };
      removeThreadParticipant: { params: { threadId: string; agentId: string }; response: ChatThread };
      deleteThread: { params: { threadId: string }; response: void };
      getMessages: { params: { threadId: string }; response: ChatMessage[] };
      getSubthread: {
        params: { threadId: string; parentMessageId: string };
        response: ChatSubthread;
      };
      sendMessage: { params: SendMessageParams; response: SendMessageResponse };
      duplicateSystemAgent: { params: { systemAgentId: string }; response: ResolvedAgentProfile };
      inheritSystemAgent: { params: { systemAgentId: string }; response: ResolvedAgentProfile };
      saveUserAgent: {
        params: {
          name: string;
          description: string;
          modelCardId: string;
          systemPrompt: string;
          toolOverrides?: Record<string, boolean>;
        };
        response: ResolvedAgentProfile;
      };
      updateUserAgent: {
        params: {
          id: string;
          input: {
            modelCardId?: string;
            systemPrompt?: string;
            toolOverrides?: Record<string, boolean>;
            userOverrides?: Record<string, unknown>;
          };
        };
        response: ResolvedAgentProfile;
      };
    };
    messages: {};
  };
  webview: {
    requests: {};
    /**
     * Messages the webview receives (i.e. pushed from bun -> webview).
     * Electrobun's schema convention is `Schema[Side].messages` = messages
     * that side handles as incoming.
     */
    messages: {
      chatStreamChunk: { streamId: string; chunk: string };
      chatStreamEnd: { streamId: string };
      chatStreamError: { streamId: string; error: string };
    };
  };
};
