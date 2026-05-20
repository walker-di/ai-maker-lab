<script lang="ts">
	import type { CustomerJourneyMap, JourneyMapLane, JourneyMapStage } from '../types.js';

	interface Props {
		journeyMap: CustomerJourneyMap;
		compact?: boolean;
	}

	let { journeyMap, compact = false }: Props = $props();

	const stageOrder = $derived([...journeyMap.stages].sort((a, b) => a.order - b.order));
	const laneOrder = $derived([...journeyMap.lanes].sort((a, b) => a.order - b.order));
	const emotionPoints = $derived([...journeyMap.emotionPoints].sort((a, b) => a.order - b.order));

	function cellFor(stage: JourneyMapStage, lane: JourneyMapLane) {
		return journeyMap.cells.find((cell) => cell.stageId === stage.id && cell.laneId === lane.id);
	}

	function touchpointsFor(stage: JourneyMapStage) {
		return journeyMap.touchpoints.filter((touchpoint) => touchpoint.stageId === stage.id).sort((a, b) => a.order - b.order);
	}

	function opportunityFor(stage: JourneyMapStage) {
		return journeyMap.opportunities.find((opportunity) => opportunity.stageId === stage.id);
	}

	function emotionLeft(index: number) {
		if (emotionPoints.length <= 1) return 50;
		return 8 + (index * 84) / (emotionPoints.length - 1);
	}

	function emotionTop(score: number) {
		return 82 - score * 0.62;
	}
</script>

<section class="overflow-hidden rounded-[2rem] border bg-white shadow-sm" aria-label={journeyMap.name}>
	<header class="grid gap-6 bg-gradient-to-br from-white to-blue-50/70 p-6 lg:grid-cols-[260px_1fr_340px] lg:items-center">
		<div class="flex items-center gap-4">
			<div class="grid h-20 w-20 shrink-0 place-items-center rounded-3xl bg-gradient-to-br from-blue-500 to-amber-300 text-4xl shadow-lg">👩🏽‍💻</div>
			<div>
				<p class="text-xs font-black uppercase tracking-[0.16em] text-blue-600">Persona</p>
				<h2 class="text-xl font-bold tracking-tight">Maya Silva</h2>
				<p class="text-sm leading-5 text-muted-foreground">Growth lead turning customer research into decisions.</p>
			</div>
		</div>

		<div class="text-center lg:px-6">
			<p class="text-xs font-black uppercase tracking-[0.16em] text-blue-600">Visual customer journey map</p>
			<h3 class="mt-2 text-3xl font-black tracking-tight text-slate-950 md:text-5xl">{journeyMap.name}</h3>
			{#if journeyMap.scenario || journeyMap.description}
				<p class="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{journeyMap.scenario || journeyMap.description}</p>
			{/if}
		</div>

		<aside class="rounded-2xl border bg-white/70 p-4">
			<p class="text-xs font-black uppercase tracking-[0.16em] text-blue-600">Goals & expectations</p>
			<ul class="mt-3 space-y-2 text-sm leading-5 text-slate-700">
				{#each journeyMap.goals.slice(0, 4) as goal}
					<li class="flex gap-2"><span class="text-blue-600">•</span><span>{goal}</span></li>
				{/each}
				{#if journeyMap.goals.length === 0}
					<li class="text-muted-foreground">Add goals to clarify what this journey should improve.</li>
				{/if}
			</ul>
		</aside>
	</header>

	<div class="overflow-x-auto p-5 md:p-7">
		<div class="grid min-w-[1120px] gap-x-3" style={`grid-template-columns: 150px repeat(${Math.max(stageOrder.length, 1)}, minmax(170px, 1fr));`}>
			<div class="mb-4 flex items-center text-sm font-black uppercase tracking-wide text-blue-700">Stage</div>
			{#each stageOrder as stage, i}
				<div class="relative mb-4 flex min-h-14 items-center justify-center bg-gradient-to-b from-amber-200 to-amber-400 px-7 text-center text-sm font-black uppercase tracking-wide text-slate-900 shadow-sm {i === 0 ? 'rounded-l-2xl' : ''} {i === stageOrder.length - 1 ? 'rounded-r-2xl' : ''}" style="clip-path: polygon(0 0, calc(100% - 24px) 0, 100% 50%, calc(100% - 24px) 100%, 0 100%, 20px 50%);">
					<span class="absolute -top-3 grid h-8 w-8 place-items-center rounded-full bg-amber-50 shadow">{stage.icon ?? ['👀', '🔎', '⚙️', '✨', '🚀'][i % 5]}</span>
					<span class="mt-2">{stage.title}</span>
				</div>
			{/each}

			{#each laneOrder as lane}
				<div class="mb-3 flex min-h-28 items-center justify-center rounded-l-2xl bg-blue-600 p-4 text-center text-sm font-black uppercase tracking-wide text-white {lane.kind === 'opportunities' ? '!bg-orange-400 !text-slate-950' : ''} {lane.kind === 'emotions' ? '!bg-teal-700' : ''}">
					{lane.title}
				</div>

				{#if lane.kind === 'emotions'}
					<div class="relative col-span-full mb-3 min-h-48 overflow-hidden rounded-2xl bg-gradient-to-b from-sky-50 to-sky-100">
						<svg class="absolute inset-0 h-full w-full" viewBox="0 0 1000 220" preserveAspectRatio="none" aria-hidden="true">
							<path d="M0,152 C120,142 145,70 230,112 C315,154 350,112 430,92 C520,70 565,158 645,116 C730,72 760,126 840,86 C920,46 955,70 1000,54 L1000,220 L0,220 Z" fill="rgba(56,189,248,.12)" />
							<path d="M0,152 C120,142 145,70 230,112 C315,154 350,112 430,92 C520,70 565,158 645,116 C730,72 760,126 840,86 C920,46 955,70 1000,54" fill="none" stroke="#38bdf8" stroke-width="4" stroke-linecap="round" />
						</svg>
						{#each emotionPoints as point, i}
							<div class="absolute grid min-w-24 -translate-x-1/2 -translate-y-1/2 justify-items-center text-center text-xs text-slate-700" style={`left: ${emotionLeft(i)}%; top: ${emotionTop(point.score)}%;`}>
								<span class="grid h-12 w-12 place-items-center rounded-full border-4 border-white bg-amber-300 text-2xl shadow-md">{point.emoji ?? '🙂'}</span>
								<b class="mt-1">{point.label}</b>
							</div>
						{/each}
					</div>
				{:else if lane.kind === 'touchpoints'}
					{#each stageOrder as stage}
						<div class="mb-3 flex min-h-28 items-center justify-center gap-2 rounded-2xl bg-cyan-50 p-4">
							{#each touchpointsFor(stage) as touchpoint}
								<span class="grid h-11 w-11 place-items-center rounded-full bg-orange-400 text-xl text-white shadow" title={touchpoint.label}>{touchpoint.icon ?? '•'}</span>
							{/each}
						</div>
					{/each}
				{:else if lane.kind === 'opportunities'}
					{#each stageOrder as stage}
						<div class="mb-3 min-h-28 rounded-2xl bg-purple-100 p-4 text-sm font-semibold leading-5 text-slate-900 shadow-sm">
							{#if opportunityFor(stage)}<span class="text-orange-500">★</span> {opportunityFor(stage)?.title}{/if}
						</div>
					{/each}
				{:else}
					{#each stageOrder as stage}
						{@const cell = cellFor(stage, lane)}
						<div class="mb-3 min-h-28 rounded-2xl p-4 text-sm leading-5 shadow-sm {lane.kind === 'thoughts' ? 'bg-yellow-100' : lane.kind === 'pain_points' ? 'bg-rose-100' : 'bg-slate-100'}">
							{#if cell?.quote}<p class="font-bold text-slate-900">“{cell.quote}”</p>{:else}<p>{cell?.content}</p>{/if}
						</div>
					{/each}
				{/if}
			{/each}
		</div>
	</div>
</section>
