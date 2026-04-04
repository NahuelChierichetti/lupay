<script setup>
defineProps({
  title: { type: String, required: true },
  value: { type: String, required: true },
})
</script>

<template>
  <article class="card">
    <p class="muted">{{ title }}</p>
    <h3>{{ value }}</h3>
  </article>
</template>
