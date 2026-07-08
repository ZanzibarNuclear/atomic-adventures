<script setup>
import "katex/dist/katex.min.css";
import { ref, watchEffect } from "vue";

const props = defineProps({
  source: { type: String, default: "" },
  inline: { type: Boolean, default: false },
});

const rendered = ref("");
let processorPromise = null;

watchEffect(async () => {
  const source = String(props.source ?? "");
  if (!source.trim()) {
    rendered.value = "";
    return;
  }
  const processor = await getProcessor();
  const file = await processor.process(source);
  const html = String(file);
  rendered.value = props.inline ? stripOuterParagraph(html) : html;
});

async function getProcessor() {
  processorPromise ??= Promise.all([
    import("unified"),
    import("remark-parse"),
    import("remark-math"),
    import("remark-rehype"),
    import("rehype-katex"),
    import("rehype-stringify"),
  ]).then(([
    { unified },
    { default: remarkParse },
    { default: remarkMath },
    { default: remarkRehype },
    { default: rehypeKatex },
    { default: rehypeStringify },
  ]) => unified()
    .use(remarkParse)
    .use(remarkMath)
    .use(remarkRehype)
    .use(rehypeKatex, { strict: false, throwOnError: false })
    .use(rehypeStringify));
  return processorPromise;
}

function stripOuterParagraph(html) {
  const trimmed = html.trim();
  const match = trimmed.match(/^<p>([\s\S]*)<\/p>$/);
  return match ? match[1] : trimmed;
}
</script>

<template>
  <span v-if="inline" class="math-markdown inline" v-html="rendered"></span>
  <div v-else class="math-markdown" v-html="rendered"></div>
</template>

<style scoped>
.math-markdown {
  overflow-wrap: anywhere;
}

.math-markdown :deep(p) {
  margin: 0 0 0.7rem;
}

.math-markdown :deep(p:last-child) {
  margin-bottom: 0;
}

.math-markdown :deep(.katex-display) {
  margin: 0;
  overflow-x: auto;
  overflow-y: hidden;
}

.math-markdown.inline {
  display: inline;
}
</style>
