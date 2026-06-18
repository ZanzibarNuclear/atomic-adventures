import { createApp } from 'vue'
import App from './App.vue'
import router from './router.js'
import './styles.css'
import { preloadWorldContent } from './composables/useWorldContent.js'

await preloadWorldContent()
createApp(App).use(router).mount('#app')
