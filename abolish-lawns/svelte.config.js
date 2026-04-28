import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		adapter: adapter({
			// Output to build/ — parent scripts/build.mjs copies this to
			// ../public/abolish-lawns/ so it's served at jason-edelman.org/abolish-lawns/*
			pages: 'build',
			assets: 'build',
			fallback: '404.html'
		}),
		paths: {
			base: '/abolish-lawns'
		}
	}
};

export default config;
