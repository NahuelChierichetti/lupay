<script setup>
import { ArcElement, Chart as ChartJS, Legend, Tooltip } from 'chart.js'
import { computed } from 'vue'
import { Doughnut } from 'vue-chartjs'

ChartJS.register(ArcElement, Tooltip, Legend)

const props = defineProps({
  values: { type: Object, required: true },
})

const chartData = computed(() => ({
  labels: Object.keys(props.values),
  datasets: [
    {
      data: Object.values(props.values),
      backgroundColor: ['#5B8FF9', '#61DDAA', '#F6BD16', '#7262fd', '#78D3F8', '#9661BC'],
    },
  ],
}))
</script>

<template>
  <section class="card">
    <h3>Gastos por categoría</h3>
    <Doughnut :data="chartData" />
  </section>
</template>
