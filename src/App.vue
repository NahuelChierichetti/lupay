<script setup>
import { ref } from 'vue'
import { RouterView } from 'vue-router'
import { registerSW } from 'virtual:pwa-register'
import ToastContainer from './components/ui/ToastContainer.vue'
import PwaInstallPrompt from './components/ui/PwaInstallPrompt.vue'

const showUpdateDialog = ref(false)

const updateServiceWorker = registerSW({
  immediate: true,
  onNeedRefresh() {
    showUpdateDialog.value = true
  },
})

const applyUpdate = async () => {
  showUpdateDialog.value = false
  await updateServiceWorker(true)
}

const dismissUpdate = () => {
  showUpdateDialog.value = false
}
</script>

<template>
  <RouterView />
  <ToastContainer />
  <PwaInstallPrompt />

  <div
    v-if="showUpdateDialog"
    class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4"
  >
    <div class="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
      <h3 class="text-base font-semibold text-slate-900">Hay una nueva versión</h3>
      <p class="mt-2 text-sm text-slate-600">
        Hay mejoras disponibles. Actualizá ahora para ver los cambios.
      </p>

      <div class="mt-5 flex justify-end gap-2">
        <button
          type="button"
          class="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          @click="dismissUpdate"
        >
          Más tarde
        </button>
        <button
          type="button"
          class="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
          @click="applyUpdate"
        >
          Actualizar
        </button>
      </div>
    </div>
  </div>
</template>
