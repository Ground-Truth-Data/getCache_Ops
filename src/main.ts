import { mount } from 'svelte';
import App from './app/App.svelte';
import './app/app.css';
import './app/table/adminTable.css';

mount(App, { target: document.getElementById('app')! });
