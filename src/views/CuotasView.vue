<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { Icon } from '@iconify/vue'
import { useCuotasStore, computeInstallmentMeta, computeInstallmentMetaForMonth } from '../store/useCuotasStore'
import { useSpaceStore } from '../store/useSpaceStore'
import { useToast } from '../composables/useToast'
import CreditCardModal from '../components/CreditCardModal.vue'
import InstallmentDrawer from '../components/InstallmentDrawer.vue'
import { formatCurrencyDisplay } from '../utils/Helpers'
import dayjs from 'dayjs'
import 'dayjs/locale/es'

dayjs.locale('es')

const store = useCuotasStore()
const spaceStore = useSpaceStore()
const { add: showToast } = useToast()

// ── Bootstrap ─────────────────────────────────────────────────────────────────
watch(
  () => spaceStore.currentSpaceId,
  (id) => { if (id) store.bootstrap(id) },
  { immediate: true },
)

// ── Selected card ─────────────────────────────────────────────────────────────
const selectedCardId = ref(null)

const selectedCard = computed(() =>
  store.creditCards.find((c) => c.id === selectedCardId.value) || store.creditCards[0] || null,
)

watch(
  () => store.creditCards,
  (cards) => {
    if (!selectedCardId.value && cards.length) {
      selectedCardId.value = cards[0].id
    }
  },
)

function selectCard(card) {
  selectedCardId.value = card.id
}

// ── Month navigator ───────────────────────────────────────────────────────────
const currentCalMonth = dayjs().format('YYYY-MM')
const viewMonth = ref(currentCalMonth)

const isCurrentMonth = computed(() => viewMonth.value === currentCalMonth)
const isMonthPast = computed(() => dayjs(viewMonth.value).isBefore(dayjs().startOf('month'), 'month'))

const viewMonthLabel = computed(() =>
  dayjs(viewMonth.value + '-01').format('MMMM YYYY'),
)

function prevMonth() {
  viewMonth.value = dayjs(viewMonth.value + '-01').subtract(1, 'month').format('YYYY-MM')
}

function nextMonth() {
  viewMonth.value = dayjs(viewMonth.value + '-01').add(1, 'month').format('YYYY-MM')
}

function resetToCurrentMonth() {
  viewMonth.value = currentCalMonth
}

// ── Monthly totals per card (month-aware) ──────────────────────────────────────
function monthlyPaymentForCardInMonth(cardId, targetMonth) {
  return store.installmentsByCard(cardId)
    .filter((i) => i.status !== 'cancelled')
    .reduce((sum, inst) => {
      const meta = computeInstallmentMetaForMonth(inst, targetMonth)
      return meta.visibleInMonth ? sum + Number(inst.installment_amount) : sum
    }, 0)
}

// ── KPIs ──────────────────────────────────────────────────────────────────────
const totalMonthlyForView = computed(() =>
  store.installments
    .filter((i) => i.status !== 'cancelled')
    .reduce((sum, inst) => {
      const meta = computeInstallmentMetaForMonth(inst, viewMonth.value)
      return meta.visibleInMonth ? sum + Number(inst.installment_amount) : sum
    }, 0),
)

const nextDueDate = computed(() => {
  const card = store.nextDueCard
  if (!card) return null
  const today = dayjs()
  const day = Number(card.due_date_day)
  let due = today.date(day)
  if (due.isBefore(today, 'day')) due = due.add(1, 'month')
  return due
})

const nextDueDateDisplay = computed(() => {
  if (!nextDueDate.value) return '—'
  return nextDueDate.value.format('D [de] MMMM')
})

// ── Credit Card modal ─────────────────────────────────────────────────────────
const showCardModal = ref(false)
const editingCard = ref(null)

function openNewCard() {
  editingCard.value = null
  showCardModal.value = true
}

function openEditCard(card) {
  editingCard.value = { ...card }
  showCardModal.value = true
}

async function handleSaveCard(payload) {
  try {
    const saved = await store.upsertCreditCard(payload)
    showCardModal.value = false
    selectedCardId.value = saved.id
    showToast(payload.id ? 'Tarjeta actualizada' : 'Tarjeta añadida')
  } catch (err) {
    showToast(err.message || 'Error al guardar tarjeta')
  }
}

const showDeleteCardDialog = ref(false)
const deletingCard = ref(null)

function confirmDeleteCard(card) {
  deletingCard.value = card
  showDeleteCardDialog.value = true
}

async function executeDeleteCard() {
  if (!deletingCard.value) return
  try {
    await store.deleteCreditCard(deletingCard.value.id)
    showDeleteCardDialog.value = false
    if (selectedCardId.value === deletingCard.value.id) {
      selectedCardId.value = store.creditCards[0]?.id || null
    }
    showToast('Tarjeta eliminada')
  } catch (err) {
    showToast(err.message || 'Error al eliminar tarjeta')
  }
}

// ── Installment drawer ────────────────────────────────────────────────────────
const showInstDrawer = ref(false)
const editingInst = ref(null)

function openNewInstallment() {
  editingInst.value = null
  showInstDrawer.value = true
}

function openEditInstallment(inst) {
  editingInst.value = { ...inst }
  showInstDrawer.value = true
}

async function handleSaveInstallment(payload) {
  try {
    await store.upsertInstallment(payload)
    showInstDrawer.value = false
    showToast(payload.id ? 'Cuota actualizada' : 'Cuota agregada')
  } catch (err) {
    showToast(err.message || 'Error al guardar cuota')
  }
}

async function handleDeleteInstallment(id) {
  try {
    await store.deleteInstallment(id)
    showToast('Cuota eliminada')
  } catch (err) {
    showToast(err.message || 'Error al eliminar cuota')
  }
}

// ── Card installments for the selected month ──────────────────────────────────
const cardInstallmentsForMonth = computed(() => {
  if (!selectedCard.value) return []

  return store.installmentsByCard(selectedCard.value.id)
    .map((inst) => {
      const meta = computeInstallmentMetaForMonth(inst, viewMonth.value)
      return { inst, meta }
    })
    .filter(({ meta }) => {
      if (meta.visibleInMonth) return true
      // In the current month: also surface upcoming installments starting within the next 3 months
      if (isCurrentMonth.value && meta.isFutureStart) return true
      return false
    })
})

// ── Formatting ────────────────────────────────────────────────────────────────
function currency(amount) {
  return formatCurrencyDisplay(amount, 'ARS')
}

// ── Card color resolution ─────────────────────────────────────────────────────
const CARD_COLOR_PRESETS = {
  'midnight':   { from: '#0D0D0D', to: '#1a1a2e' },
  'space-gray': { from: '#1C1C1E', to: '#3A3A3C' },
  'slate':      { from: '#263238', to: '#37474F' },
  'platinum':   { from: '#546E7A', to: '#78909C' },
  'white':      { from: '#E8E8E8', to: '#CFD8DC' },
  'navy':       { from: '#0A1628', to: '#1a237e' },
  'royal':      { from: '#1565C0', to: '#0D47A1' },
  'cobalt':     { from: '#1a237e', to: '#283593' },
  'indigo':     { from: '#311B92', to: '#4527A0' },
  'purple':     { from: '#4A148C', to: '#6A1B9A' },
  'violet':     { from: '#2D1B69', to: '#512DA8' },
  'teal':       { from: '#004D40', to: '#00695C' },
  'forest':     { from: '#1B5E20', to: '#2E7D32' },
  'gold':       { from: '#7B5800', to: '#B8860B' },
  'rose-gold':  { from: '#8B3A4A', to: '#C4687A' },
  'copper':     { from: '#6D2D0E', to: '#A0522D' },
  'orange':     { from: '#BF360C', to: '#E64A19' },
  'burgundy':   { from: '#4A0000', to: '#7B0000' },
}

function cardGradient(colorKey) {
  if (!colorKey) return 'linear-gradient(135deg, #0A1628, #1a237e)'
  const preset = CARD_COLOR_PRESETS[colorKey]
  if (preset) return `linear-gradient(135deg, ${preset.from} 0%, ${preset.to} 100%)`
  if (colorKey.startsWith('#')) return `linear-gradient(135deg, ${colorKey} 0%, ${colorKey}bb 100%)`
  return 'linear-gradient(135deg, #0A1628, #1a237e)'
}

function isLightCard(colorKey) {
  const preset = CARD_COLOR_PRESETS[colorKey]
  const hex = (preset?.from || colorKey || '#0A1628').replace('#', '')
  if (hex.length < 6) return false
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 140
}

const ICON_MAP = {
  'device-laptop': 'tabler:device-laptop',
  'plane': 'tabler:plane',
  'sofa': 'tabler:sofa',
  'device-mobile': 'tabler:device-mobile',
  'car': 'tabler:car',
  'home': 'tabler:home',
  'shirt': 'tabler:shirt',
  'heart': 'tabler:heart',
  'tool': 'tabler:tool',
  'shopping-bag': 'tabler:shopping-bag',
  'receipt': 'tabler:receipt',
}

function iconFor(key) {
  return ICON_MAP[key] || 'tabler:receipt'
}

const CARD_TYPE_ICON = {
  visa: 'tabler:brand-visa',
  mastercard: 'tabler:brand-mastercard',
  amex: 'tabler:credit-card',
  other: 'tabler:credit-card',
}

function cardTypeIcon(type) {
  return CARD_TYPE_ICON[type] || 'tabler:credit-card'
}

// ── Context menus ─────────────────────────────────────────────────────────────
const openCardMenuId = ref(null)
const openRowMenuId = ref(null)

function toggleCardMenu(id) {
  openCardMenuId.value = openCardMenuId.value === id ? null : id
}

function closeCardMenus() {
  openCardMenuId.value = null
}

function toggleRowMenu(id) {
  openRowMenuId.value = openRowMenuId.value === id ? null : id
}

function handleDocClick(e) {
  const target = e.target
  if (!(target instanceof Element)) return
  if (!target.closest('.card-menu-wrapper')) closeCardMenus()
  if (!target.closest('.row-menu-wrapper')) openRowMenuId.value = null
}

onMounted(() => document.addEventListener('click', handleDocClick))
onBeforeUnmount(() => document.removeEventListener('click', handleDocClick))

const canEdit = computed(() => {
  if (!spaceStore.currentSpaceId) return true
  const space = spaceStore.spaces.find((s) => s.id === spaceStore.currentSpaceId)
  if (!space) return false
  return space.isOwner === true || space.memberRole === 'editor'
})
</script>

<template>
  <section class="cuotas-page">
    <!-- Header -->
    <div class="goals-header">
      <div>
        <h2 class="goals-header__title">
          Cuotas y tarjetas 
        </h2>
        <p class="body-md goals-header__sub">
          Controla tus cuotas y tarjetas de crédito en una sola vista.
        </p>
      </div>
    </div>

    <!-- ── KPI Row ──────────────────────────────────────────────────────────── -->
    <div class="planning-kpi-grid">
      <article class="planning-kpi">
        <span class="label-sm planning-kpi__label">GASTO EN {{ viewMonthLabel }}</span>
        <h3 class="display-sm planning-kpi__value">{{ currency(totalMonthlyForView) }}</h3>
        <span class="body-sm planning-kpi__delta delta-neutral">
          Suma de cuotas activas {{ isCurrentMonth ? 'este mes' : 'en este período' }}
        </span>
      </article>
    </div>

    <!-- ── Mis Tarjetas ─────────────────────────────────────────────────────── -->
    <div class="cards-section">
      <div class="section-topbar">
        <h2 class="section-title">Mis Tarjetas</h2>
        <div class="section-actions">
          <button v-if="canEdit" class="btn-add-card" @click="openNewCard">
            <Icon icon="tabler:plus" width="15" height="15" />
            Agregar Tarjeta
          </button>
        </div>
      </div>

      <!-- Empty state -->
      <div v-if="store.creditCards.length === 0 && !store.loading" class="empty-cards">
        <div class="empty-icon">
          <Icon icon="tabler:credit-card-off" width="36" height="36" />
        </div>
        <p class="empty-title">Sin tarjetas registradas</p>
        <p class="empty-sub">Añadí tu primera tarjeta de crédito para comenzar a trackear tus cuotas.</p>
        <button v-if="canEdit" class="btn-add-card" @click="openNewCard">
          <Icon icon="tabler:plus" width="15" height="15" />
          Añadir primera tarjeta
        </button>
      </div>

      <!-- Cards carousel -->
      <div v-else class="cards-carousel">
        <div
          v-for="card in store.creditCards"
          :key="card.id"
          class="credit-card"
          :class="{ selected: selectedCard?.id === card.id, 'card-light': isLightCard(card.color) }"
          :style="{ background: cardGradient(card.color) }"
          @click="selectCard(card)"
        >
          <div class="cc-deco cc-deco-1" />
          <div class="cc-deco cc-deco-2" />

          <div v-if="canEdit" class="card-menu-wrapper" @click.stop>
            <button class="card-menu-btn" @click.stop="toggleCardMenu(card.id)">
              <Icon icon="tabler:dots" width="15" height="15" />
            </button>
            <Transition name="dropdown">
              <div v-if="openCardMenuId === card.id" class="card-dropdown">
                <button class="dropdown-item" @click="openEditCard(card); closeCardMenus()">
                  <Icon icon="tabler:edit" width="14" height="14" />
                  Editar
                </button>
                <button class="dropdown-item dropdown-item--danger" @click="confirmDeleteCard(card); closeCardMenus()">
                  <Icon icon="tabler:trash" width="14" height="14" />
                  Eliminar
                </button>
              </div>
            </Transition>
          </div>

          <div class="cc-top">
            <div class="cc-chip"><div class="cc-chip-inner" /></div>
            <span class="cc-holder">{{ card.card_holder_type === 'extension' ? 'EXTENSIÓN' : 'TITULAR' }}</span>
          </div>

          <div class="flex flex-col gap-1 py-1">
            <div class="cc-amount-label">{{ viewMonthLabel }}</div>
            <div class="cc-amount">{{ currency(monthlyPaymentForCardInMonth(card.id, viewMonth)) }}</div>
          </div>

          <div class="cc-bottom">
            <div>
              <div class="cc-bank">{{ card.bank }}</div>
              <div class="cc-number">•••• {{ card.last_four || '····' }}</div>
            </div>
            <div class="cc-type">{{ card.card_type?.toUpperCase() }}</div>
          </div>
        </div>

        <button v-if="canEdit" class="credit-card credit-card--add" @click="openNewCard">
          <Icon icon="tabler:plus" width="28" height="28" />
          <span>Nueva tarjeta</span>
        </button>
      </div>
    </div>

    <!-- ── Detalle de Cuotas ────────────────────────────────────────────────── -->
    <div v-if="selectedCard" class="installments-section !px-5">
      <div class="installments-header">
        <div class="installments-header-left">
          <h3 class="installments-title">Detalle de cuotas</h3>
          <p class="installments-sub">{{ selectedCard.bank }} · {{ selectedCard.name }}</p>
        </div>
        <div class="flex justify-end w-full">
          <button v-if="canEdit" class="btn-new-expense" @click="openNewInstallment">
            <Icon icon="tabler:plus" width="15" height="15" />
            Agregar Cuota
          </button>
        </div>
      </div>

      <!-- Month navigator -->
      <div class="month-nav">
        <button class="month-nav-btn" @click="prevMonth">
          <Icon icon="tabler:chevron-left" width="16" height="16" />
        </button>
        <div class="month-nav-center">
          <span class="month-nav-label" :class="{ 'month-nav-label--past': isMonthPast }">
            <Icon v-if="isMonthPast" icon="tabler:history" width="13" height="13" />
            {{ viewMonthLabel }}
          </span>
          <button v-if="!isCurrentMonth" class="month-nav-today" @click="resetToCurrentMonth">
            Hoy
          </button>
        </div>
        <button class="month-nav-btn" @click="nextMonth">
          <Icon icon="tabler:chevron-right" width="16" height="16" />
        </button>
      </div>

      <!-- Empty installments -->
      <div v-if="store.installmentsByCard(selectedCard.id).length === 0" class="empty-installments">
        <Icon icon="tabler:receipt-off" width="28" height="28" />
        <p>No hay cuotas para esta tarjeta.</p>
        <button v-if="canEdit" class="btn-new-expense" @click="openNewInstallment">
          <Icon icon="tabler:plus" width="15" height="15" />
          Agregar cuota
        </button>
      </div>

      <div v-else-if="cardInstallmentsForMonth.length === 0" class="empty-installments">
        <Icon icon="tabler:calendar-off" width="28" height="28" />
        <p>Sin cuotas activas en {{ viewMonthLabel }}.</p>
      </div>

      <!-- Mobile cards + desktop table -->
      <div v-else>
        <div class="mobile-installments">
          <article
            v-for="{ inst, meta } in cardInstallmentsForMonth"
            :key="`mobile-${inst.id}`"
            class="installment-mobile-card"
            :class="{ 'row--past': isMonthPast, 'row--upcoming': meta.isFutureStart }"
          >
            <div class="installment-mobile-card__top">
              <div class="concept-wrap">
                <div class="concept-icon">
                  <Icon :icon="iconFor(inst.icon)" width="16" height="16" />
                </div>
                <div>
                  <span class="concept-name">{{ inst.description }}</span>
                  <span v-if="inst.store" class="concept-store">{{ inst.store }}</span>
                </div>
              </div>
              <div v-if="canEdit" class="row-menu-wrapper" @click.stop>
                <button class="row-menu-btn" @click="toggleRowMenu(inst.id)">
                  <Icon icon="tabler:dots-vertical" width="15" height="15" />
                </button>
                <Transition name="dropdown">
                  <div v-if="openRowMenuId === inst.id" class="row-dropdown">
                    <button class="dropdown-item" @click="openEditInstallment(inst); openRowMenuId = null">
                      <Icon icon="tabler:edit" width="14" height="14" />
                      Editar
                    </button>
                    <button class="dropdown-item dropdown-item--danger" @click="handleDeleteInstallment(inst.id); openRowMenuId = null">
                      <Icon icon="tabler:trash" width="14" height="14" />
                      Eliminar
                    </button>
                  </div>
                </Transition>
              </div>
            </div>

            <div class="installment-mobile-card__badge">
              <template v-if="inst.status === 'cancelled'">
                <span class="badge badge--cancelled">Cancelada</span>
              </template>
              <template v-else-if="meta.isFutureStart">
                <span class="badge badge--upcoming"><Icon icon="tabler:clock" width="11" height="11" />Próximo · {{ dayjs(inst.start_date).format('MMM YYYY') }}</span>
              </template>
              <template v-else-if="meta.isRecurring">
                <span class="badge badge--recurring"><Icon icon="tabler:refresh" width="11" height="11" />Recurrente</span>
              </template>
              <template v-else-if="meta.isLastInstallment">
                <span class="installment-badge badge--last">{{ meta.installmentNum }}/{{ inst.total_installments }}</span>
              </template>
              <template v-else>
                <span class="installment-badge" :class="{ 'badge--past': isMonthPast }">{{ meta.installmentNum }}/{{ inst.total_installments }}</span>
              </template>
            </div>

            <div class="installment-mobile-grid">
              <p><span>Monto cuota</span><strong>{{ meta.isFutureStart ? '—' : currency(inst.installment_amount) }}</strong></p>
              <p><span>Restante</span><strong>{{ meta.isFutureStart ? currency(inst.total_installments == null ? 0 : inst.total_installments * Number(inst.installment_amount)) : (meta.isRecurring ? '—' : (meta.isLastInstallment ? 'Liquidado' : currency(meta.montoRestante))) }}</strong></p>
              <p><span>Fin cuotas</span><strong>{{ meta.isRecurring ? 'Recurrente' : (meta.endDate ? meta.endDate.format('MMM YYYY') : '—') }}</strong></p>
            </div>
          </article>
        </div>

        <div class="table-wrapper table-wrapper--desktop">
          <table class="installments-table">
          <thead>
            <tr>
              <th>Compra / Concepto</th>
              <th class="col-center">Cuota</th>
              <th class="col-right">Monto cuota</th>
              <th class="col-right">Monto restante</th>
              <th class="col-center">Fin de cuotas</th>
              <th v-if="canEdit" class="col-actions"></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="{ inst, meta } in cardInstallmentsForMonth"
              :key="inst.id"
              class="installment-row"
              :class="{
                'row--past': isMonthPast,
                'row--upcoming': meta.isFutureStart,
              }"
            >
              <!-- Purchase name + store -->
              <td class="col-concept">
                <div class="concept-wrap">
                  <div class="concept-icon">
                    <Icon :icon="iconFor(inst.icon)" width="16" height="16" />
                  </div>
                  <div>
                    <span class="concept-name">{{ inst.description }}</span>
                    <span v-if="inst.store" class="concept-store">{{ inst.store }}</span>
                  </div>
                </div>
              </td>

              <!-- Installment badge for this month -->
              <td class="col-center">
                <template v-if="inst.status === 'cancelled'">
                  <span class="badge badge--cancelled">Cancelada</span>
                </template>
                <template v-else-if="meta.isFutureStart">
                  <span class="badge badge--upcoming">
                    <Icon icon="tabler:clock" width="11" height="11" />
                    Próximo · {{ dayjs(inst.start_date).format('MMM YYYY') }}
                  </span>
                </template>
                <template v-else-if="meta.isRecurring">
                  <span class="badge badge--recurring">
                    <Icon icon="tabler:refresh" width="11" height="11" />
                    Recurrente
                  </span>
                </template>
                <template v-else-if="meta.isLastInstallment">
                  <span class="installment-badge badge--last">
                    {{ meta.installmentNum }}/{{ inst.total_installments }}
                  </span>
                </template>
                <template v-else>
                  <span class="installment-badge" :class="{ 'badge--past': isMonthPast }">
                    {{ meta.installmentNum }}/{{ inst.total_installments }}
                  </span>
                </template>
              </td>

              <!-- Monthly amount -->
              <td class="col-right amount-cell" :class="{ 'cell--muted': meta.isFutureStart }">
                {{ meta.isFutureStart ? '—' : currency(inst.installment_amount) }}
              </td>

              <!-- Remaining -->
              <td class="col-right">
                <template v-if="meta.isFutureStart">
                  <span class="amount-remaining amount-remaining--preview">
                    {{ currency(inst.total_installments == null ? 0 : inst.total_installments * Number(inst.installment_amount)) }}
                  </span>
                </template>
                <template v-else-if="meta.isRecurring">
                  <span class="cell--muted">—</span>
                </template>
                <template v-else-if="meta.isLastInstallment">
                  <span class="badge badge--paid">Liquidado</span>
                </template>
                <template v-else>
                  <span class="amount-remaining">{{ currency(meta.montoRestante) }}</span>
                </template>
              </td>

              <!-- End date -->
              <td class="col-center date-cell">
                <template v-if="meta.isRecurring">
                  <span class="cell--muted">Recurrente</span>
                </template>
                <template v-else-if="meta.endDate">
                  {{ meta.endDate.format('MMM YYYY') }}
                </template>
                <template v-else>—</template>
              </td>

              <!-- Row actions -->
              <td v-if="canEdit" class="col-actions">
                <div class="row-menu-wrapper" @click.stop>
                  <button class="row-menu-btn" @click="toggleRowMenu(inst.id)">
                    <Icon icon="tabler:dots-vertical" width="15" height="15" />
                  </button>
                  <Transition name="dropdown">
                    <div v-if="openRowMenuId === inst.id" class="row-dropdown">
                      <button class="dropdown-item" @click="openEditInstallment(inst); openRowMenuId = null">
                        <Icon icon="tabler:edit" width="14" height="14" />
                        Editar
                      </button>
                      <button class="dropdown-item dropdown-item--danger" @click="handleDeleteInstallment(inst.id); openRowMenuId = null">
                        <Icon icon="tabler:trash" width="14" height="14" />
                        Eliminar
                      </button>
                    </div>
                  </Transition>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Table footer -->
        <div class="table-footer">
          <span class="footer-label">Total · {{ selectedCard.bank }} · {{ viewMonthLabel }}</span>
          <span class="footer-total">{{ currency(monthlyPaymentForCardInMonth(selectedCard.id, viewMonth)) }}</span>
        </div>
      </div>
    </div>
  </div>

  </section>

  <!-- ── Modals ──────────────────────────────────────────────────────────────── -->
  <CreditCardModal
    :open="showCardModal"
    :card="editingCard"
    @save="handleSaveCard"
    @close="showCardModal = false"
  />

  <InstallmentDrawer
    :open="showInstDrawer"
    :installment="editingInst"
    :credit-cards="store.creditCards"
    :preselected-card-id="selectedCard?.id || ''"
    @save="handleSaveInstallment"
    @close="showInstDrawer = false"
  />

  <!-- Delete card confirmation -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="showDeleteCardDialog" class="modal-overlay" @click.self="showDeleteCardDialog = false">
        <div class="modal-card delete-dialog">
          <div class="delete-header">
            <div class="delete-icon-wrap">
              <Icon icon="tabler:trash" width="22" height="22" />
            </div>
            <h3>Eliminar "{{ deletingCard?.bank }} {{ deletingCard?.name }}"</h3>
          </div>
          <p class="delete-msg">
            Esta acción eliminará la tarjeta y todas sus cuotas asociadas. No se puede deshacer.
          </p>
          <div class="delete-actions">
            <button class="btn-danger" @click="executeDeleteCard">Eliminar tarjeta</button>
            <button class="btn-ghost" @click="showDeleteCardDialog = false">Cancelar</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.cuotas-page {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

/* ── KPI Row ──────────────────────────────────────────────────────────────── */
.kpi-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

@media (min-width: 640px) {
  .kpi-row { grid-template-columns: 1fr 1fr; }
}

@media (min-width: 1024px) {
  .kpi-row { grid-template-columns: 1.5fr 1fr 1.5fr; }
}

.kpi-card {
  background: var(--color-surface-container-high);
  border-radius: 1.25rem;
  padding: 1.5rem 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  border: 1px solid rgba(70, 70, 82, 0.12);
}

.kpi-label {
  font-family: var(--font-body);
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--color-on-surface-muted);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.kpi-value {
  font-family: var(--font-display);
  font-size: 1.75rem;
  font-weight: 800;
  color: var(--color-secondary);
  letter-spacing: -0.02em;
  line-height: 1.1;
}

.kpi-value--primary { color: var(--color-primary); }

.kpi-sub {
  font-size: 0.75rem;
  color: var(--color-on-surface-muted);
}

/* ── Cards section ────────────────────────────────────────────────────────── */
.cards-section {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.section-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.section-title {
  font-family: var(--font-display);
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-on-surface);
  margin: 0;
  letter-spacing: -0.01em;
}

.btn-add-card {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0.625rem 1.1rem;
  background: var(--color-primary);
  color: var(--color-on-primary);
  border: 1.5px solid transparent;
  border-radius: 999px;
  font-family: var(--font-body);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: opacity 0.18s;
  flex-shrink: 0;
}
.btn-add-card:hover { opacity: 0.85; }

/* ── Cards carousel ───────────────────────────────────────────────────────── */
.cards-carousel {
  display: flex;
  gap: 1rem;
  overflow-x: auto;
  padding-bottom: 0.5rem;
  scrollbar-width: none;
  -ms-overflow-style: none;
  padding-top: 0.5rem;
}
.cards-carousel::-webkit-scrollbar { display: none; }

.credit-card {
  flex-shrink: 0;
  width: 270px;
  min-height: 148px;
  border-radius: 1.25rem;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  cursor: pointer;
  position: relative;
  transition: transform 0.2s, box-shadow 0.2s;
  overflow: hidden;
  border: 2px solid transparent;
}

.credit-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
}

.credit-card.selected {
  border-color: rgba(255, 255, 255, 0.3);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

.credit-card--add {
  width: 200px;
  background: transparent !important;
  border: 1.5px dashed var(--color-outline-variant) !important;
  align-items: center;
  justify-content: center;
  color: var(--color-on-surface-muted);
  font-family: var(--font-body);
  font-size: 0.85rem;
  font-weight: 600;
  gap: 0.5rem;
  transition: border-color 0.18s, color 0.18s, background 0.18s;
}
.credit-card--add:hover {
  background: var(--color-surface-container) !important;
  border-color: var(--color-on-surface-muted) !important;
  color: var(--color-on-surface) !important;
}

.cc-deco {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}
.cc-deco-1 {
  width: 160px;
  height: 160px;
  background: rgba(255,255,255,0.06);
  top: -50px;
  right: -40px;
}
.cc-deco-2 {
  width: 100px;
  height: 100px;
  background: rgba(255,255,255,0.04);
  bottom: -35px;
  left: -25px;
}
.card-light .cc-deco-1,
.card-light .cc-deco-2 { background: rgba(0,0,0,0.04); }

.cc-top {
  display: flex;
  flex-direction: column;
  align-items: start;
  gap: 0.5rem;
}

.cc-chip {
  width: 30px;
  height: 22px;
  border-radius: 4px;
  background: linear-gradient(135deg, #d4a843 0%, #f5d478 40%, #b8860b 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}
.cc-chip-inner {
  width: 20px;
  height: 15px;
  border-radius: 2px;
  border: 1px solid rgba(139,104,20,0.5);
  background: linear-gradient(135deg, #e8c050, #c89020);
  position: relative;
}
.cc-chip-inner::before {
  content: '';
  position: absolute;
  top: 50%; left: 0; right: 0;
  height: 1px;
  background: rgba(139,104,20,0.4);
  transform: translateY(-50%);
}
.cc-chip-inner::after {
  content: '';
  position: absolute;
  left: 50%; top: 0; bottom: 0;
  width: 1px;
  background: rgba(139,104,20,0.4);
  transform: translateX(-50%);
}

.cc-holder {
  font-size: 0.58rem;
  font-weight: 800;
  color: rgba(255,255,255,0.6);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.card-light .cc-holder { color: rgba(0,0,0,0.5); }

.cc-amount-label {
  font-family: var(--font-body);
  font-size: 0.58rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.5);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-top: auto;
  position: relative;
  z-index: 1;
}
.card-light .cc-amount-label { color: rgba(0,0,0,0.45); }

.cc-amount {
  font-family: var(--font-display);
  font-size: 1.05rem;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.95);
  letter-spacing: -0.01em;
  position: relative;
  z-index: 1;
}
.card-light .cc-amount { color: rgba(0,0,0,0.85); }

.cc-bottom {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-top: auto;
  position: relative;
  z-index: 1;
}

.cc-bank {
  font-family: var(--font-body);
  font-size: 0.62rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.55);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.card-light .cc-bank { color: rgba(0,0,0,0.45); }

.cc-number {
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.75rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
  letter-spacing: 0.1em;
}
.card-light .cc-number { color: rgba(0,0,0,0.75); }

.cc-type {
  font-family: var(--font-display);
  font-size: 0.9rem;
  font-weight: 900;
  color: rgba(255,255,255,0.8);
  font-style: italic;
}
.card-light .cc-type { color: rgba(0,0,0,0.65); }

/* Card context menu */
.card-menu-wrapper {
  position: absolute;
  top: 0.65rem;
  right: 0.65rem;
  z-index: 6;
}

.card-menu-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: none;
  background: rgba(255, 255, 255, 0.14);
  border-radius: 10px;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.8);
  transition: background 0.15s;
  opacity: 1;
  position: relative;
  z-index: 7;
}
.card-menu-btn:hover { background: rgba(255, 255, 255, 0.2); }

.card-dropdown,
.row-dropdown {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  background: var(--color-surface-bright);
  border-radius: 10px;
  padding: 5px;
  box-shadow: var(--shadow-float);
  z-index: 100;
  min-width: 130px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  background: none;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-family: var(--font-body);
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-on-surface);
  text-align: left;
  transition: background 0.12s;
}
.dropdown-item:hover { background: var(--color-surface-container-highest); }
.dropdown-item--danger { color: var(--color-error); }
.dropdown-item--danger:hover { background: rgba(255, 180, 171, 0.1); }

/* ── Installments section ─────────────────────────────────────────────────── */
.installments-section {
  background: var(--color-surface-container-high);
  border-radius: 1.5rem;
  padding: 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  border: 1px solid rgba(70, 70, 82, 0.1);
}

.installments-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.installments-header-left { display: flex; flex-direction: column; gap: 4px; }

.installments-title {
  font-family: var(--font-display);
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--color-on-surface);
  margin: 0;
  letter-spacing: -0.01em;
}

.installments-sub {
  font-family: var(--font-body);
  font-size: 0.8rem;
  color: var(--color-on-surface-muted);
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
}

.btn-new-expense {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0.55rem 1rem;
  background: var(--color-secondary);
  color: var(--color-on-secondary);
  border: 1px solid rgba(68, 221, 193, 0.2);
  border-radius: 999px;
  font-family: var(--font-body);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.18s;
  white-space: nowrap;
}
.btn-new-expense:hover { opacity: 0.85; }

/* ── Month navigator ──────────────────────────────────────────────────────── */
.month-nav {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0.875rem;
  background: var(--color-surface-container);
  border-radius: 0.875rem;
  width: fit-content;
}

.month-nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0 !important;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  color: var(--color-on-surface-muted);
  transition: background 0.15s, color 0.15s;
  flex-shrink: 0;
}
.month-nav-btn:hover {
  background: var(--color-surface-container-high);
  color: var(--color-on-surface);
}

.month-nav-center {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  min-width: 160px;
  justify-content: center;
}

.month-nav-label {
  font-family: var(--font-display);
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--color-on-surface);
  text-transform: capitalize;
  display: flex;
  align-items: center;
  gap: 5px;
}
.month-nav-label--past {
  color: var(--color-on-surface-muted);
}

.month-nav-today {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 99px;
  font-size: 0.72rem;
  font-weight: 600;
  font-family: var(--font-body);
  border: 1px solid rgba(68, 221, 193, 0.3);
  background: rgba(68, 221, 193, 0.08);
  color: var(--color-secondary);
  cursor: pointer;
  transition: background 0.15s;
}
.month-nav-today:hover { background: rgba(68, 221, 193, 0.15); }

/* ── Table ────────────────────────────────────────────────────────────────── */
.table-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0;
  overflow-x: auto;
}

.mobile-installments {
  display: none;
  gap: 0.75rem;
}

.installment-mobile-card {
  background: var(--color-surface-container);
  border: 1px solid rgba(70, 70, 82, 0.14);
  border-radius: 0.9rem;
  padding: 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.installment-mobile-card__top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.5rem;
}

.installment-mobile-card__badge {
  display: flex;
  justify-content: flex-start;
}

.installment-mobile-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.5rem;
}

.installment-mobile-grid p {
  margin: 0;
  display: flex;
  justify-content: space-between;
  gap: 0.6rem;
}

.installment-mobile-grid span {
  color: var(--color-on-surface-muted);
  font-size: 0.74rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.installment-mobile-grid strong {
  font-size: 0.86rem;
  color: var(--color-on-surface);
}

@media (max-width: 900px) {
  .table-wrapper--desktop { display: none; }
  .mobile-installments { display: grid; }
  .month-nav { 
    width: 100%; 
    justify-content: center;
  }
}

.installments-table {
  width: 100%;
  border-collapse: collapse;
  font-family: var(--font-body);
}

.installments-table thead tr {
  border-bottom: 1px solid rgba(70, 70, 82, 0.15);
}

.installments-table th {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--color-on-surface-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 0 1rem 0.875rem;
  text-align: left;
  white-space: nowrap;
}

.col-center { text-align: center !important; }
.col-right { text-align: right !important; }
.col-actions { width: 40px; }

.installment-row {
  border-bottom: 1px solid rgba(70, 70, 82, 0.07);
  transition: background 0.12s;
}
.installment-row:last-child { border-bottom: none; }
.installment-row:hover { background: rgba(255, 255, 255, 0.02); }

.row--past td { opacity: 0.65; }
.row--upcoming td { opacity: 0.7; }

.installments-table td {
  padding: 1rem;
  font-size: 0.875rem;
  color: var(--color-on-surface);
  vertical-align: middle;
}

.col-concept { min-width: 200px; }

.concept-wrap {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.concept-icon {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  background: var(--color-surface-container);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-on-surface-variant);
  flex-shrink: 0;
}

.concept-name {
  display: block;
  font-weight: 600;
  color: var(--color-on-surface);
  font-size: 0.875rem;
}

.concept-store {
  display: block;
  font-size: 0.75rem;
  color: var(--color-on-surface-muted);
}

/* Badges */
.installment-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 12px;
  border-radius: 999px;
  background: rgba(186, 195, 255, 0.1);
  color: var(--color-primary);
  font-size: 0.8rem;
  font-weight: 700;
  font-family: var(--font-display);
  white-space: nowrap;
}

.installment-badge.badge--past {
  background: rgba(70, 70, 82, 0.1);
  color: var(--color-on-surface-muted);
}

.installment-badge.badge--last {
  background: rgba(68, 221, 193, 0.1);
  color: var(--color-secondary);
}

.badge--paid {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(68, 221, 193, 0.1);
  color: var(--color-secondary);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.badge--cancelled {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(147, 143, 153, 0.1);
  color: var(--color-on-surface-muted);
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
}

.badge--recurring {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(68, 221, 193, 0.08);
  color: var(--color-secondary);
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border: 1px solid rgba(68, 221, 193, 0.2);
}

.badge--upcoming {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(186, 195, 255, 0.08);
  color: var(--color-primary);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  border: 1px dashed rgba(186, 195, 255, 0.3);
  white-space: nowrap;
}

.amount-cell {
  font-family: var(--font-display);
  font-weight: 700;
}

.amount-remaining {
  font-weight: 600;
  color: var(--color-on-surface-variant);
}
.amount-remaining--preview {
  color: var(--color-primary);
  opacity: 0.6;
  font-size: 0.82rem;
}

.date-cell {
  color: var(--color-on-surface-variant);
  font-size: 0.82rem;
  white-space: nowrap;
}

.cell--muted {
  color: var(--color-on-surface-muted);
  font-size: 0.82rem;
}

/* Row menu */
.row-menu-wrapper { position: relative; }

.row-menu-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 35px;
  height: 35px;
  padding: 0 !important;
  border: none;
  background: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--color-on-surface-muted);
  transition: background 0.15s, color 0.15s;
  opacity: 1;
}
.row-menu-btn:hover {
  background: var(--color-surface-container);
  color: var(--color-on-surface);
}

/* Table footer */
.table-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 1.5rem;
  padding: 1.25rem 1rem 0;
  border-top: 1px solid rgba(70, 70, 82, 0.15);
  margin-top: 0.5rem;
}

.footer-label {
  font-family: var(--font-body);
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--color-on-surface-muted);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.footer-total {
  font-family: var(--font-display);
  font-size: 1.35rem;
  font-weight: 800;
  color: var(--color-on-surface);
  letter-spacing: -0.02em;
}

/* ── Empty states ─────────────────────────────────────────────────────────── */
.empty-cards {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 3rem 2rem;
  text-align: center;
}

.empty-icon {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: var(--color-surface-container);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-on-surface-muted);
}

.empty-title {
  font-family: var(--font-display);
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-on-surface);
  margin: 0;
}

.empty-sub {
  font-family: var(--font-body);
  font-size: 0.875rem;
  color: var(--color-on-surface-muted);
  margin: 0;
  max-width: 320px;
}

.empty-installments {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 2rem;
  color: var(--color-on-surface-muted);
  text-align: center;
}

.empty-installments p {
  font-size: 0.875rem;
  margin: 0;
}

/* ── Dropdown animation ───────────────────────────────────────────────────── */
.dropdown-enter-active, .dropdown-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.dropdown-enter-from, .dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* ── Delete dialog ────────────────────────────────────────────────────────── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  padding: 1rem;
}

.modal-card {
  background: var(--color-surface-container-high);
  border-radius: 1.25rem;
  padding: 1.75rem;
  width: 100%;
  max-width: 440px;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  box-shadow: var(--shadow-float);
}

.delete-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.delete-header h3 {
  font-family: var(--font-display);
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--color-on-surface);
  margin: 0;
}

.delete-icon-wrap {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: rgba(255, 180, 171, 0.12);
  color: var(--color-error);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.delete-msg {
  font-size: 0.875rem;
  color: var(--color-on-surface-variant);
  margin: 0;
  line-height: 1.5;
}

.delete-actions {
  display: flex;
  gap: 10px;
}

.btn-danger {
  flex: 1;
  padding: 0.7rem 1rem;
  background: var(--color-error-container);
  color: var(--color-error);
  border: none;
  border-radius: 999px;
  font-family: var(--font-body);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.18s;
}
.btn-danger:hover { opacity: 0.85; }

.btn-ghost {
  flex: 1;
  padding: 0.7rem 1rem;
  background: transparent;
  color: var(--color-on-surface-variant);
  border: 1.5px solid var(--color-outline-variant);
  border-radius: 999px;
  font-family: var(--font-body);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.18s;
}
.btn-ghost:hover { background: var(--color-surface-container-high); }

/* ── Modal transition ─────────────────────────────────────────────────────── */
.modal-enter-active, .modal-leave-active { transition: opacity 0.2s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
</style>
