// register vue composition api globally
import { createApp } from 'vue'
import App from './App.vue'

import '@unocss/reset/tailwind.css'
import './styles/main.css'
import '../core/chrome.css'
import 'uno.css'

const app = createApp(App)
app.mount('#app')
