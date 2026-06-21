const SUPABASE_URL = 'https://lfatskduuzwdqoomtphh.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_glIqqTFNY8hDXl_3qaEOFQ_BWX8QU8T'

async function supabaseFetch(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...options.headers,
    },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Supabase ${res.status}: ${err}`)
  }
  return res.json()
}

// ── Shelly Events ──────────────────────────────────────────────

export async function getDevices() {
  // Use the device_list view for unique device names
  const data = await supabaseFetch('device_list?select=*')
  return data
    .filter(row => row.shelly_name)
    .map(row => ({
      name: row.shelly_name,
      ip: row.shelly_ip,
    }))
}

export async function getLatestEvents(limit = 50) {
  const data = await supabaseFetch(
    `shelly_events?order=created_at.desc&limit=${limit}`
  )
  // Filter out false positive events (start events with negligible power)
  return data.filter(e => {
    if ((e.event_type === 'start' || e.event_type === 'on') && (e.power_watts || 0) < 10) return false;
    return true;
  })
}

export async function getDeviceEvents(name, limit = 100) {
  return supabaseFetch(
    `shelly_events?shelly_name=eq.${encodeURIComponent(name)}&order=created_at.desc&limit=${limit}`
  )
}

// Get ALL events for a device (no limit) — used for statistics
export async function getAllDeviceEvents(name) {
  return supabaseFetch(
    `shelly_events?shelly_name=eq.${encodeURIComponent(name)}&order=created_at.desc`
  )
}

export async function getDeviceStats(name) {
  // Fetch ALL events for accurate statistics (no limit)
  const events = await getAllDeviceEvents(name)
  if (events.length === 0) {
    console.warn(`getDeviceStats: no events for "${name}"`)
    return null
  }
  // Filter out false positive events (start events with negligible power)
  const filtered = events.filter(e => {
    if ((e.event_type === 'start' || e.event_type === 'on') && (e.power_watts || 0) < 10) return false;
    return true;
  })
  if (filtered.length === 0) {
    console.warn(`getDeviceStats: no valid events for "${name}" after filtering`)
    return null
  }
  console.log(`getDeviceStats: ${filtered.length}/${events.length} events for "${name}" (filtered ${events.length - filtered.length} false positives), last: ${filtered[0]?.event_type} @ ${filtered[0]?.power_watts}W`)

  const powerOn = filtered.filter(e => e.event_type === 'start' || e.event_type === 'on')
  const powerOff = filtered.filter(e => e.event_type === 'stop' || e.event_type === 'off')

  let totalEnergy = 0
  let totalDuration = 0
  let lastEvent = filtered[0]

  for (let i = 0; i < filtered.length - 1; i++) {
    const curr = filtered[i]
    const prev = filtered[i + 1]
    if (curr.total_energy_wh && prev.total_energy_wh) {
      const diff = Math.abs(curr.total_energy_wh - prev.total_energy_wh)
      if (diff < 10000) totalEnergy += diff
    }
    if (curr.created_at && prev.created_at) {
      const dur = (new Date(curr.created_at) - new Date(prev.created_at)) / 1000
      if (dur > 0 && dur < 86400) totalDuration += dur
    }
  }

  return {
    name,
    lastEvent,
    totalEvents: filtered.length,
    totalEnergyWh: totalEnergy,
    totalDurationS: totalDuration,
    avgPower: filtered.reduce((s, e) => s + (e.power_watts || 0), 0) / filtered.length,
    lastPower: lastEvent.power_watts || 0,
    lastVoltage: lastEvent.voltage || 0,
    lastEnergy: lastEvent.total_energy_wh || 0,
    isOn: (lastEvent.event_type === 'start' || lastEvent.event_type === 'on') && (lastEvent.power_watts || 0) > 10,
  }
}

export async function getDailyEnergy(days = 7) {
  const since = new Date()
  since.setDate(since.getDate() - days)
  const data = await supabaseFetch(
    `shelly_events?created_at=gte.${since.toISOString()}&select=shelly_name,total_energy_wh,created_at,event_type&order=created_at.asc`
  )

  // Filter out false positive events (start events with negligible power)
  const filtered = data.filter(e => {
    if ((e.event_type === 'start' || e.event_type === 'on') && (e.power_watts || 0) < 10) return false;
    return true;
  })

  const daily = {}
  for (const row of filtered) {
    const day = row.created_at?.slice(0, 10)
    if (!day) continue
    if (!daily[day]) daily[day] = {}
    if (!daily[day][row.shelly_name]) daily[day][row.shelly_name] = { first: null, last: null }
    if (!daily[day][row.shelly_name].first || row.created_at < daily[day][row.shelly_name].first.created_at) {
      daily[day][row.shelly_name].first = row
    }
    if (!daily[day][row.shelly_name].last || row.created_at > daily[day][row.shelly_name].last.created_at) {
      daily[day][row.shelly_name].last = row
    }
  }

  return Object.entries(daily).map(([day, devices]) => {
    const entry = { day }
    for (const [name, vals] of Object.entries(devices)) {
      if (vals.first?.total_energy_wh != null && vals.last?.total_energy_wh != null) {
        entry[name] = Math.abs(vals.last.total_energy_wh - vals.first.total_energy_wh)
      }
    }
    return entry
  })
}

// ── V2C Sessions ───────────────────────────────────────────────

export async function getV2CSessions(limit = 20) {
  return supabaseFetch(
    `v2c_charging_sessions?order=start_time.desc&limit=${limit}`
  )
}

export async function getV2CStats() {
  // Fetch ALL sessions for accurate statistics (no limit)
  const sessions = await supabaseFetch(
    'v2c_charging_sessions?select=total_energy_wh,duration_seconds,avg_power_watts,carro&order=start_time.desc'
  )
  if (sessions.length === 0) return null

  const totalEnergy = sessions.reduce((s, sess) => s + (sess.total_energy_wh || 0), 0)
  const totalDuration = sessions.reduce((s, sess) => s + (sess.duration_seconds || 0), 0)
  const avgPower = sessions.reduce((s, sess) => s + (sess.avg_power_watts || 0), 0) / sessions.length

  return {
    totalSessions: sessions.length,
    totalEnergyWh: totalEnergy,
    totalDurationS: totalDuration,
    avgPower,
    lastSession: sessions[0],
  }
}
