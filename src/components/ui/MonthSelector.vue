<script setup>
import { computed, ref } from 'vue'
import dayjs from 'dayjs'
import { Icon } from '@iconify/vue'

const props = defineProps({
  modelValue: { type: String, required: true }, // 'YYYY-MM'
})
const emit = defineEmits(['update:modelValue'])

const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const current = computed(() => dayjs(props.modelValue + '-01'))
const label = computed(() => `${MONTHS_ES[current.value.month()]} ${current.value.year()}`)

const showGrid = ref(false)
// Year displayed in the dropdown grid (can differ from selected month's year)
const gridYear = ref(current.value.year())

function prev() {
  emit('update:modelValue', current.value.subtract(1, 'month').format('YYYY-MM'))
}

function next() {
  // Don't allow navigating past next month
  const cap = dayjs().add(1, 'month')
  const candidate = current.value.add(1, 'month')
  if (candidate.isAfter(cap, 'month')) return
  emit('update:modelValue', candidate.format('YYYY-MM'))
}

function openGrid() {
  gridYear.value = current.value.year()
  showGrid.value = !showGrid.value
}

function selectMonth(monthIndex) {
  emit('update:modelValue', dayjs(`${gridYear.value}-${String(monthIndex + 1).padStart(2, '0')}-01`).format('YYYY-MM'))
  showGrid.value = false
}

function isSelected(monthIndex) {
  return current.value.month() === monthIndex && current.value.year() === gridYear.value
}

function isFuture(monthIndex) {
  const cap = dayjs().add(1, 'month')
  return dayjs(`${gridYear.value}-${String(monthIndex + 1).padStart(2, '0')}-01`).isAfter(cap, 'month')
}

function closeGrid() {
  showGrid.value = false
}
</script>

<template>
  <div class="month-selector" v-click-outside="closeGrid">
    <button class="nav-btn" :disabled="current.isBefore(dayjs().subtract(23, 'month'), 'month')" @click="prev">
      <Icon icon="tabler:chevron-left" width="18" height="18" />
    </button>

    <button class="label-btn" @click="openGrid">
      {{ label }}
      <Icon
        icon="tabler:chevron-down"
        width="14"
        height="14"
        :style="{ transform: showGrid ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }"
      />
    </button>

    <button class="nav-btn" :disabled="current.isSame(dayjs().add(1, 'month'), 'month') || current.isAfter(dayjs(), 'month')" @click="next">
      <Icon icon="tabler:chevron-right" width="18" height="18" />
    </button>

    <!-- Month grid dropdown -->
    <Transition name="dropdown">
      <div v-if="showGrid" class="month-grid-dropdown">
        <!-- Year navigation -->
        <div class="grid-year-nav">
          <button class="year-nav-btn" @click="gridYear--">
            <Icon icon="tabler:chevron-left" width="16" height="16" />
          </button>
          <span class="grid-year-label">{{ gridYear }}</span>
          <button class="year-nav-btn" :disabled="gridYear >= dayjs().year() + 1" @click="gridYear++">
            <Icon icon="tabler:chevron-right" width="16" height="16" />
          </button>
        </div>

        <!-- Month buttons -->
        <div class="month-grid">
          <button
            v-for="(name, idx) in MONTHS_ES"
            :key="idx"
            class="month-cell"
            :class="{ selected: isSelected(idx), disabled: isFuture(idx) }"
            :disabled="isFuture(idx)"
            @click="selectMonth(idx)"
          >
            {{ name.slice(0, 3) }}
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.month-selector {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0 !important;
  border: none;
  background: none;
  border-radius: 6px;
  cursor: pointer;
  color: #4b5563 !important;
  transition: background 0.15s, color 0.15s;
}
.nav-btn:hover:not(:disabled) {
  background: #f3f4f6;
  color: #111827;
}
.nav-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.label-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border: 1px solid #e5e7eb;
  background: #fff;
  border-radius: 8px;
  font-size: 0.9375rem;
  font-weight: 600;
  color: #111827;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  min-width: 148px;
  justify-content: center;
}
.label-btn:hover {
  background: #f9fafb;
  border-color: #d1d5db;
}

/* Dropdown */
.month-grid-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
  padding: 14px;
  width: 224px;
  z-index: 100;
}

.grid-year-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.grid-year-label {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #111827;
}

.year-nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0 !important;
  border: none;
  background: none;
  border-radius: 6px;
  cursor: pointer;
  color: #4b5563 !important;
  transition: background 0.15s;
}
.year-nav-btn:hover:not(:disabled) { background: #f3f4f6; }
.year-nav-btn:disabled { opacity: 0.3; cursor: not-allowed; }

.month-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.month-cell {
  padding: 7px 4px;
  border: none;
  background: none;
  border-radius: 7px;
  font-size: 0.8125rem;
  font-weight: 500;
  color: #374151;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
  text-align: center;
}
.month-cell:hover:not(.disabled):not(.selected) {
  background: #f3f4f6;
}
.month-cell.selected {
  background: #4a7c3f;
  color: #fff;
}
.month-cell.disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

/* Transition */
.dropdown-enter-active, .dropdown-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.dropdown-enter-from, .dropdown-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-6px);
}
</style>
