import { createApp } from 'vue'
import { inject } from '@vercel/analytics'
import App from './App.vue'
import './styles.css'

createApp(App).mount('#app')
inject()
