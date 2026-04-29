<script lang="ts">
	import { goto } from '$app/navigation';
	import { MarketingShell } from 'ui/source';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import { m } from '$lib/paraglide/messages.js';

	function navigate(path: string) {
		void goto(`/marketing${path}`);
	}
</script>

<svelte:head>
	<title>{m.marketing_settings_page_title()}</title>
</svelte:head>

<MarketingShell activePath="/settings" onNavigate={navigate}>
	<div class="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
		<header class="space-y-2">
			<p class="text-muted-foreground text-sm font-medium">{m.marketing_manager_title()}</p>
			<h1 class="text-foreground text-3xl font-semibold tracking-tight">{m.marketing_settings_heading()}</h1>
			<p class="text-muted-foreground max-w-2xl text-sm leading-6">
				{m.marketing_settings_intro()}
			</p>
		</header>

		<div class="flex flex-col items-center gap-4 rounded-xl border border-dashed bg-muted/30 p-12 text-center">
			<SettingsIcon class="h-10 w-10 text-muted-foreground/50" />
			<p class="text-muted-foreground text-sm">{m.marketing_settings_placeholder()}</p>
		</div>
	</div>
</MarketingShell>
