import type { PerspectiveCamera, Scene } from 'three';

/**
 * Renderer surface the engine talks to. The default WebGL implementation in
 * `web-renderer.ts` constructs a Three `WebGLRenderer`. Headless tests and
 * training workers pass `NullRenderer` (or `null`) to skip GPU work.
 *
 * Three's `WebGLRenderer` does not exist in Node, so the engine never
 * constructs one until the page model calls `mount(canvas)` with a real
 * `HTMLCanvasElement`.
 */
export interface EngineRenderer {
  mount(target: HTMLCanvasElement): Promise<void>;
  resize(width: number, height: number, pixelRatio?: number): void;
  render(scene: Scene, camera: PerspectiveCamera): void;
  dispose(): void;
}

/** No-op renderer used in headless tests and worker contexts. */
export class NullRenderer implements EngineRenderer {
  async mount(): Promise<void> {}
  resize(): void {}
  render(): void {}
  dispose(): void {}
}

export interface WebRendererOptions {
  pixelRatio?: number;
  antialias?: boolean;
  clearColor?: number;
  clearAlpha?: number;
}

/**
 * Async factory for the default WebGL renderer. Returning a factory keeps
 * `three`'s `WebGLRenderer` constructor out of module evaluation paths so
 * Node tests can import the engine module without touching WebGL.
 */
export function createWebRendererFactory(
  options: WebRendererOptions = {},
): () => Promise<EngineRenderer> {
  return async () => {
    const three = await import('three');
    return new WebRenderer(three, options);
  };
}

class WebRenderer implements EngineRenderer {
  private renderer: import('three').WebGLRenderer | null = null;
  private readonly three: typeof import('three');
  private readonly options: WebRendererOptions;

  constructor(three: typeof import('three'), options: WebRendererOptions) {
    this.three = three;
    this.options = options;
  }

  async mount(target: HTMLCanvasElement): Promise<void> {
    const renderer = new this.three.WebGLRenderer({
      canvas: target,
      antialias: this.options.antialias ?? true,
    });
    renderer.setPixelRatio(this.options.pixelRatio ?? (typeof window !== 'undefined' ? window.devicePixelRatio : 1));
    renderer.setClearColor(this.options.clearColor ?? 0x202535, this.options.clearAlpha ?? 1);
    this.renderer = renderer;
    this.resize(target.clientWidth || target.width, target.clientHeight || target.height);
  }

  resize(width: number, height: number, pixelRatio?: number): void {
    if (!this.renderer) return;
    if (pixelRatio !== undefined) this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(Math.max(1, width), Math.max(1, height), false);
  }

  render(scene: Scene, camera: PerspectiveCamera): void {
    if (!this.renderer) return;
    this.renderer.render(scene, camera);
  }

  dispose(): void {
    this.renderer?.dispose();
    this.renderer = null;
  }
}
