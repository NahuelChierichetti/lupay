<script setup>
import { computed } from 'vue'
import VueApexCharts from 'vue3-apexcharts'
import { currency } from '../../utils/finance'

const props = defineProps({
  values: { type: Object, required: true },
  categoryColors: { type: Object, default: () => ({}) },
})

const fallbackPalette = ['#BAC3FF', '#44DDC1', '#CDBDFF', '#464652', '#F4C55B', '#FFB4AB']

function normalizeCategoryName(name) {
  return String(name || '').trim().toLowerCase()
}

const sortedEntries = computed(() =>
  Object.entries(props.values || {}).sort(([, amountA], [, amountB]) => Number(amountB || 0) - Number(amountA || 0)),
)

const categories = computed(() => sortedEntries.value.map(([name]) => name))
const amounts = computed(() => sortedEntries.value.map(([, amount]) => Number(amount || 0)))
const total = computed(() => amounts.value.reduce((s, v) => s + v, 0))

const percentages = computed(() =>
  amounts.value.map((v) => (total.value > 0 ? Math.round((v / total.value) * 100) : 0)),
)

const chartColors = computed(() =>
  categories.value.map(
    (cat, idx) => props.categoryColors?.[normalizeCategoryName(cat)] || fallbackPalette[idx % fallbackPalette.length],
  ),
)

const chartOptions = computed(() => ({
  chart: {
    type: 'donut',
    background: 'transparent',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  colors: chartColors.value,
  labels: categories.value,
  stroke: {
    show: false,
  },
  dataLabels: { enabled: false },
  legend: { show: false },
  plotOptions: {
    pie: {
      donut: {
        size: '72%',
        labels: {
          show: true,
          name: {
            show: true,
            fontSize: '13px',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontWeight: 500,
            color: '#6B6876',
            offsetY: 20,
            formatter: () => 'RESUMEN',
          },
          value: {
            show: true,
            fontSize: '32px',
            fontFamily: 'Manrope, system-ui, sans-serif',
            fontWeight: 800,
            color: '#E5E2E1',
            offsetY: -12,
            formatter: () => '100%',
          },
          total: {
            show: true,
            showAlways: true,
            fontSize: '13px',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontWeight: 500,
            color: '#6B6876',
            label: 'RESUMEN',
            formatter: () => '100%',
          },
        },
      },
    },
  },
  tooltip: {
    enabled: true,
    theme: 'dark',
    style: { fontFamily: 'Inter, system-ui, sans-serif' },
    y: {
      formatter: (val) => currency(val),
    },
  },
  states: {
    hover: { filter: { type: 'lighten', value: 0.1 } },
    active: { filter: { type: 'none' } },
  },
}))
</script>

<template>
  <section class="planning-chart-card">
    <h3 class="headline-md">Distribución</h3>
    <div class="distribution-layout">
      <div class="distribution-chart">
        <VueApexCharts
          type="donut"
          width="100%"
          :options="chartOptions"
          :series="amounts"
        />
      </div>
      <ul class="distribution-legend">
        <li
          v-for="(cat, idx) in categories"
          :key="cat"
          class="distribution-legend__item"
        >
          <span
            class="distribution-legend__dot"
            :style="{ background: chartColors[idx] }"
          />
          <span class="distribution-legend__name">{{ cat }}</span>
          <strong class="distribution-legend__pct">{{ percentages[idx] }}%</strong>
        </li>
      </ul>
    </div>
  </section>
</template>
