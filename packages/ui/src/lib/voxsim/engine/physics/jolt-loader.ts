/**
 * Lazy WASM loader for `jolt-physics`. The rest of the engine talks to
 * `JoltSystem`, never the raw `jolt-physics` module — this file is the only
 * place where the import lives.
 *
 * The runtime is cached per-process; repeated `mount`/`init` calls reuse the
 * same module instance to avoid re-instantiating the WASM heap.
 */

export interface JoltLoaderOptions {
  /**
   * Resolves a WASM asset filename to a fetchable URL. Defaults to the path
   * the loader will use against the Vite/SvelteKit static asset directory:
   * `/voxsim/jolt/{file}`. Callers running under Electrobun/packaged builds
   * should pass an explicit `views://mainview/voxsim/jolt/{file}` resolver.
   */
  locateFile?: (file: string) => string;
}

export type JoltModule = typeof import('jolt-physics').default extends infer F
  ? F extends (...args: any[]) => Promise<infer M>
    ? M
    : never
  : never;

export interface JoltRuntime {
  Jolt: JoltModule;
  /** Convenience: a wrapper around `new Jolt.Vec3` for write paths. */
  vec3: (x: number, y: number, z: number) => any;
  /** Convenience: a wrapper around `new Jolt.Quat` for write paths. */
  quat: (x: number, y: number, z: number, w: number) => any;
}

let cachedPromise: Promise<JoltRuntime> | null = null;
let lastLocateKey: string | null = null;

function locateKeyFor(opts: JoltLoaderOptions): string {
  const probe = opts.locateFile ? opts.locateFile('jolt-physics.wasm') : '__default__';
  return probe;
}

export async function loadJolt(options: JoltLoaderOptions = {}): Promise<JoltRuntime> {
  const key = locateKeyFor(options);
  if (cachedPromise && lastLocateKey === key) return cachedPromise;
  lastLocateKey = key;
  cachedPromise = (async () => {
    const mod = await import('jolt-physics');
    const factory = (mod as any).default as (target?: any) => Promise<any>;
    const target: { locateFile?: (file: string) => string } = {};
    if (options.locateFile) target.locateFile = options.locateFile;
    else target.locateFile = (file: string) => `/voxsim/jolt/${file}`;
    const Jolt = await factory(target);
    return {
      Jolt,
      vec3: (x: number, y: number, z: number) => new Jolt.Vec3(x, y, z),
      quat: (x: number, y: number, z: number, w: number) => new Jolt.Quat(x, y, z, w),
    };
  })();
  return cachedPromise;
}

/**
 * Test-only helper: reset the cached runtime. Production code never calls
 * this; tests use it to verify that distinct `locateFile` resolvers produce
 * distinct loader invocations.
 */
export function __resetJoltLoaderCache(): void {
  cachedPromise = null;
  lastLocateKey = null;
}
