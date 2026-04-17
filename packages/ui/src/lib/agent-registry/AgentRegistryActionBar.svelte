<script lang="ts">
	import { Button } from '$ui/components/ui/button/index.js';

	interface Props {
		useInChatHref?: string;
		canEdit?: boolean;
		canDuplicate?: boolean;
		canInherit?: boolean;
		canSave?: boolean;
		isSaving?: boolean;
		onDuplicate?: () => void;
		onInherit?: () => void;
		onSave?: () => void;
	}

	let {
		useInChatHref,
		canEdit = false,
		canDuplicate = false,
		canInherit = false,
		canSave = false,
		isSaving = false,
		onDuplicate,
		onInherit,
		onSave,
	}: Props = $props();
</script>

<div class="flex flex-wrap items-center gap-2">
	{#if useInChatHref}
		<Button size="sm" href={useInChatHref}>Use in Chat</Button>
	{/if}

	{#if canDuplicate && onDuplicate}
		<Button type="button" variant="outline" size="sm" onclick={onDuplicate}>Duplicate</Button>
	{/if}

	{#if canInherit && onInherit}
		<Button type="button" variant="outline" size="sm" onclick={onInherit}>Inherit</Button>
	{/if}

	{#if canEdit && onSave}
		<Button type="button" size="sm" onclick={onSave} disabled={!canSave || isSaving}>
			{isSaving ? 'Saving...' : 'Save Changes'}
		</Button>
	{/if}
</div>
