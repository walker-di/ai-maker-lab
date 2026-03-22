<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import WorkspaceHome from '$lib/screens/workspace-home/workspace-home.svelte';
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<WorkspaceHome />
