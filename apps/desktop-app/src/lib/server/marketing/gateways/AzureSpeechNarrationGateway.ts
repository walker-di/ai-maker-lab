import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Marketing } from 'domain/application';

interface AzureSpeechNarrationGatewayConfig {
  apiKey: string;
  region: string;
  voice: string;
  outputDir: string;
}

const AZURE_NEURAL_VOICES = [
  { id: 'en-US-JennyNeural', name: 'Jenny', lang: 'en-US', gender: 'female' },
  { id: 'en-US-GuyNeural', name: 'Guy', lang: 'en-US', gender: 'male' },
  { id: 'en-US-AriaNeural', name: 'Aria', lang: 'en-US', gender: 'female' },
  { id: 'en-US-DavisNeural', name: 'Davis', lang: 'en-US', gender: 'male' },
  { id: 'en-GB-SoniaNeural', name: 'Sonia', lang: 'en-GB', gender: 'female' },
  { id: 'en-GB-RyanNeural', name: 'Ryan', lang: 'en-GB', gender: 'male' },
  { id: 'ja-JP-NanamiNeural', name: 'Nanami', lang: 'ja-JP', gender: 'female' },
  { id: 'ja-JP-KeitaNeural', name: 'Keita', lang: 'ja-JP', gender: 'male' },
  { id: 'zh-CN-XiaoxiaoNeural', name: 'Xiaoxiao', lang: 'zh-CN', gender: 'female' },
  { id: 'zh-CN-YunxiNeural', name: 'Yunxi', lang: 'zh-CN', gender: 'male' },
  { id: 'ko-KR-SunHiNeural', name: 'SunHi', lang: 'ko-KR', gender: 'female' },
  { id: 'ko-KR-InJoonNeural', name: 'InJoon', lang: 'ko-KR', gender: 'male' },
  { id: 'es-ES-ElviraNeural', name: 'Elvira', lang: 'es-ES', gender: 'female' },
  { id: 'fr-FR-DeniseNeural', name: 'Denise', lang: 'fr-FR', gender: 'female' },
  { id: 'de-DE-KatjaNeural', name: 'Katja', lang: 'de-DE', gender: 'female' },
  { id: 'pt-BR-FranciscaNeural', name: 'Francisca', lang: 'pt-BR', gender: 'female' },
];

export class AzureSpeechNarrationGateway implements Marketing.INarrationAudioGateway {
  constructor(private readonly config: AzureSpeechNarrationGatewayConfig) {}

  async synthesize(
    text: string,
    voice: string,
    lang?: string,
  ): Promise<{ audioUrl: string; durationMs: number }> {
    const voiceName = voice || this.config.voice;
    const langCode = lang ?? voiceName.split('-').slice(0, 2).join('-');

    const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
      this.config.apiKey,
      this.config.region,
    );
    speechConfig.speechSynthesisVoiceName = voiceName;
    speechConfig.speechSynthesisOutputFormat =
      SpeechSDK.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3;

    const escapedText = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${langCode}">
      <voice name="${voiceName}">${escapedText}</voice>
    </speak>`;

    let synthesizer: SpeechSDK.SpeechSynthesizer | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      synthesizer = new SpeechSDK.SpeechSynthesizer(speechConfig, undefined as any);

      const result = await new Promise<SpeechSDK.SpeechSynthesisResult>((resolve, reject) => {
        synthesizer!.speakSsmlAsync(
          ssml,
          (r: SpeechSDK.SpeechSynthesisResult) => {
            if (r.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
              resolve(r);
            } else {
              const details = SpeechSDK.CancellationDetails.fromResult(r);
              reject(new Error(`TTS failed: ${details.errorDetails}`));
            }
          },
          (err: string) => reject(new Error(`TTS error: ${err}`)),
        );
      });

      const audioBuffer = Buffer.from(result.audioData);
      await fs.mkdir(this.config.outputDir, { recursive: true });

      const filename = `narration-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp3`;
      const filePath = path.join(this.config.outputDir, filename);
      await fs.writeFile(filePath, audioBuffer);

      // audioDuration is in 100-nanosecond ticks; convert to ms
      const durationMs = Math.round(result.audioDuration / 10000);

      return { audioUrl: filePath, durationMs };
    } finally {
      if (synthesizer) synthesizer.close();
    }
  }

  async listVoices(): Promise<{ id: string; name: string; lang: string; gender: string }[]> {
    return AZURE_NEURAL_VOICES;
  }
}
