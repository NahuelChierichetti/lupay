<template>
  <Transition name="slide-up">
    <div
      v-if="showPrompt"
      class="fixed bottom-20 left-4 right-4 z-50 bg-surface rounded-2xl shadow-xl border border-surface-border p-4 flex gap-3 items-start"
    >
      <img src="./../../utils/logo-lupay-green.png" alt="LUPAY" class="w-12 h-12 rounded-xl flex-shrink-0" />
      <div class="flex-1 min-w-0">
        <template v-if="isIos">
          <p class="font-semibold text-on-surface text-sm">Instalar en iPhone</p>
          <ol class="mt-1 text-xs text-on-surface space-y-1 list-decimal list-inside">
            <li>Abrí esta página en Safari.</li>
            <li>Tocá el botón Compartir.</li>
            <li>Elegí “Agregar a pantalla de inicio”.</li>
          </ol>
        </template>
        <template v-else>
          <p class="font-semibold text-on-surface text-sm">Instalar LUPAY</p>
          <p class="text-xs text-on-surface">Agregá la app a tu pantalla de inicio</p>
        </template>
      </div>
      <div class="flex gap-2 flex-shrink-0 self-end">
        <button
          @click="dismiss"
          class="text-xs text-on-surface px-2 py-1 rounded-lg hover:bg-surface-container"
        >
          Ahora no
        </button>
        <button
          @click="handlePrimaryAction"
          class="text-xs font-semibold text-[#0e1a6e] bg-[#bac3ff] px-3 py-1 rounded-lg hover:bg-[#bac3ff]"
        >
          {{ isIos ? 'Cerrar' : 'Instalar' }}
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const showPrompt = ref(false)
const isIos = ref(false)
const isStandalone = ref(false)
let deferredPrompt = null

function handleBeforeInstall(e) {
  e.preventDefault()
  deferredPrompt = e
  const dismissed = localStorage.getItem('pwa-install-dismissed')
  if (!dismissed) showPrompt.value = true
}

async function handlePrimaryAction() {
  if (isIos.value || !deferredPrompt) {
    dismiss()
    return
  }

  showPrompt.value = false
  deferredPrompt.prompt()
  await deferredPrompt.userChoice
  deferredPrompt = null
}

function dismiss() {
  showPrompt.value = false
  localStorage.setItem('pwa-install-dismissed', '1')
}

onMounted(() => {
  isIos.value = /iPad|iPhone|iPod/.test(window.navigator.userAgent)
    || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1)
  isStandalone.value = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true

  const dismissed = localStorage.getItem('pwa-install-dismissed')
  if (isIos.value && !isStandalone.value && !dismissed) {
    showPrompt.value = true
  }

  window.addEventListener('beforeinstallprompt', handleBeforeInstall)
})
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
