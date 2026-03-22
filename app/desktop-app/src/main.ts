import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';

async function loadNeutralinoGlobals() {
	await new Promise<void>((resolve) => {
		const script = document.createElement('script');
		script.src = '/__neutralino_globals.js';
		script.async = false;
		script.onload = () => resolve();
		script.onerror = () => resolve();
		document.head.append(script);
	});
}

const target = document.getElementById('app');

if (!target) {
	throw new Error('Missing app mount target.');
}

await loadNeutralinoGlobals();

mount(App, { target });
