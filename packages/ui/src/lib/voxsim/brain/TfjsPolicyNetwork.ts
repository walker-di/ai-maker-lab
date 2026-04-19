/**
 * Browser MLP policy backed by `@tensorflow/tfjs`.
 *
 * Lazy-loads `@tensorflow/tfjs` on first `init` so the engine bundle stays
 * thin for users who only render arenas. The Node worker variant lives in
 * `packages/domain/src/infrastructure/voxsim/training/` and imports
 * `@tensorflow/tfjs-node` instead.
 */

import {
  buildWeightLayout,
  decoderTotalWidth,
  encoderTotalWidth,
  isNeatTopology,
  layoutTotalLength,
  type ActivationKind,
  type BrainDna,
  type LayerSpec,
  type NeatGenome,
  type WeightLayout,
} from './types.js';
import {
  FIXED_ONLY_METHODS_ERROR,
  NEAT_ONLY_METHODS_ERROR,
  type ActivationFrame,
  type PolicyNetwork,
  type PolicyTapHandle,
} from './policy.js';
import { createMulberry32 } from './prng.js';
import { runDecoder, runEncoder } from './runtime.js';

type TfModule = typeof import('@tensorflow/tfjs');

let tfPromise: Promise<TfModule> | null = null;
function loadTf(): Promise<TfModule> {
  if (!tfPromise) {
    tfPromise = import('@tensorflow/tfjs').then(async (mod) => {
      // Best-effort backend selection: webgl preferred, fall back to cpu.
      try {
        await mod.setBackend('webgl');
        await mod.ready();
      } catch {
        await mod.setBackend('cpu');
        await mod.ready();
      }
      return mod;
    });
  }
  return tfPromise;
}

function activationToTfjs(kind: ActivationKind): string {
  switch (kind) {
    case 'leakyRelu':
      // tfjs uses 'leakyReLU' label; we manually wrap it as a layer below.
      return 'linear';
    case 'softplus':
      return 'softplus';
    case 'relu':
      return 'relu';
    case 'tanh':
      return 'tanh';
    case 'sigmoid':
      return 'sigmoid';
    case 'linear':
    default:
      return 'linear';
  }
}

export class TfjsPolicyNetwork implements PolicyNetwork {
  private dna: BrainDna | null = null;
  private layout: WeightLayout | null = null;
  private inputWidth = 0;
  private outputWidth = 0;
  private weights: Float32Array | null = null;
  private model: import('@tensorflow/tfjs').Sequential | null = null;
  private tf: TfModule | null = null;
  private inputTensor: import('@tensorflow/tfjs').Tensor2D | null = null;
  private rawOutputScratch: Float32Array | null = null;
  private encodedScratch: Float32Array | null = null;
  private taps: Set<(frame: ActivationFrame) => void> = new Set();

  async init(dna: BrainDna): Promise<void> {
    if (isNeatTopology(dna.topology)) {
      throw new Error(`TfjsPolicyNetwork does not support topology ${dna.topology}`);
    }
    this.dna = dna;
    this.inputWidth = encoderTotalWidth(dna.inputEncoder);
    this.outputWidth = decoderTotalWidth(dna.outputDecoder);
    this.layout = buildWeightLayout(dna.layers, this.inputWidth, this.outputWidth);
    this.encodedScratch = new Float32Array(this.inputWidth);
    this.rawOutputScratch = new Float32Array(this.outputWidth);
    this.tf = await loadTf();
    this.model = this.buildModel(this.tf, dna.layers, this.inputWidth);
    this.inputTensor = this.tf.tensor2d(new Float32Array(this.inputWidth), [1, this.inputWidth]);
    // Initialize weights deterministically from the seed so browser and worker
    // stay byte-identical regardless of TFJS's own initializer pipeline.
    const initialWeights = this.sampleInitialWeights(dna.seed, layoutTotalLength(this.layout));
    this.setWeights(initialWeights);
  }

  private buildModel(
    tf: TfModule,
    layers: readonly LayerSpec[],
    inputWidth: number,
  ): import('@tensorflow/tfjs').Sequential {
    const model = tf.sequential();
    let isFirst = true;
    for (const layer of layers) {
      if (layer.kind === 'dense') {
        model.add(
          tf.layers.dense({
            units: layer.units,
            activation: activationToTfjs(layer.activation) as never,
            useBias: layer.useBias,
            inputShape: isFirst ? [inputWidth] : undefined,
          }),
        );
        isFirst = false;
      } else {
        throw new Error(`Unsupported layer kind for TfjsPolicyNetwork v1: ${layer.kind}`);
      }
    }
    return model;
  }

  private sampleInitialWeights(seed: number, totalLength: number): Float32Array {
    const buffer = new Float32Array(totalLength);
    const rng = createMulberry32(seed);
    // Glorot-ish small-scale init keeps activations stable even before training.
    const scale = 0.1;
    for (let i = 0; i < totalLength; i++) {
      buffer[i] = rng.nextGaussian() * scale;
    }
    return buffer;
  }

  setWeights(weights: Float32Array): void {
    if (!this.model || !this.layout || !this.tf) {
      throw new Error('TfjsPolicyNetwork.setWeights called before init');
    }
    if (weights.length !== layoutTotalLength(this.layout)) {
      throw new Error(
        `weight buffer length ${weights.length} does not match layout total ${layoutTotalLength(this.layout)}`,
      );
    }
    this.weights = new Float32Array(weights); // keep our own copy
    // Walk dense layers in order and assign kernels/biases from the layout.
    let entryIndex = 0;
    for (const layer of this.model.layers) {
      const kind = (layer.getClassName?.() ?? '').toLowerCase();
      if (kind === 'dense') {
        const tensors: import('@tensorflow/tfjs').Tensor[] = [];
        const kernelEntry = this.layout.entries[entryIndex++];
        const kernelData = this.weights.subarray(
          kernelEntry.offset,
          kernelEntry.offset + kernelEntry.length,
        );
        tensors.push(this.tf.tensor(kernelData, kernelEntry.shape));
        const denseLayer = layer as unknown as { useBias: boolean };
        if (denseLayer.useBias) {
          const biasEntry = this.layout.entries[entryIndex++];
          const biasData = this.weights.subarray(
            biasEntry.offset,
            biasEntry.offset + biasEntry.length,
          );
          tensors.push(this.tf.tensor(biasData, biasEntry.shape));
        }
        layer.setWeights(tensors);
        for (const t of tensors) t.dispose();
      }
    }
  }

  getWeights(): Float32Array {
    if (!this.weights) throw new Error('TfjsPolicyNetwork.getWeights called before setWeights');
    return new Float32Array(this.weights);
  }

  setGenome(_genome: NeatGenome): void {
    throw new Error(NEAT_ONLY_METHODS_ERROR);
  }

  getGenome(): NeatGenome {
    throw new Error(NEAT_ONLY_METHODS_ERROR);
  }

  act(observation: Float32Array, scratchAction: Float32Array): void {
    if (!this.dna || !this.model || !this.tf || !this.inputTensor || !this.encodedScratch || !this.rawOutputScratch) {
      throw new Error('TfjsPolicyNetwork.act called before init');
    }
    runEncoder(observation, this.dna.inputEncoder, this.encodedScratch);
    // Copy encoded scratch into the persistent input tensor's data.
    const tf = this.tf;
    const result = tf.tidy(() => {
      const input = tf.tensor2d(this.encodedScratch as Float32Array, [1, this.inputWidth]);
      const out = this.model!.predict(input) as import('@tensorflow/tfjs').Tensor;
      return out;
    });
    const data = result.dataSync() as Float32Array;
    for (let i = 0; i < this.outputWidth; i++) this.rawOutputScratch[i] = data[i];
    result.dispose();
    runDecoder(this.rawOutputScratch, this.dna.outputDecoder, scratchAction);
    if (this.taps.size > 0) {
      const frame: ActivationFrame = {
        kind: 'mlp',
        layerActivations: [new Float32Array(this.rawOutputScratch)],
      };
      for (const cb of this.taps) cb(frame);
    }
  }

  actBatch(observations: Float32Array, batchSize: number, scratchActions: Float32Array): void {
    if (!this.dna || !this.model || !this.tf || !this.encodedScratch) {
      throw new Error('TfjsPolicyNetwork.actBatch called before init');
    }
    if (observations.length !== batchSize * this.inputWidth) {
      throw new Error('observations length must equal batchSize * inputWidth');
    }
    if (scratchActions.length !== batchSize * this.outputWidth) {
      throw new Error('scratchActions length must equal batchSize * outputWidth');
    }
    const encoded = new Float32Array(batchSize * this.inputWidth);
    for (let i = 0; i < batchSize; i++) {
      runEncoder(
        observations.subarray(i * this.inputWidth, (i + 1) * this.inputWidth),
        this.dna.inputEncoder,
        this.encodedScratch,
      );
      encoded.set(this.encodedScratch, i * this.inputWidth);
    }
    const tf = this.tf;
    const result = tf.tidy(() => {
      const input = tf.tensor2d(encoded, [batchSize, this.inputWidth]);
      const out = this.model!.predict(input) as import('@tensorflow/tfjs').Tensor;
      return out;
    });
    const flat = result.dataSync() as Float32Array;
    result.dispose();
    const rawRow = new Float32Array(this.outputWidth);
    for (let i = 0; i < batchSize; i++) {
      for (let j = 0; j < this.outputWidth; j++) {
        rawRow[j] = flat[i * this.outputWidth + j];
      }
      runDecoder(
        rawRow,
        this.dna.outputDecoder,
        scratchActions.subarray(i * this.outputWidth, (i + 1) * this.outputWidth),
      );
    }
  }

  resetEpisodeState(): void {
    // No recurrent state in v1.
  }

  tap(cb: (frame: ActivationFrame) => void): PolicyTapHandle {
    this.taps.add(cb);
    return {
      dispose: () => {
        this.taps.delete(cb);
      },
    };
  }

  dispose(): void {
    this.inputTensor?.dispose();
    this.inputTensor = null;
    this.model?.dispose();
    this.model = null;
    this.weights = null;
    this.taps.clear();
  }

  // Test helper, not part of PolicyNetwork.
  __layoutForTest(): WeightLayout {
    if (!this.layout) throw new Error('init not called');
    return this.layout;
  }
}

export const __tfjsErrors = {
  FIXED_ONLY_METHODS_ERROR,
  NEAT_ONLY_METHODS_ERROR,
};
