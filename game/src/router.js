import { createRouter, createWebHistory } from "vue-router";
import GameView from "./views/GameView.vue";

const routes = [{ path: "/", name: "game", component: GameView }];

if (import.meta.env.DEV) {
  routes.push({
      path: "/builder",
      component: () => import("./components/BuilderShell.vue"),
      children: [
        { path: "", redirect: "/builder/story" },
        {
          path: "story",
          name: "story-builder",
          component: () => import("./views/BuilderView.vue"),
        },
        {
          path: "world",
          name: "world-builder",
          component: () => import("./views/WorldBuilderView.vue"),
        },
        {
          path: "content",
          name: "content-builder",
          component: () => import("./views/CharacterBuilderView.vue"),
        },
      ],
    });
} else {
  routes.push({ path: "/:pathMatch(.*)*", redirect: "/" });
}

export default createRouter({
  history: createWebHistory(),
  routes,
});
