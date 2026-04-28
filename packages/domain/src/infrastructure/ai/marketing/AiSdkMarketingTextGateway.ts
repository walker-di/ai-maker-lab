import { generateText, generateObject } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';
import type { IMarketingTextGenerationGateway } from '../../../application/marketing/ports.js';
import type {
  Product,
  Persona,
  Creative,
  Scene,
  Clip,
  Campaign,
  GeneratedStoryboardFrameDraft,
  StoryboardDetail,
  StoryboardFrame,
  StoryboardPromptType,
} from '../../../shared/marketing/index.js';
import type { CreativeType } from '../../../shared/marketing/index.js';

type ProviderName = 'anthropic' | 'openai' | 'google';

interface AiSdkMarketingTextGatewayConfig {
  provider: ProviderName;
  model: string;
  apiKey?: string;
}

function buildLanguageModel(config: AiSdkMarketingTextGatewayConfig) {
  switch (config.provider) {
    case 'anthropic': {
      const client = createAnthropic({ apiKey: config.apiKey });
      return client(config.model);
    }
    case 'openai': {
      const client = createOpenAI({ apiKey: config.apiKey });
      return client(config.model);
    }
    case 'google': {
      const client = createGoogleGenerativeAI({ apiKey: config.apiKey });
      return client(config.model);
    }
  }
}

export class AiSdkMarketingTextGateway implements IMarketingTextGenerationGateway {
  private readonly model: ReturnType<typeof buildLanguageModel>;

  constructor(private config: AiSdkMarketingTextGatewayConfig) {
    this.model = buildLanguageModel(config);
  }

  async generateProductDescription(product: Partial<Product>): Promise<string> {
    const { text } = await generateText({
      model: this.model,
      prompt: `Write a compelling, rich marketing description for the following product.
Product name: ${product.name ?? 'Unknown'}
Features: ${(product.features ?? []).join(', ')}
Benefits: ${(product.benefits ?? []).join(', ')}
Target audience: ${product.targetAudience ?? 'General'}

Write 2-3 paragraphs that highlight the value proposition, key features, and why the target audience should care. Be engaging and persuasive.`,
    });
    return text.trim();
  }

  async generatePersonas(product: Product, count: number): Promise<Partial<Persona>[]> {
    const { object } = await generateObject({
      model: this.model,
      schema: z.object({
        personas: z.array(z.object({
          name: z.string(),
          ageRange: z.enum(['18-24', '25-34', '35-44', '45-54', '55-64', '65+']),
          gender: z.enum(['male', 'female', 'non_binary', 'all']),
          occupation: z.string().optional(),
          income: z.string().optional(),
          interests: z.array(z.string()),
          painPoints: z.array(z.string()),
          motivations: z.array(z.string()),
          description: z.string().optional(),
        })),
      }),
      prompt: `Generate ${count} detailed marketing personas for the following product.
Product: ${product.name}
Description: ${product.description ?? ''}
Target audience: ${product.targetAudience ?? ''}
Features: ${product.features.join(', ')}
Benefits: ${product.benefits.join(', ')}

Each persona should be a realistic potential customer with specific demographics, interests, pain points, and motivations.`,
    });
    return object.personas;
  }

  async generateCreativeText(product: Product, persona: Persona, type: CreativeType): Promise<string> {
    const typeDescriptions: Record<CreativeType, string> = {
      text: 'social media post or ad copy',
      image: 'image caption and alt text description',
      video: 'video script narration',
      landing_page: 'landing page headline and body copy',
    };

    const { text } = await generateText({
      model: this.model,
      prompt: `Create ${typeDescriptions[type]} for a marketing campaign.

Product: ${product.name}
Product description: ${product.description ?? ''}
Target persona: ${persona.name}, ${persona.ageRange}, ${persona.gender}
Persona interests: ${persona.interests.join(', ')}
Persona pain points: ${persona.painPoints.join(', ')}

Write engaging, persuasive content tailored to this persona. Make it concise and impactful.`,
    });
    return text.trim();
  }

  async generateMarketingStrategy(product: Product, campaign?: Campaign): Promise<string> {
    const campaignContext = campaign
      ? `Campaign name: ${campaign.name}\nCampaign goals: ${campaign.goals ?? ''}\nBudget: ${campaign.budget ?? 'Not specified'}\nTarget regions: ${campaign.targetRegions.join(', ')}`
      : 'No specific campaign defined.';

    const { text } = await generateText({
      model: this.model,
      prompt: `Create a comprehensive marketing strategy document.

Product: ${product.name}
Product description: ${product.description ?? ''}
Target audience: ${product.targetAudience ?? ''}
Key features: ${product.features.join(', ')}
Key benefits: ${product.benefits.join(', ')}

${campaignContext}

Provide a detailed strategy including: executive summary, target market analysis, messaging framework, channel strategy, content pillars, and KPIs to track.`,
    });
    return text.trim();
  }

  async generateStoryboard(
    product: Product,
    creative: Creative,
  ): Promise<{ scenes: Partial<Scene>[]; clips: Partial<Clip>[][] }> {
    const { object } = await generateObject({
      model: this.model,
      schema: z.object({
        scenes: z.array(z.object({
          description: z.string(),
          durationMs: z.number(),
          orderIndex: z.number(),
        })),
        clips: z.array(z.array(z.object({
          type: z.enum(['image', 'video', 'text']),
          content: z.string().optional(),
          narrationText: z.string().optional(),
          durationMs: z.number().optional(),
          orderIndex: z.number(),
        }))),
      }),
      prompt: `Generate a video storyboard for a marketing video.

Product: ${product.name}
Product description: ${product.description ?? ''}
Creative name: ${creative.name}
Creative type: ${creative.type}

Create 3-5 scenes with 1-3 clips each. Each scene should tell part of the product story. 
Include narration text for each clip and estimated durations in milliseconds.`,
    });
    return object;
  }

  async generateStoryboardFrames(prompt: string, count: number): Promise<GeneratedStoryboardFrameDraft[]> {
    const { object } = await generateObject({
      model: this.model,
      schema: z.object({
        frames: z.array(z.object({
          title: z.string().optional(),
          narration: z.string(),
          mainImagePrompt: z.string(),
          backgroundImagePrompt: z.string(),
          bgmPrompt: z.string(),
          durationMs: z.number().optional(),
        })),
      }),
      prompt: `Generate ${count} storyboard frames for this story prompt.

Prompt: ${prompt}

Return concise but vivid frame data. Each frame must include narration, a main subject image prompt, a background image prompt, and a background music prompt.`,
    });
    return object.frames;
  }

  async regenerateStoryboardPrompt(params: {
    promptType: StoryboardPromptType;
    frame: StoryboardFrame;
    storyboard: StoryboardDetail;
  }): Promise<string> {
    const frameContext = params.storyboard.frames
      .map((frame) => `${frame.orderIndex + 1}. ${frame.title ?? 'Untitled'} — ${frame.narration}`)
      .join('\n');
    const promptKind: Record<StoryboardPromptType, string> = {
      narration: 'narration text',
      mainImage: 'main subject image prompt',
      backgroundImage: 'background image prompt',
      bgm: 'background music prompt',
    };
    const { text } = await generateText({
      model: this.model,
      prompt: `Regenerate the ${promptKind[params.promptType]} for one storyboard frame.

Storyboard: ${params.storyboard.name}
Frame to improve: ${params.frame.orderIndex + 1}
Current frame title: ${params.frame.title ?? 'Untitled'}
Current narration: ${params.frame.narration}
Current main image prompt: ${params.frame.mainImagePrompt}
Current background image prompt: ${params.frame.backgroundImagePrompt}
Current BGM prompt: ${params.frame.bgmPrompt}

Full ordered context:
${frameContext}

Return only the regenerated ${promptKind[params.promptType]}.`,
    });
    return text.trim();
  }
}
