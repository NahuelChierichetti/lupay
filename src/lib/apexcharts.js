// Tree-shaken ApexCharts: register only the chart types and features the app uses.
// When adding a new chart type or feature, import it here and in vite.config.js optimizeDeps.
import VueApexCharts from 'vue3-apexcharts/core'
import 'apexcharts/area'
import 'apexcharts/donut'
import 'apexcharts/features/legend'
import 'apexcharts/features/annotations'

export default VueApexCharts
