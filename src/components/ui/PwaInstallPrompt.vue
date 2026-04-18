<template>
  <Transition name="slide-up">
    <div
      v-if="showPrompt"
      class="fixed bottom-20 left-4 right-4 z-50 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 flex items-center gap-3"
    >
      <img src="/logo-lupay.png" alt="LUPAY" class="w-12 h-12 rounded-xl flex-shrink-0" />
      <div class="flex-1 min-w-0">
        <p class="font-semibold text-gray-900 text-sm">Instalar LUPAY</p>
        <p class="text-xs text-gray-500 truncate">Agregá la app a tu pantalla de inicio</p>
      </div>
      <div class="flex gap-2 flex-shrink-0">
        <button
          @click="dismiss"
          class="text-xs text-gray-400 px-2 py-1 rounded-lg hover:bg-gray-100"
        >
          No
        </button>
        <button
          @click="install"
          class="text-xs font-semibold text-white bg-blue-900 px-3 py-1 rounded-lg hover:bg-blue-800"
        >
          Instalar
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const showPrompt = ref(false)
let deferredPrompt = null

function handleBeforeInstall(e) {
  e.preventDefault()
  deferredPrompt = e
  const dismissed = localStorage.getItem('pwa-install-dismissed')
  if (!dismissed) showPrompt.value = true
}

async function install() {
  showPrompt.value = false
  if (!deferredPrompt) return
  deferredPrompt.prompt()
  await deferredPrompt.userChoice
  deferredPrompt = null
}

function dismiss() {
  showPrompt.value = false
  localStorage.setItem('pwa-install-dismissed', '1')
}

onMounted(() => window.addEventListener('beforeinstallprompt', handleBeforeInstall))
onUnmounted(() => window.removeEventListener('beforeinstallprompt', handleBeforeInstall))
</script>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(20px);
  opacity: 0;
}
</style>
