import type { RouterDecision, ChatMessage } from '../../shared/chat/index.js';
import type { ResolvedAgentProfile } from '../../shared/chat/index.js';

const MENTION_PATTERN = /@([\w-]+)/g;

export function parseMentions(text: string): string[] {
  const matches: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = MENTION_PATTERN.exec(text)) !== null) {
    matches.push(match[1]);
  }
  MENTION_PATTERN.lastIndex = 0;
  return matches;
}

export interface RouteContext {
  readonly text: string;
  readonly parentMessage?: ChatMessage | null;
  readonly defaultAgentId?: string;
  readonly participants: readonly ResolvedAgentProfile[];
}

export function routeToAgent(ctx: RouteContext): RouterDecision {
  if (ctx.participants.length === 0) {
    throw new Error('Cannot route: no active participants in thread');
  }

  const mentionedNames = parseMentions(ctx.text);
  if (mentionedNames.length > 0) {
    for (const name of mentionedNames) {
      const lower = name.toLowerCase();
      const match = ctx.participants.find(
        (p) => p.id.toLowerCase() === lower || p.name.toLowerCase().replace(/\s+/g, '-') === lower,
      );
      if (match) {
        return { agentId: match.id, reason: 'mention' };
      }
    }
  }

  if (ctx.parentMessage?.agentId) {
    const replyAgent = ctx.participants.find((p) => p.id === ctx.parentMessage!.agentId);
    if (replyAgent) {
      return { agentId: replyAgent.id, reason: 'reply-context' };
    }
  }

  if (ctx.defaultAgentId) {
    const defaultAgent = ctx.participants.find((p) => p.id === ctx.defaultAgentId);
    if (defaultAgent) {
      return { agentId: defaultAgent.id, reason: 'default-agent' };
    }
  }

  return { agentId: ctx.participants[0].id, reason: 'fallback' };
}
