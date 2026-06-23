// ============================================================
// PRAYER TIMES — Dynamic Calculation Engine
// Method: University of Islamic Sciences, Karachi
// Fajr: 18° | Isha: 18° | Asr: Hanafi (shadow factor 2)
// Location: Chittoor, Andhra Pradesh (13.217°N, 79.100°E)
// Pincode: 517001 | Timezone: Asia/Kolkata (UTC+5:30)
// Verified against AlAdhan API — Feb 2026
// ============================================================

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

const CONFIG = {
  lat: 13.217,      // Chittoor city centre — verified
  lng: 79.100,      // Chittoor city centre — verified
  timezone: 5.5,
  fajrAngle: 18,    // Karachi method
  ishaAngle: 18,    // Karachi method
  asrFactor: 2      // Hanafi (later Asr)
};


const PRAYER_ORDER = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
// Main prayers only (exclude sunrise from current/next logic)
const MAIN_PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
const PRAYER_LABELS = {
  fajr: 'Fajr', sunrise: 'Sunrise', dhuhr: 'Dhuhr',
  asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha'
};

let updateInterval = null;
let midnightTimeout = null;

// ---- Solar Calculations ----

function julianDate(y, m, d) {
  if (m <= 2) { y--; m += 12; }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
}

function sunPosition(jd) {
  const D = jd - 2451545.0;
  const g = ((357.529 + 0.98560028 * D) % 360 + 360) % 360;
  const q = ((280.459 + 0.98564736 * D) % 360 + 360) % 360;
  const L = ((q + 1.915 * Math.sin(g * DEG) + 0.020 * Math.sin(2 * g * DEG)) % 360 + 360) % 360;
  const e = 23.439 - 0.00000036 * D;

  const declination = Math.asin(Math.sin(e * DEG) * Math.sin(L * DEG)) * RAD;
  let RA = Math.atan2(Math.cos(e * DEG) * Math.sin(L * DEG), Math.cos(L * DEG)) * RAD;
  RA = ((RA % 360) + 360) % 360;

  let eqt = (q - RA) * 4;
  if (eqt > 720) eqt -= 1440;
  if (eqt < -720) eqt += 1440;

  return { declination, equationOfTime: eqt };
}

function hourAngle(angle, lat, dec) {
  const cosHA = (-Math.sin(angle * DEG) - Math.sin(lat * DEG) * Math.sin(dec * DEG))
    / (Math.cos(lat * DEG) * Math.cos(dec * DEG));
  if (cosHA > 1 || cosHA < -1) return 0;
  return Math.acos(cosHA) * RAD / 15;
}

function hourAngleAlt(altitude, lat, dec) {
  const cosHA = (Math.sin(altitude * DEG) - Math.sin(lat * DEG) * Math.sin(dec * DEG))
    / (Math.cos(lat * DEG) * Math.cos(dec * DEG));
  if (cosHA > 1 || cosHA < -1) return 0;
  return Math.acos(cosHA) * RAD / 15;
}

// ---- Compute Prayer Times ----

function computePrayerTimes(date) {
  const { lat, lng, timezone, fajrAngle, ishaAngle, asrFactor } = CONFIG;
  const jd = julianDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const { declination: dec, equationOfTime: eqt } = sunPosition(jd);

  const dhuhr = 12 + timezone - lng / 15 - eqt / 60;
  const sunHA = hourAngle(0.8333, lat, dec);
  const fajrHA = hourAngle(fajrAngle, lat, dec);
  const ishaHA = hourAngle(ishaAngle, lat, dec);
  const asrAlt = Math.atan(1 / (asrFactor + Math.tan(Math.abs(lat - dec) * DEG))) * RAD;
  const asrHA = hourAngleAlt(asrAlt, lat, dec);

  const raw = {
    fajr: dhuhr - fajrHA,
    sunrise: dhuhr - sunHA,
    dhuhr: dhuhr,
    asr: dhuhr + asrHA,
    maghrib: dhuhr + sunHA,
    isha: dhuhr + ishaHA
  };

  const result = {};
  for (const key of PRAYER_ORDER) {
    const h = raw[key];
    const totalMin = Math.round(h * 60);
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setMinutes(totalMin);
    let hrs = Math.floor(((totalMin / 60) % 24 + 24) % 24);
    const mins = ((totalMin % 60) + 60) % 60;
    const period = hrs >= 12 ? 'PM' : 'AM';
    hrs = hrs % 12 || 12;
    result[key] = {
      name: PRAYER_LABELS[key],
      time: `${hrs}:${String(mins).padStart(2, '0')} ${period}`,
      date: d
    };
  }
  return result;
}

// ---- Prayer Status Logic ----

function getPrayerStatus(prayers, tomorrowFajr) {
  const now = new Date();
  const list = PRAYER_ORDER.map(k => ({ key: k, ...prayers[k] }));
  // Use only main prayers (no sunrise) for current/next logic
  const mainList = MAIN_PRAYERS.map(k => ({ key: k, ...prayers[k] }));

  let current = null;
  let next = null;

  for (let i = mainList.length - 1; i >= 0; i--) {
    if (now >= mainList[i].date) {
      current = mainList[i];
      next = mainList[i + 1] || null;
      break;
    }
  }

  if (!current) {
    current = { key: 'isha', name: 'Isha', date: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 20, 0) };
    next = mainList[0];
  }

  if (!next && tomorrowFajr) {
    next = { key: 'fajr', ...tomorrowFajr };
  } else if (!next) {
    next = mainList[0];
  }

  const total = next.date - current.date;
  const elapsed = now - current.date;
  const progress = total > 0 ? Math.max(0, Math.min(1, elapsed / total)) : 0;

  const remaining = Math.max(0, next.date - now);
  const hrs = Math.floor(remaining / 3600000);
  const mins = Math.floor((remaining % 3600000) / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  const countdown = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  return { current, next, progress, countdown, list };
}

// ---- SVG Arc Helpers ----

const ARC = { cx: 150, cy: 150, r: 120 };
const ARC_LEN = Math.PI * ARC.r;

function dotPosition(progress) {
  const angle = Math.PI * (1 - progress);
  return {
    x: ARC.cx + ARC.r * Math.cos(angle),
    y: ARC.cy - ARC.r * Math.sin(angle)
  };
}

// ---- Render ----

export function renderPrayerSection(container) {
  if (!container) return;
  destroyPrayerSection();

  const today = new Date();
  const prayers = computePrayerTimes(today);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowPrayers = computePrayerTimes(tomorrow);
  const tomorrowFajr = tomorrowPrayers.fajr;

  const status = getPrayerStatus(prayers, tomorrowFajr);
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const dot = dotPosition(status.progress);

  const cardsHtml = PRAYER_ORDER.map(key => {
    const p = prayers[key];
    const now = new Date();
    let cls = 'prayer-card';
    if (key === 'sunrise') cls += ' sunrise';
    else if (key === status.current.key) cls += ' current';
    else if (key === status.next.key) cls += ' next';
    else if (p.date < now) cls += ' past';
    const currentLabel = (key !== 'sunrise' && key === status.current.key) ? '<span class="prayer-card-badge">CURRENT</span>' : '';
    return `<div class="${cls}"><div class="prayer-card-name">${p.name}</div><div class="prayer-card-time">${p.time}</div>${currentLabel}</div>`;
  }).join('');

  container.innerHTML = `
    <div class="prayer-section">
      <div class="prayer-progress-wrapper">
        <svg class="prayer-progress-svg" viewBox="0 0 300 170" aria-hidden="true">
          <defs>
            <linearGradient id="pGold" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#A67C2E"/>
              <stop offset="50%" stop-color="#D4A843"/>
              <stop offset="100%" stop-color="#E8C564"/>
            </linearGradient>
            <filter id="arcGlow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          </defs>
          <path d="M 30 ${ARC.cy} A ${ARC.r} ${ARC.r} 0 0 1 270 ${ARC.cy}"
            fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="5" stroke-linecap="round"/>
          <path d="M 30 ${ARC.cy} A ${ARC.r} ${ARC.r} 0 0 1 270 ${ARC.cy}"
            fill="none" stroke="url(#pGold)" stroke-width="5" stroke-linecap="round"
            stroke-dasharray="${ARC_LEN}" stroke-dashoffset="${ARC_LEN * (1 - status.progress)}"
            class="progress-arc" filter="url(#arcGlow)"/>
          <circle cx="${dot.x}" cy="${dot.y}" r="7" fill="#D4A843" filter="url(#arcGlow)" class="progress-dot" id="progress-dot"/>
        </svg>
        <div class="prayer-progress-center">
          <div class="next-prayer-label">NEXT PRAYER</div>
          <div class="next-prayer-name" id="np-name">${status.next.name}</div>
          <div class="countdown-timer" id="cd-timer">${status.countdown}</div>
          <div class="next-prayer-time" id="np-time">${status.next.time}</div>
        </div>
      </div>
      <div class="prayer-cards-label">TODAY'S PRAYER TIMES</div>
      <div class="prayer-cards-grid" id="prayer-cards">${cardsHtml}</div>
      <div class="prayer-date">${dateStr}</div>
      <div class="prayer-location">Chittoor, AP · Hanafi</div>

      <div class="prayer-timing-note">
        Note: Timing may not be accurate, check below calender.
      </div>

      <button class="btn-timetable" id="view-timetable-btn">
        📅 View Annual Timetable
      </button>
    </div>
  `;

  // ---- Timetable Lightbox (appended to body to avoid transform conflicts) ----
  // Remove any existing lightbox from a previous render
  document.getElementById('timetable-lightbox')?.remove();

  const lightboxEl = document.createElement('div');
  lightboxEl.id = 'timetable-lightbox';
  lightboxEl.className = 'timetable-lightbox';
  lightboxEl.setAttribute('role', 'dialog');
  lightboxEl.setAttribute('aria-modal', 'true');
  lightboxEl.innerHTML = `
    <div class="lightbox-backdrop" id="lightbox-backdrop"></div>
    <div class="lightbox-panel">
      <button class="lightbox-close" id="lightbox-close" title="Close (Esc)">✕</button>
      <img src="/prayer-timetable.jpg" alt="Annual Prayer Timetable Chittoor" class="timetable-img" />
      <a href="/prayer-timetable.jpg" download="Chittoor-Namaz-Timetable.jpg" class="btn-download">
        ⬇ Download
      </a>
    </div>
  `;
  document.body.appendChild(lightboxEl);

  const openLightbox = () => {
    lightboxEl.classList.add('open');
    document.body.style.overflow = 'hidden';
    // Make everything else inert so no interaction leaks through
    document.getElementById('page-container')?.setAttribute('inert', '');
  };

  const closeLightbox = () => {
    lightboxEl.classList.remove('open');
    document.body.style.overflow = '';
    document.getElementById('page-container')?.removeAttribute('inert');
  };

  document.getElementById('view-timetable-btn')?.addEventListener('click', openLightbox);
  lightboxEl.querySelector('#lightbox-close')?.addEventListener('click', closeLightbox);
  lightboxEl.querySelector('#lightbox-backdrop')?.addEventListener('click', closeLightbox);

  const escHandler = (e) => { if (e.key === 'Escape') closeLightbox(); };
  document.addEventListener('keydown', escHandler);



  // Update every second
  updateInterval = setInterval(() => {

    const s = getPrayerStatus(prayers, tomorrowFajr);
    const timerEl = document.getElementById('cd-timer');
    if (timerEl) timerEl.textContent = s.countdown;
    const nameEl = document.getElementById('np-name');
    if (nameEl) nameEl.textContent = s.next.name;
    const timeEl = document.getElementById('np-time');
    if (timeEl) timeEl.textContent = s.next.time;
    const arc = container.querySelector('.progress-arc');
    if (arc) arc.setAttribute('stroke-dashoffset', ARC_LEN * (1 - s.progress));
    const dotEl = document.getElementById('progress-dot');
    if (dotEl) {
      const d = dotPosition(s.progress);
      dotEl.setAttribute('cx', d.x);
      dotEl.setAttribute('cy', d.y);
    }
    // Update card classes every tick (lightweight)
    const cards = document.querySelectorAll('#prayer-cards .prayer-card');
    cards.forEach((card, i) => {
      const key = PRAYER_ORDER[i];
      card.className = 'prayer-card';
      if (key === 'sunrise') { card.classList.add('sunrise'); return; }
      if (key === s.current.key) card.classList.add('current');
      else if (key === s.next.key) card.classList.add('next');
      else if (s.list[i]?.date < new Date()) card.classList.add('past');
      // Update CURRENT badge
      const badge = card.querySelector('.prayer-card-badge');
      if (key === s.current.key && !badge) {
        card.insertAdjacentHTML('beforeend', '<span class="prayer-card-badge">CURRENT</span>');
      } else if (key !== s.current.key && badge) {
        badge.remove();
      }
    });
  }, 1000);

  // Recalculate at midnight
  const now = new Date();
  const midnight = new Date(now);
  midnight.setDate(midnight.getDate() + 1);
  midnight.setHours(0, 0, 0, 0);
  midnightTimeout = setTimeout(() => renderPrayerSection(container), midnight - now);
}

export function destroyPrayerSection() {
  if (updateInterval) { clearInterval(updateInterval); updateInterval = null; }
  if (midnightTimeout) { clearTimeout(midnightTimeout); midnightTimeout = null; }
}
