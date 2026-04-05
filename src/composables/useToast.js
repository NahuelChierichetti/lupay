import { reactive } from 'vue'

const toasts = reactive([])
let nextId = 0

export function useToast() {
  function add(message, type = 'info', duration = 4000) {
    const id = ++nextId
    toasts.push({ id, message, type, visible: false })
    // trigger enter animation on next tick
    setTimeout(() => {
      const toast = toasts.find((t) => t.id === id)
      if (toast) toast.visible = true
    }, 10)
    setTimeout(() => remove(id), duration)
  }

  function remove(id) {
    const toast = toasts.find((t) => t.id === id)
    if (!toast) return
    toast.visible = false
    setTimeout(() => {
      const idx = toasts.findIndex((t) => t.id === id)
      if (idx !== -1) toasts.splice(idx, 1)
    }, 350)
  }

  return { toasts, add, remove }
}
