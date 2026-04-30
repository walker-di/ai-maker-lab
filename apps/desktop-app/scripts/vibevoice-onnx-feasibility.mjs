#!/usr/bin/env bun
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const HF_REPO = 'elbruno/VibeVoice-Realtime-0.5B-ONNX';
const HF_API_URL = `https://huggingface.co/api/models/${HF_REPO}`;

const MIN_REQUIRED_ARTIFACT_CLASSES = [
  {
    className: 'Core graph files',
    examples: [
      'text_encoder.onnx',
      'tts_lm_prefill.onnx',
      'tts_lm_step.onnx',
      'lm_with_kv.onnx',
      'acoustic_decoder.onnx',
    ],
  },
  {
    className: 'ONNX external data companions (when model uses external data)',
    examples: ['*.onnx.data matching each external-data graph'],
  },
  {
    className: 'Model orchestration/config metadata',
    examples: ['config.json', 'model_config.json'],
  },
  {
    className: 'Tokenizer + text preprocessing assets',
    examples: ['tokenizer.json'],
  },
  {
    className: 'Voice preset metadata',
    examples: ['voices/manifest.json', 'voices/*/metadata.json'],
  },
];

const KNOWN_GATEWAY_CANDIDATE_FILES = [
  'config.json',
  'model_config.json',
  'tokenizer.json',
  'text_encoder.onnx',
  'tts_lm_prefill.onnx',
  'tts_lm_step.onnx',
  'lm_with_kv.onnx',
  'text_to_condition.onnx',
  'prediction_head.onnx',
  'eos_classifier.onnx',
  'acoustic_connector.onnx',
  'acoustic_decoder.onnx',
  'voices/manifest.json',
];

function logSection(title) {
  console.log(`\n=== ${title} ===`);
}

function safeString(value, fallback = 'unknown') {
  return value == null || value === '' ? fallback : String(value);
}

function printDisclaimer() {
  logSection('Scope');
  console.log('This diagnostic only inspects runtime/library availability and HF repository metadata.');
  console.log('It does NOT run inference and does NOT download model weights or large artifacts.');
}

async function inspectOnnxRuntimeNodeDirectImport() {
  logSection('Direct onnxruntime-node import check');

  try {
    const pkgJsonPath = require.resolve('onnxruntime-node/package.json');
    const pkgJson = require(pkgJsonPath);

    const mod = await import('onnxruntime-node');
    const ort = mod.default ?? mod;
    const providerResult = typeof ort.getAvailableProviders === 'function'
      ? await ort.getAvailableProviders()
      : [];
    const providers = Array.isArray(providerResult) ? providerResult : [];

    console.log('direct import: OK');
    console.log(`package version: ${safeString(pkgJson.version)}`);
    console.log(`ort.version: ${safeString(ort.version)}`);
    console.log(`providers: ${providers.length ? providers.join(', ') : 'none reported'}`);
    console.log(`ort.env.wasm.numThreads: ${safeString(ort?.env?.wasm?.numThreads)}`);

    return { ok: true, ort };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log('direct import: FAILED');
    console.log(`reason: ${message}`);
    return { ok: false, error: message };
  }
}

async function fetchHfModelMetadata() {
  const response = await fetch(HF_API_URL, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function parseRepoArtifacts(modelApiPayload) {
  const siblings = Array.isArray(modelApiPayload?.siblings) ? modelApiPayload.siblings : [];
  const entries = siblings
    .map((item) => ({
      name: typeof item?.rfilename === 'string' ? item.rfilename : null,
      size: typeof item?.size === 'number' ? item.size : null,
    }))
    .filter((entry) => typeof entry.name === 'string');

  const names = new Set(entries.map((entry) => entry.name));
  const onnxEntries = entries.filter((entry) => entry.name.endsWith('.onnx'));
  const dataEntries = entries.filter((entry) => entry.name.endsWith('.onnx.data'));

  return {
    totalSiblingCount: siblings.length,
    names,
    onnxEntries,
    dataEntries,
  };
}

function printRequiredArtifactClasses() {
  logSection('Minimum required artifact classes (future gateway)');
  for (const group of MIN_REQUIRED_ARTIFACT_CLASSES) {
    console.log(`- ${group.className}`);
    for (const example of group.examples) {
      console.log(`  - ${example}`);
    }
  }
}

function validateCandidateFiles(names) {
  logSection('Known candidate file presence');
  const present = [];
  const missing = [];

  for (const file of KNOWN_GATEWAY_CANDIDATE_FILES) {
    if (names.has(file)) {
      present.push(file);
    } else {
      missing.push(file);
    }
  }

  console.log(`present (${present.length}):`);
  for (const file of present) console.log(`- ${file}`);

  console.log(`\nmissing (${missing.length}):`);
  for (const file of missing) console.log(`- ${file}`);

  return { present, missing };
}

function validateOnnxDataCompanions(onnxEntries, dataEntries, names) {
  logSection('ONNX <-> ONNX.DATA companion validation');

  if (!onnxEntries.length) {
    console.log('No .onnx files found in metadata snapshot.');
    return { missingGraphForData: [], paired: [], unpairedOnnx: [] };
  }

  const paired = [];
  const unpairedOnnx = [];
  for (const entry of onnxEntries) {
    const expectedData = `${entry.name}.data`;
    if (names.has(expectedData)) {
      paired.push({ onnx: entry.name, data: expectedData });
      continue;
    }

    const largeGraph = typeof entry.size === 'number' && entry.size > 1_500_000_000;
    unpairedOnnx.push({
      onnx: entry.name,
      expectedData,
      note: largeGraph
        ? 'Large graph with no matching .onnx.data in metadata; verify packaging strategy before inference.'
        : 'No matching .onnx.data detected (may be self-contained graph).',
    });
  }

  const missingGraphForData = [];
  for (const dataFile of dataEntries) {
    const expectedGraph = dataFile.name.slice(0, -'.data'.length);
    if (!names.has(expectedGraph)) {
      missingGraphForData.push({ data: dataFile.name, expectedGraph });
    }
  }

  console.log(`pairs detected (${paired.length}):`);
  for (const pair of paired) {
    console.log(`- ${pair.onnx} <-> ${pair.data}`);
  }

  console.log(`\nonnx files without matched .data (${unpairedOnnx.length}):`);
  for (const row of unpairedOnnx) {
    console.log(`- ${row.onnx}`);
    console.log(`  expected companion: ${row.expectedData}`);
    console.log(`  note: ${row.note}`);
  }

  console.log(`\n.data files missing base .onnx (${missingGraphForData.length}):`);
  for (const row of missingGraphForData) {
    console.log(`- ${row.data}`);
    console.log(`  expected base graph: ${row.expectedGraph}`);
  }

  return { missingGraphForData, paired, unpairedOnnx };
}

function printVoicePresetDiscovery(names) {
  const voicePresets = Array.from(names)
    .filter((name) => name.startsWith('voices/') && name.endsWith('/metadata.json'))
    .map((name) => name.slice('voices/'.length, -'/metadata.json'.length))
    .sort();

  logSection('Voice preset discovery');
  console.log(`voice presets discovered: ${voicePresets.length}`);
  for (const preset of voicePresets) {
    console.log(`- ${preset}`);
  }
}

async function run() {
  console.log('VibeVoice ONNX feasibility diagnostic');
  console.log(`runtime: bun ${Bun.version}`);
  console.log(`platform: ${process.platform}/${process.arch}`);
  printDisclaimer();

  const ortResult = await inspectOnnxRuntimeNodeDirectImport();

  logSection('Hugging Face lightweight metadata');
  let parsedArtifacts = null;
  try {
    const modelApi = await fetchHfModelMetadata();
    parsedArtifacts = parseRepoArtifacts(modelApi);
    console.log(`repo: ${safeString(modelApi?.id, HF_REPO)}`);
    console.log(`siblings in metadata: ${parsedArtifacts.totalSiblingCount}`);
    console.log(`.onnx files observed: ${parsedArtifacts.onnxEntries.length}`);
    console.log(`.onnx.data files observed: ${parsedArtifacts.dataEntries.length}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`metadata fetch failed: ${message}`);
  }

  printRequiredArtifactClasses();

  if (parsedArtifacts) {
    validateCandidateFiles(parsedArtifacts.names);
    validateOnnxDataCompanions(
      parsedArtifacts.onnxEntries,
      parsedArtifacts.dataEntries,
      parsedArtifacts.names
    );
    printVoicePresetDiscovery(parsedArtifacts.names);
  }

  logSection('Feasibility signal');
  if (!ortResult.ok) {
    console.log('Result: BLOCKED (direct onnxruntime-node import failed).');
    console.log('Action: ensure package install/runtime compatibility before gateway implementation.');
    process.exitCode = 1;
    return;
  }

  console.log('Result: VIABLE for continued gateway prototyping.');
  console.log('Constraints: this script performs metadata-only diagnostics (no inference, no large downloads).');
}

await run();
