import { createApp } from 'vue'
import App from './App.vue'
import router from './router.js'
import './styles.css'
import { preloadWorldContent } from './composables/useWorldContent.js'
import { preloadBuildingContent } from './composables/useBuildingContent.js'
import { preloadCharacterContent } from './composables/useCharacterContent.js'
import { preloadLearningContent } from './composables/useLearningContent.js'

await Promise.all([
  preloadWorldContent(),
  preloadBuildingContent(),
  preloadCharacterContent(),
  preloadLearningContent(),
])
createApp(App).use(router).mount('#app')
