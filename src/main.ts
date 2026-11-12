import { mount } from 'svelte'
// Self-hosted faces (research/visual-references.md §4): letter, interface, margin hand.
import '@fontsource-variable/literata/wght.css'
import '@fontsource-variable/nunito/wght.css'
import '@fontsource-variable/shantell-sans/infm.css'
import './app.css'
import App from './App.svelte'

const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app
