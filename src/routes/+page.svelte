<script lang="ts">
	import type { Project } from '$lib/types.js';
	import ProjectCard from '$lib/components/ProjectCard.svelte';

	let { data } = $props();

	let projects: Project[] = $derived(data.projects);
</script>

<svelte:head>
	<title>Claude Inspector</title>
</svelte:head>

<div>
	<div class="mb-6">
		<h1 class="text-lg font-bold text-zinc-100">Projects</h1>
		<p class="mt-1 text-xs text-zinc-500">{projects.length} projects found</p>
	</div>

	<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
		{#each projects as project (project.id)}
			<ProjectCard {project} />
		{/each}
	</div>
</div>
