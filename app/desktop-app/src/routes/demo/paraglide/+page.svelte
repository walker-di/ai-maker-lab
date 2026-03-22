<script lang="ts">
	import { setLocale } from '$lib/paraglide/runtime';
	import { m } from '$lib/paraglide/messages.js';
	import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ai-maker-lab/ui';
</script>

<div class="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-10">
	<Card class="w-full">
		<CardHeader>
			<CardTitle>{m.hello_world({ name: 'SvelteKit User' })}</CardTitle>
			<CardDescription>
				Paraglide stays in the app shell while the buttons come from `@ai-maker-lab/ui`.
			</CardDescription>
		</CardHeader>
		<CardContent class="space-y-6">
			<div class="flex flex-wrap gap-3">
				<Button variant="outline" onclick={() => setLocale('en')}>en</Button>
				<Button variant="outline" onclick={() => setLocale('es')}>es</Button>
				<Button variant="outline" onclick={() => setLocale('pt')}>pt</Button>
				<Button variant="outline" onclick={() => setLocale('ja')}>ja</Button>
			</div>

			<p class="text-sm leading-6 text-muted-foreground">
				If you use VSCode, install the
				<a
					class="ml-1 font-medium text-foreground underline underline-offset-4"
					href="https://marketplace.visualstudio.com/items?itemName=inlang.vs-code-extension"
					target="_blank"
				>
					Sherlock i18n extension
				</a>
				for a better i18n experience.
			</p>
		</CardContent>
	</Card>
</div>
