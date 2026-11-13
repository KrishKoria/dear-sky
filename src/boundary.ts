// The boundary diagram for the demo video (design/storyboard.md beat 8): its own page, so it
// loads no Firebase, no engine and no letter. Same faces and tokens as the app.
import { mount } from 'svelte'
import './fonts'
import './app.css'
import Boundary from './lib/ui/Boundary.svelte'

export default mount(Boundary, { target: document.getElementById('app')! })
