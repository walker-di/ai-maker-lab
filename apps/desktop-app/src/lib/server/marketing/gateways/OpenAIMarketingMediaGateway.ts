import type { Marketing } from 'domain/application';

const DEFAULT_IMAGE_MODEL = 'gpt-image-1';

interface OpenAIMarketingMediaGatewayConfig {
	imageModel?: string;
}

export class OpenAIMarketingMediaGateway
	implements Marketing.IMarketingImageGenerationGateway, Marketing.IBackgroundMusicGateway
{
	private readonly apiKey: string;
	private readonly imageModel: string;

	constructor(
		apiKey: string,
		config: OpenAIMarketingMediaGatewayConfig = {},
	) {
		this.apiKey = apiKey;
		this.imageModel = config.imageModel ?? DEFAULT_IMAGE_MODEL;
	}

	async generateImage(
		prompt: string,
		style?: string,
		options?: { aspectRatio?: string; model?: string },
	): Promise<{ url: string }> {
		const { generateImage } = await import('ai');
		const { createOpenAI } = await import('@ai-sdk/openai');

		const openai = createOpenAI({ apiKey: this.apiKey });
		const modelId = options?.model ?? this.imageModel;

		const size = this.aspectRatioToSize(options?.aspectRatio);
		const fullPrompt = style ? `${prompt}, style: ${style}` : prompt;

		const result = await generateImage({
			model: openai.image(modelId),
			prompt: fullPrompt,
			size,
			n: 1,
			providerOptions: {
				openai: { quality: 'medium' },
			},
		});

		const image = result.images[0];
		if (!image) throw new Error('OpenAI image generation returned no images.');

		if ('url' in image && typeof image.url === 'string') {
			return { url: image.url };
		}

		const base64 = image.base64;
		if (!base64) throw new Error('OpenAI image generation returned no data.');
		return { url: `data:image/png;base64,${base64}` };
	}

	async generateSvg(prompt: string): Promise<{ svgContent: string }> {
		const { generateText } = await import('ai');
		const { createOpenAI } = await import('@ai-sdk/openai');
		const openai = createOpenAI({ apiKey: this.apiKey });

		const { text } = await generateText({
			model: openai('gpt-4o-mini'),
			prompt: `Generate a clean SVG illustration for: ${prompt}
Return ONLY the raw SVG markup starting with <svg and ending with </svg>. No explanation, no markdown.`,
		});

		const svgMatch = text.match(/<svg[\s\S]*<\/svg>/i);
		return { svgContent: svgMatch ? svgMatch[0] : text.trim() };
	}

	async generate(prompt: string, durationSecs: number): Promise<{ url: string }> {
		void durationSecs;
		throw new Error(
			'Background music generation is not supported with the OpenAI gateway. Configure a Replicate API key for BGM.',
		);
	}

	private aspectRatioToSize(aspectRatio?: string): `${number}x${number}` {
		switch (aspectRatio) {
			case '16:9':
				return '1536x1024';
			case '9:16':
				return '1024x1536';
			case '1:1':
			default:
				return '1024x1024';
		}
	}
}
