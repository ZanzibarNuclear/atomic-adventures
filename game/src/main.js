import { createApp } from 'vue'
import App from './App.vue'
import router from './router.js'
import './styles.css'
import { preloadWorldContent } from './composables/useWorldContent.js'
import { preloadBuildingContent } from './composables/useBuildingContent.js'

await Promise.all([preloadWorldContent(), preloadBuildingContent()])
createApp(App).use(router).mount('#app')
