import { afterEach, beforeEach, describe as vitestDescribe, expect, test, vi } from 'vitest';
import { flushSync } from 'svelte';
import type { RtsTransport } from '$lib/adapters/rts/RtsTransport';

const describe = typeof Bun !== 'undefined' ? vitestDescribe.skip : vitestDescribe;

const rtsMock = vi.hoisted(() => {
	type Listener = (payload: unknown) => void;
	type MissionPhase = 'opening' | 'build-up' | 'defense' | 'victory' | 'defeat';
	type MissionPressure = 'stable' | 'rising' | 'high' | 'critical';
	type MissionWaveStatus = 'forming' | 'cooldown' | 'imminent' | 'inbound' | 'resolved';

	function cloneMission<T>(value: T): T {
		return JSON.parse(JSON.stringify(value)) as T;
	}

	const TECH_STATS = {
		armorT1: { label: 'Armor I', cost: { mineral: 100, gas: 50 } },
		armorT2: { label: 'Armor II', cost: { mineral: 175, gas: 100 } },
		weaponT1: { label: 'Weapons I', cost: { mineral: 100, gas: 50 } },
		weaponT2: { label: 'Weapons II', cost: { mineral: 175, gas: 100 } },
		sightRange: { label: 'Advanced Optics', cost: { mineral: 75, gas: 75 } },
	};

	class MockRtsEngine {
		readonly world = { isAlive: () => true };
		readonly map: Record<string, unknown>;
		elapsedMs = 0;
		readonly emitter = new MockEmitter(this);
		private mission = {
			objectiveTitle: 'Hold the line',
			objectiveDetail: 'Protect your HQ, absorb enemy attack waves, and destroy the hostile base.',
			phase: 'opening' as MissionPhase,
			pressure: 'stable' as MissionPressure,
			pressureLabel: 'Perimeter stable',
			enemyActivity: {
				factionId: 'p2',
				activeCombatUnits: 0,
				wavesLaunched: 0,
				lastWaveSize: null as number | null,
				lastWaveAtMs: null as number | null,
				cadenceMs: 30_000,
				countdownMs: null as number | null,
				status: 'forming' as MissionWaveStatus,
				statusLabel: 'Enemy wave building',
			},
		};

		constructor({ map }: { map: Record<string, unknown> }) {
			this.map = map;
			latestEngine = this;
		}

		private setMissionStatus(status: MissionWaveStatus, label: string): void {
			this.mission.enemyActivity.status = status;
			this.mission.enemyActivity.statusLabel = label;
		}

		private syncMissionClock(): void {
			const { cadenceMs, lastWaveAtMs, status } = this.mission.enemyActivity;
			if (this.mission.phase === 'victory' || this.mission.phase === 'defeat') {
				this.mission.enemyActivity.countdownMs = null;
				this.setMissionStatus('resolved', this.mission.phase === 'victory' ? 'Threat neutralized' : 'Defense broken');
				return;
			}
			if (cadenceMs != null && lastWaveAtMs != null) {
				this.mission.enemyActivity.countdownMs = Math.max(0, lastWaveAtMs + cadenceMs - this.elapsedMs);
			} else {
				this.mission.enemyActivity.countdownMs = null;
			}
			if (status !== 'inbound') {
				if (this.mission.enemyActivity.countdownMs == null) this.setMissionStatus('forming', 'Enemy wave building');
				else if (this.mission.enemyActivity.countdownMs <= 10_000) this.setMissionStatus('imminent', `Next wave in ${Math.ceil(this.mission.enemyActivity.countdownMs / 1000)}s`);
				else this.setMissionStatus('cooldown', `Next wave in ${Math.ceil(this.mission.enemyActivity.countdownMs / 1000)}s`);
			}
		}

		applyEvent(type: string, payload: any): void {
			if (type === 'squadLaunched') {
				const launchAtMs = payload.launchedAtMs ?? this.elapsedMs;
				this.mission.phase = 'defense';
				this.mission.pressure = 'high';
				this.mission.pressureLabel = 'Frontline under pressure';
				this.mission.enemyActivity.activeCombatUnits = payload.size;
				this.mission.enemyActivity.wavesLaunched = payload.waveIndex;
				this.mission.enemyActivity.lastWaveSize = payload.size;
				this.mission.enemyActivity.lastWaveAtMs = launchAtMs;
				this.mission.enemyActivity.cadenceMs = payload.cadenceMs ?? this.mission.enemyActivity.cadenceMs;
				this.mission.enemyActivity.countdownMs = this.mission.enemyActivity.cadenceMs;
				this.setMissionStatus('inbound', `Wave ${payload.waveIndex} is in contact`);
			}
			if (type === 'combatAlert' && payload.factionId === 'p1' && payload.severity === 'danger') {
				this.mission.phase = 'defense';
				this.mission.pressure = 'critical';
				this.mission.pressureLabel = 'Base under heavy fire';
				this.mission.enemyActivity.activeCombatUnits = Math.max(this.mission.enemyActivity.activeCombatUnits, this.mission.enemyActivity.lastWaveSize ?? 1);
			}
			if (type === 'matchEnded') {
				this.mission.phase = payload.winner === 'p1' ? 'victory' : 'defeat';
				this.mission.objectiveDetail = payload.winner === 'p1'
					? 'Enemy command destroyed. Consolidate the field and prepare to redeploy.'
					: 'Your defenses collapsed before the final wave could be contained.';
				this.mission.pressure = payload.winner === 'p1' ? 'stable' : 'critical';
				this.mission.pressureLabel = payload.winner === 'p1' ? 'Perimeter stable' : 'Base under heavy fire';
				this.mission.enemyActivity.activeCombatUnits = payload.winner === 'p1' ? 0 : Math.max(this.mission.enemyActivity.activeCombatUnits, this.mission.enemyActivity.lastWaveSize ?? 1);
			}
			this.syncMissionClock();
		}

		async mount(): Promise<void> {}
		start(): void {}
		stop(): void {}
		dispose(): void {}
		resumeAudio(): Promise<void> { return Promise.resolve(); }
		setAudioMuted(): void {}
		selectArmy(): void {}
		getSpriteMode(): 'vector' { return 'vector'; }
		getResources() {
			return { mineral: 500, gas: 200, supplyUsed: 4, supplyCap: 12 };
		}
		getFog() { return undefined; }
		getCameraTile() { return { col: 0, row: 0 }; }
		getViewportBounds() { return { minCol: 0, maxCol: 12, minRow: 0, maxRow: 12 }; }
		getMinimapBlips() { return []; }
		getSelection() { return []; }
		getSelectionSummary() {
			return {
				count: 0,
				label: 'No selection',
				detail: 'Click or drag-select units to issue commands.',
				averageHpRatio: null,
				composition: [],
			};
		}
		getSelectedRallyPoint() { return null; }
		getProductionOptions() { return []; }
		getProductionStructureGroups() { return []; }
		getProductionQueue() { return []; }
		getResearchState() {
			return {
				researched: [],
				totalArmorBonus: 0,
				totalDamageBonus: 0,
				totalSightBonus: 0,
			};
		}
		getResearchOptions() { return []; }
		getResearchQueue() { return []; }
		enqueueResearchFromSelection() { return 0; }
		getElapsedMs() {
			this.syncMissionClock();
			return this.elapsedMs;
		}
		getMissionState() {
			this.syncMissionClock();
			return cloneMission(this.mission);
		}
	}

	class MockEmitter {
		private readonly listeners = new Map<string, Set<Listener>>();

		constructor(private readonly owner: MockRtsEngine) {}

		on(type: string, listener: Listener): () => void {
			const set = this.listeners.get(type) ?? new Set<Listener>();
			set.add(listener);
			this.listeners.set(type, set);
			return () => set.delete(listener);
		}

		emit(type: string, payload: unknown): void {
			this.owner.applyEvent(type, payload);
			for (const listener of this.listeners.get(type) ?? []) listener(payload);
		}
	}

	let latestEngine: MockRtsEngine | null = null;

	class MockAiController {
		constructor(..._args: unknown[]) {}
		tick(): void {}
	}

	function createRtsHudModel() {
		return {
			state: {
				factionId: 'p1',
				mineral: 0,
				gas: 0,
				supplyUsed: 0,
				supplyCap: 12,
				selectionCount: 0,
				selectionLabel: '',
				elapsedMs: 0,
				buildingMode: null as string | null,
				armedOrder: null as string | null,
				activeResearchLabel: null as string | null,
				activeResearchProgress: null as number | null,
				completedResearchCount: 0,
				paused: false,
				muted: false,
			},
			setResources(mineral: number, gas: number) {
				this.state.mineral = mineral;
				this.state.gas = gas;
			},
			setSupply(used: number, cap: number) {
				this.state.supplyUsed = used;
				this.state.supplyCap = cap;
			},
			setSelection(count: number, label: string) {
				this.state.selectionCount = count;
				this.state.selectionLabel = label;
			},
			setElapsed(ms: number) { this.state.elapsedMs = ms; },
			setBuildingMode(kind: string | null) { this.state.buildingMode = kind; },
			setArmedOrder(kind: string | null) { this.state.armedOrder = kind; },
			setResearch(label: string | null, progress: number | null, completedCount: number) {
				this.state.activeResearchLabel = label;
				this.state.activeResearchProgress = progress;
				this.state.completedResearchCount = completedCount;
			},
			setPaused(paused: boolean) { this.state.paused = paused; },
			setMuted(muted: boolean) { this.state.muted = muted; },
			setFactionId(id: string) { this.state.factionId = id; },
		};
	}

	return {
		module: {
			Rts: {
				TECH_STATS,
				Engine: {
					RtsEngine: MockRtsEngine,
					AiController: MockAiController,
					createPixiRtsRendererFactory: () => undefined,
				},
				Runtime: {
					createRtsHudModel,
				},
			},
		},
		getLatestEngine: () => latestEngine,
		reset() {
			latestEngine = null;
		},
	};
});

vi.mock('ui/source', () => rtsMock.module);

import { createRtsPageModel } from './rts-page.svelte.ts';

function makeMap() {
	const metadata = {
		title: 'Cinder Ridge',
		author: 'test',
		createdAt: '2026-05-04T00:00:00.000Z',
		updatedAt: '2026-05-04T00:00:00.000Z',
		source: 'builtin' as const,
	};
	return {
		id: 'map-1',
		metadata,
		definition: {
			id: 'map-1',
			version: 1,
			size: { cols: 24, rows: 24 },
			tileSize: { width: 64, height: 32 },
			maxAltitude: 0,
			terrain: Array.from({ length: 24 }, () => Array.from({ length: 24 }, () => 'grass')),
			altitude: { levels: Array.from({ length: 24 }, () => Array.from({ length: 24 }, () => 0)) },
			resources: [],
			spawns: [
				{ factionId: 'p1', tile: { col: 2, row: 12 } },
				{ factionId: 'p2', tile: { col: 21, row: 12 } },
			],
			metadata,
		},
		source: 'builtin' as const,
		builtInId: 'map-1',
		isEditable: false,
	};
}

function createTransportStub(): RtsTransport {
	const map = makeMap();
	const resolvedMap = map as Awaited<ReturnType<RtsTransport['getMap']>> & NonNullable<Awaited<ReturnType<RtsTransport['getMap']>>>;
	const match = {
		id: 'match-1',
		mapId: map.id,
		factions: [
			{ id: 'p1', label: 'You', color: '#4dabff', isPlayer: true, isAi: false },
			{ id: 'p2', label: 'AI', color: '#ff6b6b', isPlayer: false, isAi: true, aiDifficulty: 'normal' as const },
		],
		rules: {
			startingResources: { mineral: 500, gas: 200 },
			populationCap: 20,
			fogOfWar: true,
			aiDifficulty: 'normal' as const,
			rngSeed: 7,
		},
	};

	return {
		listMaps: vi.fn(async () => [resolvedMap]),
		getMap: vi.fn(async () => resolvedMap),
		generateMap: vi.fn(async () => ({ map: map.definition, params: {
			seed: 7,
			archetype: 'open-field',
			size: { cols: 24, rows: 24 },
			maxAltitude: 0,
			factionCount: 2,
			symmetry: 'mirrorH',
			resourceDensity: 'normal',
			altitudeRoughness: 'flat',
			waterAmount: 0,
			ramps: 1,
			version: 1,
		} })),
		saveUserMap: vi.fn(async () => ({
			id: 'user-map-1',
			title: map.metadata.title,
			author: map.metadata.author,
			map: map.definition,
			params: undefined,
			createdAt: map.metadata.createdAt,
			updatedAt: map.metadata.updatedAt,
		})),
		listUserMaps: vi.fn(async () => []),
		getUserMap: vi.fn(async () => null),
		deleteUserMap: vi.fn(async () => undefined),
		startMatch: vi.fn(async () => ({ match, map: resolvedMap })),
		recordMatchResult: vi.fn(async (result) => ({ id: 'result-1', ...result })),
		listMatchResults: vi.fn(async () => []),
	} as unknown as RtsTransport;
}

describe('rts page model mission state', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		rtsMock.reset();
	});

	afterEach(() => {
		vi.runOnlyPendingTimers();
		vi.useRealTimers();
	});

	test('startMatch exposes the mission briefing and escalates wave pressure as events arrive', async () => {
		const transport = createTransportStub();
		const model = createRtsPageModel({ transport });
		model.setMountTarget({} as HTMLDivElement);

		await model.startMatch({ mapId: 'map-1', aiDifficulty: 'normal', fogOfWar: true, seed: 7 });
		flushSync();

		expect(model.mission).toMatchObject({
			status: 'active',
			tone: 'calm',
			title: 'Hold the line',
			pressureLabel: 'Perimeter stable',
			waveLabel: 'Enemy wave building',
			countdownValue: 'Scanning',
		});
		expect(model.mission.objective).toContain('Protect your HQ');
		expect(model.toasts.some((toast) => toast.message.includes('Briefing: secure your base'))).toBe(true);
		expect(model.eventFeed[0]).toMatchObject({ title: 'Match started', tone: 'success' });

		const engine = rtsMock.getLatestEngine();
		expect(engine).not.toBeNull();
		engine!.elapsedMs = 15_000;
		engine!.emitter.emit('squadLaunched', { factionId: 'p2', size: 4, waveIndex: 2 });
		flushSync();

		expect(model.mission).toMatchObject({
			status: 'active',
			tone: 'warning',
			pressureLabel: 'Frontline under pressure',
			waveLabel: 'Wave 2 is in contact',
			countdownValue: '00:30',
			enemyForceValue: '4 active',
		});
		expect(model.mission.waveDetail).toBe('4 hostiles committed in the latest push.');
		expect(model.toasts[0]?.message).toBe('Enemy wave 2 launched (4)');
		expect(model.eventFeed[0]).toMatchObject({ title: 'Enemy wave launched', tone: 'warning' });

		engine!.elapsedMs = 16_000;
		engine!.emitter.emit('combatAlert', { tile: { col: 8, row: 8 }, severity: 'danger', kind: 'critical', factionId: 'p1' });
		engine!.emitter.emit('combatAlert', { tile: { col: 9, row: 8 }, severity: 'danger', kind: 'impact', factionId: 'p1' });
		flushSync();

		expect(model.mission).toMatchObject({
			status: 'active',
			tone: 'danger',
			pressureLabel: 'Base under heavy fire',
			waveLabel: 'Wave 2 is in contact',
			enemyForceValue: '4 active',
		});
		expect(model.mission.pressureDetail).toBe('4 hostile combat units are threatening your base right now.');

		model.dispose();
	});

	test('match end events swap the mission copy to the final operation outcome', async () => {
		const transport = createTransportStub();
		const model = createRtsPageModel({ transport });
		model.setMountTarget({} as HTMLDivElement);

		await model.startMatch({ mapId: 'map-1', aiDifficulty: 'normal', fogOfWar: true, seed: 7 });
		flushSync();

		const engine = rtsMock.getLatestEngine();
		expect(engine).not.toBeNull();
		engine!.elapsedMs = 24_000;
		engine!.emitter.emit('squadLaunched', { factionId: 'p2', size: 5, waveIndex: 3 });
		engine!.emitter.emit('matchEnded', { winner: 'p1', durationMs: 24_000 });
		await Promise.resolve();
		flushSync();

		expect(model.mission).toMatchObject({
			status: 'victory',
			tone: 'success',
			title: 'Mission complete',
			pressureLabel: 'Threat neutralized',
			waveLabel: 'Threat neutralized',
			countdownValue: 'Secured',
		});
		expect(model.mission.objective).toContain('Enemy command destroyed');
		expect(model.toasts[0]?.message).toBe('Victory! Enemy camp destroyed.');
		expect(transport.recordMatchResult).toHaveBeenCalledWith(expect.objectContaining({
			winner: 'p1',
			durationMs: 24_000,
		}));

		const defeatTransport = createTransportStub();
		const defeatModel = createRtsPageModel({ transport: defeatTransport });
		defeatModel.setMountTarget({} as HTMLDivElement);
		await defeatModel.startMatch({ mapId: 'map-1', aiDifficulty: 'normal', fogOfWar: true, seed: 7 });
		flushSync();

		const defeatEngine = rtsMock.getLatestEngine();
		expect(defeatEngine).not.toBeNull();
		defeatEngine!.elapsedMs = 18_000;
		defeatEngine!.emitter.emit('squadLaunched', { factionId: 'p2', size: 6, waveIndex: 1 });
		defeatEngine!.emitter.emit('matchEnded', { winner: 'p2', durationMs: 18_000 });
		await Promise.resolve();
		flushSync();

		expect(defeatModel.mission).toMatchObject({
			status: 'defeat',
			tone: 'failure',
			title: 'Mission failed',
			pressureLabel: 'Defense broken',
			waveLabel: 'Defense broken',
			countdownValue: 'Broken',
		});
		expect(defeatModel.mission.objective).toContain('defenses collapsed');
		expect(defeatModel.toasts[0]?.message).toBe('Defeat. Your base has fallen.');

		model.dispose();
		defeatModel.dispose();
	});
});
