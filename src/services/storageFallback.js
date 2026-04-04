const keys = {
  expenses: 'fp_expenses',
  goals: 'fp_goals',
}

export function getLocalCollection(type) {
  try {
    return JSON.parse(localStorage.getItem(keys[type]) || '[]')
  } catch {
    return []
  }
}

export function setLocalCollection(type, data) {
  localStorage.setItem(keys[type], JSON.stringify(data))
}

export function upsertLocalItem(type, payload) {
  const list = getLocalCollection(type)
  if (payload.id) {
    const idx = list.findIndex((item) => item.id === payload.id)
    if (idx >= 0) list[idx] = payload
    else list.unshift(payload)
  } else {
    list.unshift({ ...payload, id: crypto.randomUUID() })
  }
  setLocalCollection(type, list)
  return list
}

export function deleteLocalItem(type, id) {
  const next = getLocalCollection(type).filter((item) => item.id !== id)
  setLocalCollection(type, next)
  return next
}
