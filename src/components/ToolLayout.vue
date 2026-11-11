<script setup>
defineProps({
  crumb: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true }
})
</script>

<template>
  <section class="panel">
    <header class="panel-header">
      <div class="crumb">{{ crumb }}</div>
      <h1>{{ title }}</h1>
      <p>{{ description }}</p>
    </header>
    <slot />
  </section>
</template>
