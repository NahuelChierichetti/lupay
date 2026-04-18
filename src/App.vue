<script setup>
import { RouterView } from 'vue-router'
import ToastContainer from './components/ui/ToastContainer.vue'
import PwaInstallPrompt from './components/ui/PwaInstallPrompt.vue'
</script>

<template>
  <RouterView />
  <ToastContainer />
  <PwaInstallPrompt />
</template>
