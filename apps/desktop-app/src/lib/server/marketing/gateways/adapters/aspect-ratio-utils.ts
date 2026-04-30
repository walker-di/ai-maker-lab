const RATIO_MAP: Record<string, { width: number; height: number }> = {
  '1:1': { width: 1024, height: 1024 },
  '16:9': { width: 1344, height: 768 },
  '9:16': { width: 768, height: 1344 },
  '4:5': { width: 896, height: 1120 },
  '5:4': { width: 1120, height: 896 },
  '3:2': { width: 1216, height: 832 },
  '2:3': { width: 832, height: 1216 },
  '4:3': { width: 1152, height: 896 },
  '3:4': { width: 896, height: 1152 },
};

export function aspectRatioToDimensions(ratio?: string): { width: number; height: number } {
  if (!ratio) return RATIO_MAP['1:1'];
  const result = RATIO_MAP[ratio];
  if (result) return result;

  const match = ratio.match(/^(\d+):(\d+)$/);
  if (match) {
    const w = parseInt(match[1], 10);
    const h = parseInt(match[2], 10);
    const scale = Math.sqrt((1024 * 1024) / (w * h));
    return {
      width: Math.round((w * scale) / 64) * 64,
      height: Math.round((h * scale) / 64) * 64,
    };
  }

  return RATIO_MAP['1:1'];
}
