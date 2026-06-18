import { createRouter, createWebHistory } from "vue-router";
import GameView from "./views/GameView.vue";
import BuilderShell from "./components/BuilderShell.vue";

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "game", component: GameView },
    {
      path: "/builder",
      component: BuilderShell,
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
      ],
    },
  ],
});
