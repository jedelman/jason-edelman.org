<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="theme-color" content="#0d1a0d" media="(prefers-color-scheme: dark)" />
	<meta name="theme-color" content="#f5f7f3" media="(prefers-color-scheme: light)" />
</svelte:head>

{@render children()}
