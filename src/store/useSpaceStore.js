import { defineStore } from 'pinia'
import { listMySpaces } from '../services/spacesService'

export const useSpaceStore = defineStore('space', {
  state: () => ({
    spaces: [],
    currentSpaceId: null,
    loading: false,
  }),
  getters: {
    currentSpace: (state) => state.spaces.find((s) => s.id === state.currentSpaceId) || null,
    hasSelectedSpace: (state) => Boolean(state.currentSpaceId),
    // true for: space owner or space editor
    canEdit: (state) => {
      if (!state.currentSpaceId) return false
      const space = state.spaces.find((s) => s.id === state.currentSpaceId)
      if (!space) return false
      return space.isOwner === true || space.memberRole === 'editor'
    },
  },
  actions: {
    async bootstrap() {
      this.loading = true
      try {
        this.spaces = await listMySpaces()
        const exists = this.spaces.some((s) => s.id === this.currentSpaceId)
        if (!exists) this.currentSpaceId = this.spaces[0]?.id || null
      } catch (_) {
        // Silently ignore — spaces are optional
      } finally {
        this.loading = false
      }
    },
    setSpace(spaceId) {
      this.currentSpaceId = spaceId || null
    },
    addSpace(space) {
      this.spaces.unshift({ ...space, isOwner: true })
    },
    removeSpace(id) {
      this.spaces = this.spaces.filter((s) => s.id !== id)
      if (this.currentSpaceId === id) this.currentSpaceId = this.spaces[0]?.id || null
    },
  },
})
