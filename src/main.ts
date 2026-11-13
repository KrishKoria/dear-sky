// Dev only, and first: may hide the on-device model before anything reads it.
import './lib/dev/fake-nano'
import { mount } from 'svelte'
import './fonts'
import './app.css'
import App from './App.svelte'

const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app
