<script setup>
import { Chart as ChartJS, Legend, LineElement, LinearScale, PointElement, Title, Tooltip, CategoryScale } from 'chart.js'
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import { currency } from '../../utils/finance'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

const props = defineProps({
  trend: { type: Array, required: true },
})

const chartData = computed(() => ({
  labels: props.trend.map((item) => item.month),
  datasets: [
    {
      label: 'Evolución mensual',
      data: props.trend.map((item) => item.value),
      borderColor: '#5B8FF9',
      backgroundColor: '#5B8FF950',
      tension: 0.3,
    },
  ],
}))

const options = {
  responsive: true,
  plugins: {
    tooltip: {
      callbacks: {
        label: (ctx) => currency(ctx.raw),
      },
    },
  },
}
</script>

<template>
  <section class="card">
    <h3>Evolución mensual</h3>
    <Line :data="chartData" :options="options" />
  </section>
</template>
