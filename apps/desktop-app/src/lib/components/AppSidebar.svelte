<script lang="ts">
	import { page } from '$app/state';
	import { Sidebar } from 'ui/source';
	import HouseIcon from '@lucide/svelte/icons/house';
	import MessagesSquareIcon from '@lucide/svelte/icons/messages-square';
	import BotIcon from '@lucide/svelte/icons/bot';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import GamepadIcon from '@lucide/svelte/icons/gamepad-2';
	import PencilRulerIcon from '@lucide/svelte/icons/pencil-ruler';
	import { m } from '$lib/paraglide/messages.js';

	type Props = {
		variant?: 'sidebar' | 'floating' | 'inset';
	};

	let { variant = 'inset' }: Props = $props();

	type NavItem = {
		title: string;
		href: string;
		icon: typeof HouseIcon;
		match: (pathname: string) => boolean;
	};

	const navMain: NavItem[] = [
		{
			title: m.lab_home_title(),
			href: '/',
			icon: HouseIcon,
			match: (p) => p === '/',
		},
		{
			title: m.lab_experiment_chat_label(),
			href: '/experiments/chat',
			icon: MessagesSquareIcon,
			match: (p) => p.startsWith('/experiments/chat'),
		},
		{
			title: m.lab_experiment_agent_registry_label(),
			href: '/agents',
			icon: BotIcon,
			match: (p) => p.startsWith('/agents'),
		},
		{
			title: m.lab_experiment_platformer_label(),
			href: '/experiments/platformer',
			icon: GamepadIcon,
			match: (p) =>
				p === '/experiments/platformer' ||
				(p.startsWith('/experiments/platformer') && !p.startsWith('/experiments/platformer/editor')),
		},
		{
			title: m.lab_experiment_platformer_editor_label(),
			href: '/experiments/platformer/editor',
			icon: PencilRulerIcon,
			match: (p) => p.startsWith('/experiments/platformer/editor'),
		},
	];

	const navFooter: NavItem[] = [
		{
			title: m.lab_settings_label(),
			href: '/settings',
			icon: SettingsIcon,
			match: (p) => p.startsWith('/settings'),
		},
	];

	const pathname = $derived(page.url.pathname);
</script>

<Sidebar.Root collapsible="icon" {variant}>
	<Sidebar.Header>
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton size="lg">
					{#snippet child({ props })}
						<a href="/" {...props}>
							<div
								class="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg"
							>
								<SparklesIcon class="size-4" />
							</div>
							<div class="grid flex-1 text-left text-sm leading-tight">
								<span class="truncate font-semibold">AI Maker Lab</span>
								<span class="text-muted-foreground truncate text-xs">Experiments</span>
							</div>
						</a>
					{/snippet}
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Header>

	<Sidebar.Content>
		<Sidebar.Group>
			<Sidebar.GroupLabel>Lab</Sidebar.GroupLabel>
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					{#each navMain as item (item.href)}
						<Sidebar.MenuItem>
							<Sidebar.MenuButton isActive={item.match(pathname)} tooltipContent={item.title}>
								{#snippet child({ props })}
									<a href={item.href} {...props}>
										<item.icon />
										<span>{item.title}</span>
									</a>
								{/snippet}
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
					{/each}
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>
	</Sidebar.Content>

	<Sidebar.Footer>
		<Sidebar.Menu>
			{#each navFooter as item (item.href)}
				<Sidebar.MenuItem>
					<Sidebar.MenuButton isActive={item.match(pathname)} tooltipContent={item.title}>
						{#snippet child({ props })}
							<a href={item.href} {...props}>
								<item.icon />
								<span>{item.title}</span>
							</a>
						{/snippet}
					</Sidebar.MenuButton>
				</Sidebar.MenuItem>
			{/each}
		</Sidebar.Menu>
	</Sidebar.Footer>
</Sidebar.Root>
