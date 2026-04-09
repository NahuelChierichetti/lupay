<script setup>
import { computed } from 'vue'
import VueApexCharts from 'vue3-apexcharts'
import { currency } from '../../utils/finance'

const props = defineProps({
  trend: { type: Array, required: true },
  previousTrend: { type: Array, default: () => [] },
})

const chartOptions = computed(() => ({
  chart: {
    type: 'area',
    height: 340,
    background: 'transparent',
    toolbar: { show: false },
    zoom: { enabled: false },
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  colors: ['#44DDC1', '#464652'],
  fill: {
    type: 'gradient',
    gradient: {
      shadeIntensity: 1,
      opacityFrom: 0.45,
      opacityTo: 0.05,
      stops: [0, 90, 100],
      colorStops: [
        [
          { offset: 0, color: '#44DDC1', opacity: 0.4 },
          { offset: 60, color: '#0A3D35', opacity: 0.1 },
          { offset: 100, color: '#131313', opacity: 0 },
        ],
        [
          { offset: 0, color: '#464652', opacity: 0.15 },
          { offset: 100, color: '#131313', opacity: 0 },
        ],
      ],
    },
  },
  stroke: {
    curve: 'smooth',
    width: [3, 2],
    dashArray: [0, 6],
  },
  dataLabels: { enabled: false },
  grid: {
    borderColor: 'rgba(70, 70, 82, 0.15)',
    strokeDashArray: 0,
    xaxis: { lines: { show: false } },
    yaxis: { lines: { show: true } },
    padding: { left: 8, right: 8 },
  },
  xaxis: {
    categories: props.trend.map((item) => item.month),
    axisBorder: { show: false },
    axisTicks: { show: false },
    labels: {
      style: {
        colors: '#6B6876',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '11px',
        fontWeight: 500,
      },
    },
  },
  yaxis: {
    show: false,
  },
  legend: {
    show: true,
    position: 'top',
    horizontalAlign: 'right',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: '12px',
    fontWeight: 500,
    labels: { colors: '#9E9BA0' },
    markers: {
      size: 5,
      shape: 'circle',
      offsetX: -4,
    },
    itemMargin: { horizontal: 12 },
  },
  tooltip: {
    theme: 'dark',
    style: { fontFamily: 'Inter, system-ui, sans-serif' },
    x: { show: true },
    y: {
      formatter: (val) => currency(val),
    },
    marker: { show: true },
    custom({ series, seriesIndex, dataPointIndex, w }) {
      const val = series[seriesIndex][dataPointIndex]
      const label = w.globals.categoryLabels[dataPointIndex] || ''
      return `<div class="planning-tooltip">
        <span class="planning-tooltip__label">${label}</span>
        <span class="planning-tooltip__value">${currency(val)}</span>
      </div>`
    },
  },
}))

const previousLabel = computed(() => {
  const n = props.previousTrend.length
  if (!n) return ''
  // Detect if labels look like months (e.g. "ENE 25") vs days ("01/04")
  const sample = props.previousTrend[0]?.month || ''
  return sample.includes('/') ? 'Período Anterior' : 'Período Anterior'
})

const chartSeries = computed(() => {
  const series = [
    {
      name: 'Gastos Actuales',
      data: props.trend.map((item) => item.value),
    },
  ]
  if (props.previousTrend.length) {
    series.push({
      name: previousLabel.value || 'Período Anterior',
      data: props.previousTrend.map((item) => item.value),
    })
  }
  return series
})

const chartKey = computed(() =>
  props.trend.map((i) => i.month).join(','),
)
</script>

<template>
  <section class="planning-chart-card">
    <h3 class="headline-md">Tendencia Temporal</h3>
    <VueApexCharts
      :key="chartKey"
      type="area"
      height="340"
      :options="chartOptions"
      :series="chartSeries"
    />
  </section>
</template>
