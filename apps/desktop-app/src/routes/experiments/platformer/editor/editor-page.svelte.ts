import type { Platformer as DomainPlatformer } from 'domain/shared';
import { Platformer } from 'ui/source';
import type { PlatformerTransport } from '$lib/adapters/platformer/PlatformerTransport';

type ResolvedMapEntry = DomainPlatformer.ResolvedMapEntry;
type MapDefinition = DomainPlatformer.MapDefinition;
type MapMetadata = DomainPlatformer.MapMetadata;

const { createMapEditorModel, emptyMap } = Platformer;

export interface EditorPageDeps {
  transport: PlatformerTransport;
}

export function createEditorPageModel({ transport }: EditorPageDeps) {
  let catalog = $state<ResolvedMapEntry[]>([]);
  let currentEntryId = $state<string | null>(null);
  let saving = $state(false);
  let isLoading = $state(false);
  let errorMessage = $state<string | null>(null);
  let status = $state<string | null>(null);

  const editor = createMapEditorModel({
    requestSave: () => void save(),
    requestSaveAs: () => void saveAs(),
    requestNew: () => resetToEmpty(),
    requestLoad: (id: string) => void loadEntry(id),
    requestDuplicateBuiltIn: (id: string) => void duplicate(id),
  });

  async function bootstrap() {
    if (isLoading) return;
    isLoading = true;
    errorMessage = null;
    try {
      catalog = await transport.listMaps({ source: 'all' });
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Failed to load catalog';
    } finally {
      isLoading = false;
    }
  }

  function resetToEmpty() {
    const fresh = emptyMap();
    const meta: MapMetadata = {
      title: 'Untitled',
      author: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: 'user',
    };
    editor.setMap(fresh as MapDefinition, meta);
    currentEntryId = null;
    status = null;
  }

  async function loadEntry(id: string) {
    const entry = catalog.find((c) => c.id === id) ?? (await transport.getMap(id));
    if (!entry) {
      errorMessage = `Map '${id}' not found`;
      return;
    }
    editor.setMap(entry.definition, entry.metadata);
    currentEntryId = entry.source === 'user' ? entry.id : null;
    status = null;
  }

  async function save() {
    await persist({ id: currentEntryId ?? undefined });
  }

  async function saveAs() {
    await persist({ id: undefined });
  }

  async function persist(opts: { id?: string }) {
    if (editor.validation.errors.length > 0) {
      errorMessage = `Cannot save: ${editor.validation.errors[0]?.message ?? 'invalid map'}`;
      return;
    }
    saving = true;
    errorMessage = null;
    try {
      const saved = await transport.saveUserMap({
        id: opts.id,
        metadata: editor.metadata,
        definition: editor.map,
      });
      currentEntryId = saved.id;
      catalog = mergeEntry(catalog, saved);
      editor.dirty = false;
      status = `Saved "${saved.metadata.title}"`;
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Save failed';
    } finally {
      saving = false;
    }
  }

  async function duplicate(id: string) {
    saving = true;
    errorMessage = null;
    try {
      const dup = await transport.duplicateBuiltIn(id);
      currentEntryId = dup.id;
      catalog = mergeEntry(catalog, dup);
      editor.setMap(dup.definition, dup.metadata);
      status = `Duplicated "${dup.metadata.title}"`;
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Duplicate failed';
    } finally {
      saving = false;
    }
  }

  return {
    get catalog() { return catalog; },
    get currentEntryId() { return currentEntryId; },
    get isLoading() { return isLoading; },
    get errorMessage() { return errorMessage; },
    get saving() { return saving; },
    get dirty() { return editor.dirty; },
    get status() { return status; },
    get editor() { return editor; },
    bootstrap,
    loadEntry,
    save,
    saveAs,
    resetToEmpty,
    duplicate,
  };
}

function mergeEntry(list: ResolvedMapEntry[], entry: ResolvedMapEntry): ResolvedMapEntry[] {
  const idx = list.findIndex((c) => c.id === entry.id);
  if (idx < 0) return [...list, entry];
  return list.map((c, i) => (i === idx ? entry : c));
}

export type EditorPageModel = ReturnType<typeof createEditorPageModel>;
