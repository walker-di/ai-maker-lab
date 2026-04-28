<script lang="ts">
	import { Button } from '$ui/components/ui/button/index.js';
	import * as Sheet from '$ui/components/ui/sheet/index.js';
	import LayoutDashboardIcon from '@lucide/svelte/icons/layout-dashboard';
	import PackageIcon from '@lucide/svelte/icons/package';
	import MegaphoneIcon from '@lucide/svelte/icons/megaphone';
	import UsersIcon from '@lucide/svelte/icons/users';
	import PaletteIcon from '@lucide/svelte/icons/palette';
	import LayoutTemplateIcon from '@lucide/svelte/icons/layout-template';
	import MusicIcon from '@lucide/svelte/icons/music';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import MenuIcon from '@lucide/svelte/icons/menu';
	import { cn } from '$ui/utils.js';
	import type { Component } from 'svelte';

	interface NavItem {
		label: string;
		path: string;
		icon: Component;
	}

	interface Props {
		activePath: string;
		onNavigate: (path: string) => void;
		children?: import('svelte').Snippet;
	}

	let { activePath, onNavigate, children }: Props = $props();

	let mobileOpen = $state(false);

	const navItems: NavItem[] = [
		{ label: 'Dashboard', path: '/dashboard', icon: LayoutDashboardIcon },
		{ label: 'Products', path: '/products', icon: PackageIcon },
		{ label: 'Campaigns', path: '/campaigns', icon: MegaphoneIcon },
		{ label: 'Personas', path: '/personas', icon: UsersIcon },
		{ label: 'Creatives', path: '/creatives', icon: PaletteIcon },
		{ label: 'Canvas Templates', path: '/canvas-templates', icon: LayoutTemplateIcon },
		{ label: 'BGM', path: '/bgm', icon: MusicIcon },
		{ label: 'Settings', path: '/settings', icon: SettingsIcon },
	];

	function handleNav(path: string) {
		onNavigate(path);
		mobileOpen = false;
	}
</script>

<div class="flex h-screen overflow-hidden">
	<aside class="hidden w-56 shrink-0 flex-col border-r bg-sidebar md:flex">
		<div class="flex h-14 items-center border-b px-4">
			<span class="text-sm font-semibold">Marketing Manager</span>
		</div>
		<nav class="flex-1 overflow-y-auto px-2 py-3" aria-label="Main navigation">
			{#each navItems as item}
				<button
					type="button"
					class={cn(
						'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
						'hover:bg-accent hover:text-accent-foreground',
						activePath.startsWith(item.path)
							? 'bg-accent text-accent-foreground'
							: 'text-muted-foreground'
					)}
					onclick={() => handleNav(item.path)}
					aria-current={activePath.startsWith(item.path) ? 'page' : undefined}
				>
					<item.icon class="h-4 w-4 shrink-0" />
					{item.label}
				</button>
			{/each}
		</nav>
	</aside>

	<div class="flex flex-1 flex-col overflow-hidden">
		<header class="flex h-14 items-center border-b px-4 md:hidden">
			<Sheet.Root bind:open={mobileOpen}>
				<Sheet.Trigger>
					{#snippet child({ props: triggerProps })}
						<Button
							{...triggerProps}
							type="button"
							variant="ghost"
							size="icon"
							aria-label="Open navigation"
						>
							<MenuIcon class="h-5 w-5" />
						</Button>
					{/snippet}
				</Sheet.Trigger>
				<Sheet.Portal>
					<Sheet.Overlay />
					<Sheet.Content side="left" class="w-56 p-0">
						<Sheet.Header class="border-b px-4 py-3">
							<Sheet.Title class="text-sm font-semibold">Marketing Manager</Sheet.Title>
						</Sheet.Header>
						<nav class="px-2 py-3" aria-label="Mobile navigation">
							{#each navItems as item}
								<button
									type="button"
									class={cn(
										'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
										'hover:bg-accent hover:text-accent-foreground',
										activePath.startsWith(item.path)
											? 'bg-accent text-accent-foreground'
											: 'text-muted-foreground'
									)}
									onclick={() => handleNav(item.path)}
									aria-current={activePath.startsWith(item.path) ? 'page' : undefined}
								>
									<item.icon class="h-4 w-4 shrink-0" />
									{item.label}
								</button>
							{/each}
						</nav>
					</Sheet.Content>
				</Sheet.Portal>
			</Sheet.Root>
			<span class="ml-3 text-sm font-semibold">Marketing Manager</span>
		</header>

		<main class="flex-1 overflow-y-auto">
			{@render children?.()}
		</main>
	</div>
</div>
