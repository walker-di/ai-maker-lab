import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import type { Marketing } from 'domain/application';

const execFileAsync = promisify(execFile);

interface FfmpegMarketingVideoExporterConfig {
  ffmpegPath?: string;
  ffprobePath?: string;
  tempDir: string;
  publicBaseUrl: string;
}

export class FfmpegMarketingVideoExporter implements Marketing.IVideoExporter {
  private readonly ffmpeg: string;

  constructor(private readonly config: FfmpegMarketingVideoExporterConfig) {
    this.ffmpeg = config.ffmpegPath ?? 'ffmpeg';
  }

  async exportClip(params: {
    imageUrl?: string;
    narrationUrl?: string;
    durationMs: number;
    outputPath: string;
  }): Promise<{ videoPath: string }> {
    const { imageUrl, narrationUrl, durationMs, outputPath } = params;
    const durationSecs = durationMs / 1000;

    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    const args: string[] = ['-y', '-hide_banner', '-loglevel', 'warning'];

    if (imageUrl) {
      args.push('-loop', '1', '-i', imageUrl);
    } else {
      args.push('-f', 'lavfi', '-i', 'color=black:s=1280x720:r=30');
    }

    if (narrationUrl) {
      args.push('-i', narrationUrl);
      args.push('-c:v', 'libx264', '-c:a', 'aac');
      args.push('-shortest');
    } else {
      args.push('-c:v', 'libx264', '-an');
    }

    args.push('-t', String(durationSecs));
    args.push('-pix_fmt', 'yuv420p');
    args.push('-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2');
    args.push(outputPath);

    await execFileAsync(this.ffmpeg, args);
    return { videoPath: outputPath };
  }

  async exportStory(params: {
    clips: { videoPath: string; durationMs: number }[];
    bgmUrl?: string;
    outputPath: string;
  }): Promise<{ videoPath: string; durationMs: number }> {
    const { clips, bgmUrl, outputPath } = params;

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.mkdir(this.config.tempDir, { recursive: true });

    const concatListPath = path.join(this.config.tempDir, `concat-${Date.now()}.txt`);
    const concatContent = clips.map(c => `file '${c.videoPath}'`).join('\n');
    await fs.writeFile(concatListPath, concatContent);

    const totalDurationMs = clips.reduce((sum, c) => sum + c.durationMs, 0);
    const concatenatedPath = path.join(this.config.tempDir, `concat-${Date.now()}.mp4`);

    await execFileAsync(this.ffmpeg, [
      '-y', '-hide_banner', '-loglevel', 'warning',
      '-f', 'concat', '-safe', '0', '-i', concatListPath,
      '-c', 'copy',
      concatenatedPath,
    ]);

    if (bgmUrl) {
      const totalSecs = totalDurationMs / 1000;
      await execFileAsync(this.ffmpeg, [
        '-y', '-hide_banner', '-loglevel', 'warning',
        '-i', concatenatedPath,
        '-stream_loop', '-1', '-i', bgmUrl,
        '-filter_complex', '[1:a]volume=0.3[bgm];[0:a][bgm]amix=inputs=2:duration=first[aout]',
        '-map', '0:v', '-map', '[aout]',
        '-c:v', 'copy', '-c:a', 'aac',
        '-t', String(totalSecs),
        outputPath,
      ]);
    } else {
      await fs.copyFile(concatenatedPath, outputPath);
    }

    await Promise.allSettled([
      fs.unlink(concatListPath),
      fs.unlink(concatenatedPath),
    ]);

    return { videoPath: outputPath, durationMs: totalDurationMs };
  }
}
