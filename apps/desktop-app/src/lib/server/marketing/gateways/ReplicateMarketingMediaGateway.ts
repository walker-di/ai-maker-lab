import Replicate from 'replicate';
import type { Marketing } from 'domain/application';
import { getAdapterForModel } from './adapters/index.js';

const DEFAULT_IMAGE_MODEL = 'black-forest-labs/flux-1.1-pro';
const DEFAULT_MUSICGEN_VERSION = '671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb';

const MODEL_VERSIONS: Record<string, string> = {
  'stability-ai/sdxl': '7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc',
};

interface ReplicateMarketingMediaGatewayConfig {
  imageModel?: string;
  musicGenVersion?: string;
}

export class ReplicateMarketingMediaGateway
  implements Marketing.IMarketingImageGenerationGateway, Marketing.IBackgroundMusicGateway
{
  private readonly replicate: Replicate;
  private readonly imageModel: string;
  private readonly musicGenVersion: string;

  constructor(
    private readonly apiKey: string,
    private readonly config: ReplicateMarketingMediaGatewayConfig = {},
  ) {
    this.replicate = new Replicate({ auth: apiKey });
    this.imageModel = config.imageModel ?? DEFAULT_IMAGE_MODEL;
    this.musicGenVersion = config.musicGenVersion ?? DEFAULT_MUSICGEN_VERSION;
  }

  async generateImage(prompt: string, style?: string, options?: { aspectRatio?: string; model?: string }): Promise<{ url: string }> {
    const fullPrompt = style ? `${prompt}, style: ${style}` : prompt;
    const modelId = options?.model ?? this.imageModel;
    const adapter = getAdapterForModel(modelId);
    const input = adapter.buildInput({ prompt: fullPrompt, aspectRatio: options?.aspectRatio ?? '1:1' });

    const version = MODEL_VERSIONS[modelId];
    const identifier = version ? `${modelId}:${version}` : modelId;

    const output = await this.replicate.run(identifier as `${string}/${string}` | `${string}/${string}:${string}`, {
      input,
      wait: { mode: 'block' },
    });

    const url = this.extractUrl(output);
    if (!url) {
      console.error('Replicate image generation returned no URL.', { modelId, identifier, outputType: typeof output, output: JSON.stringify(output)?.slice(0, 200) });
      throw new Error('Replicate image generation returned no URL.');
    }
    return { url };
  }

  async generateSvg(prompt: string): Promise<{ svgContent: string }> {
    const { generateText } = await import('ai');
    const { createAnthropic } = await import('@ai-sdk/anthropic');
    const client = createAnthropic();
    const { text } = await generateText({
      model: client('claude-3-5-haiku-20241022'),
      prompt: `Generate a clean SVG illustration for: ${prompt}
Return ONLY the raw SVG markup starting with <svg and ending with </svg>. No explanation, no markdown.`,
    });
    const svgMatch = text.match(/<svg[\s\S]*<\/svg>/i);
    return { svgContent: svgMatch ? svgMatch[0] : text.trim() };
  }

  async generate(prompt: string, durationSecs: number): Promise<{ url: string }> {
    const output = await this.replicate.run(
      `meta/musicgen:${this.musicGenVersion}` as `${string}/${string}:${string}`,
      {
        input: {
          prompt,
          model_version: 'stereo-large',
          output_format: 'mp3',
          normalization_strategy: 'peak',
          duration: durationSecs,
        },
        wait: { mode: 'block' },
      },
    );

    const url = this.extractUrl(output);
    if (!url) throw new Error('Replicate music generation returned no URL.');
    return { url };
  }

  private extractUrl(output: unknown): string | null {
    if (typeof output === 'string') return output;
    if (output && typeof output === 'object') {
      // FileOutput has .url() returning a URL object and .toString() returning the URL string
      if (typeof (output as Record<string, unknown>).url === 'function') {
        const urlResult = (output as { url: () => unknown }).url();
        if (urlResult && typeof urlResult === 'object' && 'href' in urlResult) return (urlResult as URL).href;
        if (typeof urlResult === 'string') return urlResult;
      }
      if (typeof (output as Record<string, unknown>).toString === 'function') {
        const str = String(output);
        if (str.startsWith('http')) return str;
      }
    }
    if (Array.isArray(output) && output.length > 0) {
      return this.extractUrl(output[0]);
    }
    return null;
  }
}
