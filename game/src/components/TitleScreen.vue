<template>
  <section class="title-screen" aria-labelledby="title-screen-heading">
    <div class="vista" aria-hidden="true">
      <div class="vista-pan">
        <img
          class="vista-photo"
          src="/title/opening-forest.jpg"
          alt=""
          width="1280"
          height="720"
          decoding="async"
          fetchpriority="high" />
      </div>

      <div class="clouds-layer clouds-a">
        <img
          src="/title/opening-clouds.png"
          alt=""
          width="1280"
          height="720"
          decoding="async" />
      </div>
      <div class="clouds-layer clouds-b">
        <img
          src="/title/opening-clouds.png"
          alt=""
          width="1280"
          height="720"
          decoding="async" />
      </div>

      <div class="haze"></div>
      <div class="vignette"></div>
    </div>

    <!-- Title chrome: copy centered, facing-viewer squirrel as a corner mascot. -->
    <div class="title-overlay">
      <img
        class="title-squirrel"
        src="/title/opening-squirrel.png"
        alt=""
        width="160"
        height="160"
        decoding="async"
        aria-hidden="true" />
      <div class="title-copy">
        <p class="eyebrow">Atomic Adventures</p>
        <h2 id="title-screen-heading">Zanzibar's World of Energy</h2>
        <p class="tagline">Join the adventure. Discover what was lost.</p>
        <button type="button" class="enter-btn" @click="$emit('enter')">
          Enter the Game
        </button>
      </div>
    </div>
  </section>
</template>

<script setup>
defineEmits(["enter"]);
</script>

<style scoped>
.title-screen {
  position: relative;
  isolation: isolate;
  min-height: min(72vh, 38rem);
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--color-cherenkov) 28%, #3f4c63);
  box-shadow:
    0 18px 48px rgba(0, 0, 0, 0.45),
    0 0 0 1px var(--color-cherenkov-soft, rgba(32, 200, 251, 0.16));
  background: #0d1410;
}

.vista {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.vista-pan {
  position: absolute;
  inset: -6% -8%;
  animation: vista-kenburns 48s ease-in-out infinite alternate;
  will-change: transform;
}

.vista-photo {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 50% 42%;
}

.clouds-layer {
  position: absolute;
  left: -20%;
  right: -20%;
  top: -8%;
  height: 48%;
  pointer-events: none;
  mix-blend-mode: screen;
  opacity: 0.42;
}

.clouds-layer img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center top;
}

.clouds-a {
  animation: clouds-drift 70s linear infinite;
  opacity: 0.38;
}

.clouds-b {
  top: 2%;
  height: 40%;
  opacity: 0.28;
  animation: clouds-drift-reverse 95s linear infinite;
  transform: scaleX(-1);
}

.haze {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(
      180deg,
      rgba(12, 22, 32, 0.18) 0%,
      transparent 34%,
      transparent 55%,
      rgba(8, 12, 14, 0.72) 100%
    ),
    radial-gradient(
      ellipse 80% 50% at 50% 100%,
      rgba(10, 16, 12, 0.55),
      transparent 70%
    );
  pointer-events: none;
}

.vignette {
  position: absolute;
  inset: 0;
  box-shadow: inset 0 0 8rem rgba(0, 0, 0, 0.45);
  pointer-events: none;
}

.title-overlay {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2;
  padding: clamp(1.1rem, 3vw, 1.75rem) clamp(1.25rem, 4vw, 2.5rem)
    clamp(1.25rem, 3.5vw, 2rem);
  color: #f4f7f2;
  background: linear-gradient(
    180deg,
    transparent 0%,
    rgba(8, 12, 14, 0.35) 28%,
    rgba(8, 12, 14, 0.72) 100%
  );
  pointer-events: none;
}

/* Facing-viewer cutout — title mascot, lower-left of the chrome. */
.title-squirrel {
  position: absolute;
  left: clamp(0.5rem, 1.5vw, 1.1rem);
  bottom: clamp(0.35rem, 1.2vw, 0.85rem);
  width: clamp(5.5rem, 12vw, 8.5rem);
  height: auto;
  display: block;
  pointer-events: none;
  filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.45));
  animation: squirrel-idle 4s ease-in-out infinite;
  transform-origin: 50% 100%;
  will-change: transform;
}

.title-copy {
  display: grid;
  justify-items: center;
  gap: 0.55rem;
  text-align: center;
  /* Keep centered copy clear of the corner mascot */
  padding-left: clamp(4.5rem, 11vw, 7.5rem);
  padding-right: clamp(4.5rem, 11vw, 7.5rem);
}

.title-overlay .enter-btn {
  pointer-events: auto;
}

.eyebrow {
  margin: 0;
  color: var(--color-cherenkov-bright, #5ad8fc);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.55);
}

h2 {
  margin: 0;
  /* Desktop: keep the full title on one line (was forced to wrap at 18ch). */
  max-width: none;
  white-space: nowrap;
  font-size: clamp(1.65rem, 4.2vw, 2.55rem);
  line-height: 1.15;
  font-weight: 800;
  text-shadow:
    0 2px 18px rgba(0, 0, 0, 0.65),
    0 0 1px rgba(0, 0, 0, 0.8);
}

.tagline {
  margin: 0 0 0.65rem;
  max-width: none;
  white-space: nowrap;
  color: #dce6df;
  font-size: clamp(0.92rem, 1.8vw, 1.05rem);
  line-height: 1.45;
  text-shadow: 0 1px 10px rgba(0, 0, 0, 0.7);
}

.enter-btn {
  appearance: none;
  border: 1px solid color-mix(in srgb, var(--color-cherenkov) 55%, #fff);
  border-radius: 999px;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--color-cherenkov) 42%, #1a2830) 0%,
    color-mix(in srgb, var(--color-cherenkov-deep, #0a8fb8) 55%, #122028) 100%
  );
  color: #f4fcff;
  font: inherit;
  font-size: 1.05rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  padding: 0.85rem 1.75rem;
  cursor: pointer;
  box-shadow:
    0 10px 28px rgba(0, 0, 0, 0.4),
    0 0 0 1px var(--color-cherenkov-soft, rgba(32, 200, 251, 0.2)),
    inset 0 1px 0 rgba(255, 255, 255, 0.18);
  transition:
    transform 0.15s ease,
    filter 0.15s ease,
    box-shadow 0.15s ease;
}

.enter-btn:hover {
  filter: brightness(1.08);
  transform: translateY(-1px);
  box-shadow:
    0 14px 32px rgba(0, 0, 0, 0.45),
    0 0 0 1px var(--color-cherenkov-border, rgba(32, 200, 251, 0.38)),
    0 0 24px var(--color-cherenkov-glow, rgba(32, 200, 251, 0.28));
}

.enter-btn:focus-visible {
  outline: 2px solid var(--color-cherenkov, #20c8fb);
  outline-offset: 3px;
}

.enter-btn:active {
  transform: translateY(0);
  filter: brightness(0.98);
}

@keyframes vista-kenburns {
  from {
    transform: scale(1.05) translate3d(1.5%, 0.5%, 0);
  }
  to {
    transform: scale(1.14) translate3d(-2.5%, -1.2%, 0);
  }
}

@keyframes clouds-drift {
  from {
    transform: translate3d(-6%, 0, 0);
  }
  to {
    transform: translate3d(8%, 0, 0);
  }
}

@keyframes clouds-drift-reverse {
  from {
    transform: scaleX(-1) translate3d(-8%, 0, 0);
  }
  to {
    transform: scaleX(-1) translate3d(6%, 0, 0);
  }
}

@keyframes squirrel-idle {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-3px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .vista-pan,
  .clouds-a,
  .clouds-b,
  .title-squirrel {
    animation: none;
  }

  .vista-pan {
    transform: scale(1.08);
  }
}

/* Only wrap title/tagline when the viewport is too narrow for a single line. */
@media (max-width: 720px) {
  h2 {
    white-space: normal;
    max-width: 14ch;
  }

  .tagline {
    white-space: normal;
    max-width: 28rem;
  }
}

@media (max-width: 640px) {
  .title-squirrel {
    width: clamp(4.25rem, 22vw, 5.75rem);
    left: 0.35rem;
    bottom: 0.25rem;
  }

  .title-copy {
    padding-left: 0.25rem;
    padding-right: 0.25rem;
    padding-bottom: 4.5rem;
  }

  .title-overlay {
    padding-bottom: 0.75rem;
  }
}
</style>
