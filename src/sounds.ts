// Dev-only sound board (not in the build): audition the sounds by ear, pick the rise, tune the mix.
// Served by the dev server at /sounds.html. Same faces and tokens as the app.
import { mount } from 'svelte'
import './fonts'
import './app.css'
import SoundBoard from './lib/dev/SoundBoard.svelte'

export default mount(SoundBoard, { target: document.getElementById('app')! })
