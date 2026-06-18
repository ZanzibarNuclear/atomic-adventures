import { createRouter, createWebHistory } from "vue-router";
import GameView from "./views/GameView.vue";

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "game", component: GameView },
    {
      path: "/builder",
      name: "builder",
      component: () => import("./views/BuilderView.vue"),
    },
  ],
});
