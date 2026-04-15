import type { SystemAgentDefinition } from '../../shared/chat/index.js';
import {
  Gpt41ModelCard,
  Claude4SonnetModelCard,
  Gemini25ProModelCard,
} from '../../shared/chat/index.js';

const DEFAULT_SYSTEM_AGENTS: SystemAgentDefinition[] = [
  {
    id: 'system-general',
    name: 'General Assistant',
    description: 'A helpful general-purpose assistant.',
    modelCard: Gpt41ModelCard,
    systemPrompt: 'You are a helpful assistant.',
    defaultToolState: {},
    metadata: {},
  },
  {
    id: 'system-creative',
    name: 'Creative Writer',
    description: 'An assistant tuned for creative writing tasks.',
    modelCard: Claude4SonnetModelCard,
    systemPrompt: 'You are a creative writing assistant. Help users craft compelling stories, poems, and other creative content.',
    defaultToolState: {},
    metadata: { category: 'creative' },
  },
  {
    id: 'system-analyst',
    name: 'Research Analyst',
    description: 'An assistant for research and analysis tasks with multimodal capabilities.',
    modelCard: Gemini25ProModelCard,
    systemPrompt: 'You are a research analyst. Help users analyze data, documents, and media to extract insights.',
    defaultToolState: {},
    metadata: { category: 'research' },
  },
];

export function loadSystemAgentDefinitions(): SystemAgentDefinition[] {
  return [...DEFAULT_SYSTEM_AGENTS];
}

export function findSystemAgentById(id: string): SystemAgentDefinition | undefined {
  return DEFAULT_SYSTEM_AGENTS.find((agent) => agent.id === id);
}
