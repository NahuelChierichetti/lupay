<script setup>
import { computed } from 'vue'
import VueApexCharts from 'vue3-apexcharts'
import { currency } from '../../utils/finance'

const props = defineProps({
  realData: { type: Array, default: () => [] },
  projectedData: { type: Array, default: () => [] },
  categories: { type: Array, default: () => [] },
  currentTotal: { type: Number, default: 0 },
})

const chartOptions = computed(() => ({
  chart: {
    type: 'area',
    height: 300,
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
    categories: props.categories,
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
  yaxis: { show: false },
  legend: {
    show: true,
    position: 'top',
    horizontalAlign: 'right',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: '12px',
    fontWeight: 500,
    labels: { colors: '#9E9BA0' },
    markers: { size: 5, shape: 'circle', offsetX: -4 },
    itemMargin: { horizontal: 12 },
  },
  annotations: {
    points: props.realData.length
      ? [
          {
            x: props.categories[props.realData.length - 1],
            y: props.realData[props.realData.length - 1],
            marker: { size: 0 },
            label: {
              text: `ESTADO ACTUAL  ${currency(props.currentTotal)}`,
              borderColor: '#44DDC1',
              borderWidth: 1,
              borderRadius: 8,
              style: {
                background: '#0A3D35',
                color: '#44DDC1',
                fontSize: '11px',
                fontWeight: 700,
                fontFamily: 'Inter, system-ui, sans-serif',
                padding: { left: 10, right: 10, top: 6, bottom: 6 },
              },
              offsetY: -16,
            },
          },
        ]
      : [],
  },
  tooltip: {
    theme: 'dark',
    style: { fontFamily: 'Inter, system-ui, sans-serif' },
    x: { show: true },
    y: { formatter: (val) => currency(val) },
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

const chartSeries = computed(() => {
  const series = []
  if (props.realData.length) {
    series.push({ name: 'Ahorro Real', data: props.realData })
  }
  if (props.projectedData.length) {
    series.push({ name: 'Proyectado', data: props.projectedData })
  }
  return series
})

const chartKey = computed(() =>
  props.categories.join(',') + props.realData.join(','),
)
</script>

<template>
  <section class="planning-chart-card goals-patrimony-chart">
    <div class="goals-patrimony-chart__header">
      <div>
        <h3 class="headline-md">Evolución de Patrimonio</h3>
        <p class="body-sm" style="margin: 4px 0 0">
          Tendencia de ahorro acumulado vs. Objetivos totales.
        </p>
      </div>
    </div>
    <VueApexCharts
      :key="chartKey"
      type="area"
      height="300"
      :options="chartOptions"
      :series="chartSeries"
    />
  </section>
</template>
