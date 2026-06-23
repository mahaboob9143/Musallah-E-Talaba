// ============================================================
// LANDING PAGE — All public-facing sections
// ============================================================

import { renderPrayerSection, destroyPrayerSection } from './prayer-times.js';
import { renderForms } from './forms.js';
import { getCountdown, formatDate } from './utils/date-utils.js';
import { db } from './firebase-config.js';
import { collection, getDocs, doc, getDoc, query, orderBy } from 'firebase/firestore';
import { escapeHtml } from './utils/validation.js';

let countdownInterval = null;
let statsObserver = null;
let scrollHandler = null;

/**
 * Renders the complete landing page
 */
export async function renderLandingPage(container) {
  // Fetch settings
  let settings = {
    registrationDeadline: null,
    upiId: '',
    whatsappGroupLink: '#',
    contactPhone: '',
    mapEmbedUrl: '',
    formsEnabled: { sehriRegistration: true, feedback: true, donation: true },
    impactStats: { peopleHelpedThisYear: 0, totalHelped: 0, mealsDistributed: 0, yearsOfService: 0 }
  };

  try {
    const settingsDoc = await getDoc(doc(db, 'system_settings', 'settings'));
    if (settingsDoc.exists()) {
      settings = { ...settings, ...settingsDoc.data() };
    }
  } catch (e) { console.log('Using default settings'); }



  // Check if registration form is enabled
  const sehriEnabled = settings?.formsEnabled?.sehriRegistration !== false;
  const anyFormEnabled = sehriEnabled || settings?.formsEnabled?.feedback !== false || settings?.formsEnabled?.donation !== false;
  const heroButtonText = sehriEnabled ? 'Register for Sehri' : 'Join Community';
  const heroButtonHref = sehriEnabled ? '#forms-section' : '#community-section';

  // Impact stats from admin settings
  const impact = settings.impactStats || {};

  container.innerHTML = `
    <!-- Navbar -->
    <nav class="navbar" id="main-navbar">
      <div class="container">
        <a href="/" class="navbar-brand" onclick="location.reload(); return false;">
          <span class="brand-icon">🌙</span>
          <span class="brand-text">Musallah-E-Talaba</span>
        </a>
        <div class="navbar-links" id="nav-links">
          <a href="#hero" class="active">Home</a>
          <a href="#gallery-section">Gallery</a>
          <a href="#location-section">Location</a>
          ${anyFormEnabled ? '<a href="#forms-section">Forms</a>' : ''}
          <a href="#community-section">Contact</a>
        </div>
        <div class="navbar-actions">
          <div class="mobile-menu-btn" id="mobile-menu-btn">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>
    </nav>

    <!-- Hero Section -->
    <section class="hero-section" id="hero">
      <div class="hero-pattern"></div>
      <div class="container">
        <div class="hero-content">
          <div class="hero-left">
            <div class="hero-badge">
              <span class="badge-icon">🕌</span>
              Salah · Knowledge · Brotherhood
            </div>
            <h1 class="hero-title">
              A Journey of <span class="highlight">Faith</span> and Brotherhood
            </h1>
            <p class="hero-subtitle">
              A blessed circle of students devoted to establishing salah, seeking sacred knowledge, and preserving iman with sincerity and brotherhood.
            </p>
            <div class="hero-actions">
              <a href="javascript:void(0)" class="btn btn-primary btn-lg" onclick="document.getElementById('${sehriEnabled ? 'forms-section' : 'community-section'}')?.scrollIntoView({behavior:'smooth'})">${heroButtonText}</a>
              <a href="javascript:void(0)" class="btn btn-outline btn-lg" onclick="document.getElementById('site-footer')?.scrollIntoView({behavior:'smooth'})">Contact</a>
            </div>
          </div>
          <div class="hero-right" id="prayer-circle-container"></div>
        </div>
      </div>
    </section>

    <!-- Countdown Banner -->
    ${sehriEnabled ? `<section class="countdown-banner" id="countdown-banner">
      <div class="container">
        <div class="countdown-text" id="countdown-text">Loading registration deadline...</div>
      </div>
    </section>` : ''}

    <!-- Stats Section -->
    <section class="stats-section" id="stats-section">
      <div class="container">
        <h2 class="section-title">Our <span class="text-gold">Impact</span></h2>
        <p class="section-subtitle">Together, we've made a significant difference in the lives of students during the blessed month of Ramadan</p>
        <div class="stats-grid" id="stats-grid">
          <div class="stat-counter-card animate-fade-in-up" style="opacity:0">
            <div class="counter-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
            <div class="counter-value" data-target="${impact.peopleHelpedThisYear || 0}">0</div>
            <div class="counter-label">People Helped This Year</div>
          </div>
          <div class="stat-counter-card animate-fade-in-up" style="opacity:0">
            <div class="counter-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></div>
            <div class="counter-value" data-target="${impact.totalHelped || 0}">0</div>
            <div class="counter-label">Total Helped (All Years)</div>
          </div>
          <div class="stat-counter-card animate-fade-in-up" style="opacity:0">
            <div class="counter-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg></div>
            <div class="counter-value" data-target="${impact.mealsDistributed || 0}">0</div>
            <div class="counter-label">Meals Distributed</div>
          </div>
          <div class="stat-counter-card animate-fade-in-up" style="opacity:0">
            <div class="counter-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>
            <div class="counter-value" data-target="${impact.yearsOfService || 0}">0</div>
            <div class="counter-label">Years of Service</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Gallery Section -->
    <section class="gallery-section" id="gallery-section">
      <div class="container">
        <h2 class="section-title">Our <span class="text-gold">Gallery</span></h2>
        <div class="gallery-grid" id="gallery-grid">
          <div class="gallery-item"><img src="/assets/gallery/gallery-1.jpg" alt="Community gathering" loading="lazy"/></div>
          <div class="gallery-item"><img src="/assets/gallery/gallery-2.jpg" alt="Sehri distribution" loading="lazy"/></div>
          <div class="gallery-item"><img src="/assets/gallery/gallery-3.jpg" alt="Brotherhood" loading="lazy"/></div>
          <div class="gallery-item"><img src="/assets/gallery/gallery-4.jpg" alt="Evening prayer" loading="lazy"/></div>
          <div class="gallery-item"><img src="/assets/gallery/gallery-5.jpg" alt="Community service" loading="lazy"/></div>
          <div class="gallery-item"><img src="/assets/gallery/gallery-6.jpg" alt="Study circle" loading="lazy"/></div>
          <div class="gallery-item"><img src="/assets/gallery/gallery-7.jpg" alt="Iftar gathering" loading="lazy"/></div>
          <div class="gallery-item"><img src="/assets/gallery/gallery-8.jpg" alt="Community event" loading="lazy"/></div>
        </div>
      </div>
    </section>

    <!-- Memories Section -->
    <section class="memories-section" id="memories-section">
      <div class="container">
        <h2 class="section-title">Memories Through the <span class="text-gold">Years</span></h2>
        <div class="year-tabs" id="year-tabs">
          <button class="year-tab active" data-year="all">All</button>
        </div>
        <div class="gallery-grid" id="memories-grid">
          <div class="gallery-item" data-year="2025"><img src="/assets/memories/memory-1.jpg" alt="Memory 2025" loading="lazy"/></div>
          <div class="gallery-item" data-year="2024"><img src="/assets/memories/memory-2.jpg" alt="Memory 2024" loading="lazy"/></div>
          <div class="gallery-item" data-year="2023"><img src="/assets/memories/memory-3.jpg" alt="Memory 2023" loading="lazy"/></div>
          <div class="gallery-item" data-year="2022"><img src="/assets/memories/memory-4.jpg" alt="Memory 2022" loading="lazy"/></div>
        </div>
      </div>
    </section>

    <!-- Location Section -->
    <section class="location-section" id="location-section">
      <div class="container">
        <div class="location-content">
          ${settings.mapEmbedUrl ? `<div class="location-map">
            <iframe 
              src="${settings.mapEmbedUrl}" 
              allowfullscreen loading="lazy"
              title="Musallah-E-Talaba Location">
            </iframe>
          </div>` : ''}
          <div class="location-info"${!settings.mapEmbedUrl ? ' style="max-width:100%"' : ''}>
            <h3>Find Us at <span class="text-gold">Musallah-E-Talaba</span></h3>
            <div class="location-details">
              <div class="location-detail-item">
                <span class="detail-icon">📍</span>
                <div class="detail-text">JKB Building, Opposite to Cricket Turf, RVS Nagar, Chittoor</div>
              </div>
              ${settings.contactPhone ? `<div class="location-detail-item">
                <span class="detail-icon">📞</span>
                <div class="detail-text">${escapeHtml(settings.contactPhone)}</div>
              </div>` : ''}
              <div class="location-detail-item">
                <span class="detail-icon">⏰</span>
                <div class="detail-text">Sehri distribution starts 1 hour before Fajr daily during Ramadan</div>
              </div>
              <div class="location-detail-item">
                <span class="detail-icon">🕌</span>
                <div class="detail-text">Located near the JKB Building prayer area</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Community Section -->
    <section class="community-section" id="community-section">
      <div class="container">
        <h2 class="section-title" style="margin-bottom: var(--space-4);">Join Our <span class="text-gold">Community</span></h2>
        <p class="text-muted" style="margin-bottom: var(--space-8);">Stay connected with updates, prayer times, and community events</p>
        <a href="${settings.whatsappGroupLink && settings.whatsappGroupLink.startsWith('https://') ? settings.whatsappGroupLink : '#'}" target="_blank" rel="noopener" class="whatsapp-btn">
          <span class="wa-icon">💬</span>
          Join WhatsApp Group
        </a>
      </div>
    </section>

    ${anyFormEnabled ? `<!-- Forms Section -->
    <section class="forms-section" id="forms-section">
      <div class="container">
        <h2 class="section-title">Get <span class="text-gold">Involved</span></h2>
        <p class="section-subtitle">Register for Sehri, share feedback, or make a donation inquiry</p>
        <div id="forms-container"></div>
      </div>
    </section>` : ''}

    <!-- Footer -->
    <footer class="site-footer" id="site-footer">
      <div class="container">
        <div class="footer-grid">
          <div class="footer-brand">
            <div class="brand-text">🌙 Musallah-E-Talaba</div>
            <p class="brand-desc">Serving the Muslim student community with faith, knowledge, and brotherhood during the blessed month of Ramadan.</p>
          </div>
          <div>
            <h4 class="footer-heading">Quick Links</h4>
            <ul class="footer-links">
              <li><a href="javascript:void(0)" onclick="document.getElementById('hero')?.scrollIntoView({behavior:'smooth'})">Home</a></li>
              <li><a href="javascript:void(0)" onclick="document.getElementById('gallery-section')?.scrollIntoView({behavior:'smooth'})">Gallery</a></li>
              <li><a href="javascript:void(0)" onclick="document.getElementById('location-section')?.scrollIntoView({behavior:'smooth'})">Location</a></li>
              ${anyFormEnabled ? '<li><a href="javascript:void(0)" onclick="document.getElementById(\'forms-section\')?.scrollIntoView({behavior:\'smooth\'})">Forms</a></li>' : ''}
              <li><a href="javascript:void(0)" onclick="document.getElementById('community-section')?.scrollIntoView({behavior:'smooth'})">Contact</a></li>
            </ul>
          </div>
          ${anyFormEnabled ? `<div>
            <h4 class="footer-heading">Resources</h4>
            <ul class="footer-links">
              <li><a href="javascript:void(0)" onclick="document.getElementById('forms-section')?.scrollIntoView({behavior:'smooth'})">Sehri Registration</a></li>
              <li><a href="javascript:void(0)" onclick="document.getElementById('forms-section')?.scrollIntoView({behavior:'smooth'})">Feedback</a></li>
              <li><a href="javascript:void(0)" onclick="document.getElementById('forms-section')?.scrollIntoView({behavior:'smooth'})">Donate</a></li>
            </ul>
          </div>` : ''}
          <div>
            <h4 class="footer-heading">Contact</h4>
            <ul class="footer-links">
              <li>JKB Building, RVS Nagar, Chittoor</li>
              ${settings.contactPhone ? `<li>📞 ${escapeHtml(settings.contactPhone)}</li>` : ''}
              <li><a href="#/login" class="footer-team-link">🔑 Team Portal</a></li>
            </ul>
          </div>
        </div>
        <div class="footer-bottom">
          <span>© ${new Date().getFullYear()} Musallah-E-Talaba. All rights reserved.</span>
          <div class="footer-bottom-links">
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>

    <!-- Lightbox -->
    <div class="lightbox" id="lightbox">
      <span class="lightbox-close" id="lightbox-close">&times;</span>
      <img id="lightbox-img" src="" alt="Gallery preview" />
    </div>
  `;

  // Clean up any previous render before re-rendering
  destroyLandingPage();

  // Initialize sub-modules
  initNavbar();
  renderPrayerSection(document.getElementById('prayer-circle-container'));
  initCountdown(settings.registrationDeadline);
  initStatsAnimation();
  initYearTabs();
  initLightbox();
  if (anyFormEnabled) renderForms(document.getElementById('forms-container'), settings);
  loadGalleryImages();
  loadYearPhotos();
}

function initNavbar() {
  const navbar = document.getElementById('main-navbar');
  const mobileBtn = document.getElementById('mobile-menu-btn');
  const navLinks = document.getElementById('nav-links');

  // Scroll detection (use named function for cleanup)
  scrollHandler = () => {
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  };
  window.addEventListener('scroll', scrollHandler);

  // Smooth scroll for anchor links
  navLinks?.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      const targetId = link.getAttribute('href').replace('#', '');
      const target = document.getElementById(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        navLinks.classList.remove('open');
      }
    });
  });

  // Mobile menu
  mobileBtn?.addEventListener('click', () => {
    navLinks.classList.toggle('open');
  });
}

function initCountdown(deadline) {
  const el = document.getElementById('countdown-text');
  if (!el) return;

  if (!deadline) {
    el.innerHTML = '<span class="label">Registration is </span><span class="timer">Open</span>';
    return;
  }

  function update() {
    const cd = getCountdown(deadline);
    if (cd.expired) {
      el.innerHTML = '<span class="countdown-closed">Registration Closed — See you next Ramadan! 🌙</span>';
      if (countdownInterval) clearInterval(countdownInterval);
    } else {
      el.innerHTML = `<span class="label">Registration closes in: </span><span class="countdown-boxes"><span class="cd-box"><span class="cd-num">${String(cd.days).padStart(2, '0')}</span><span class="cd-unit">days</span></span><span class="cd-sep">|</span><span class="cd-box"><span class="cd-num">${String(cd.hours).padStart(2, '0')}</span><span class="cd-unit">hrs</span></span><span class="cd-sep">|</span><span class="cd-box"><span class="cd-num">${String(cd.minutes).padStart(2, '0')}</span><span class="cd-unit">min</span></span><span class="cd-sep">|</span><span class="cd-box"><span class="cd-num">${String(cd.seconds).padStart(2, '0')}</span><span class="cd-unit">sec</span></span></span>`;
    }
  }

  update();
  countdownInterval = setInterval(update, 1000);
}

// Stats are now admin-configured via settings.impactStats — no dynamic loading needed

function initStatsAnimation() {
  const counters = document.querySelectorAll('.counter-value[data-target]');
  const cards = document.querySelectorAll('.stat-counter-card');

  statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // Animate cards in
        cards.forEach((card, i) => {
          setTimeout(() => { card.style.opacity = '1'; }, i * 100);
        });

        // Animate counters
        counters.forEach(counter => {
          const target = parseInt(counter.dataset.target);
          animateCounter(counter, target);
        });

        statsObserver.disconnect();
      }
    });
  }, { threshold: 0.3 });

  const statsSection = document.getElementById('stats-section');
  if (statsSection) statsObserver.observe(statsSection);
}

function animateCounter(el, target) {
  const duration = 2000;
  const start = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    el.textContent = Math.round(eased * target).toLocaleString('en-IN');
    if (progress < 1) requestAnimationFrame(update);
  }

  requestAnimationFrame(update);
}

function initYearTabs() {
  const tabs = document.getElementById('year-tabs');
  if (!tabs) return;

  tabs.addEventListener('click', (e) => {
    const tab = e.target.closest('.year-tab');
    if (!tab) return;

    tabs.querySelectorAll('.year-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    const year = tab.dataset.year;
    filterYearPhotos(year);
  });
}

function filterYearPhotos(year) {
  const grid = document.getElementById('memories-grid');
  if (!grid) return;

  const items = grid.querySelectorAll('.gallery-item');
  items.forEach(item => {
    if (year === 'all' || item.dataset.year === year) {
      item.style.display = '';
    } else {
      item.style.display = 'none';
    }
  });
}

function initLightbox() {
  const lightbox = document.getElementById('lightbox');
  const closeBtn = document.getElementById('lightbox-close');
  const img = document.getElementById('lightbox-img');

  document.addEventListener('click', (e) => {
    const galleryItem = e.target.closest('.gallery-item');
    if (galleryItem) {
      const imgSrc = galleryItem.querySelector('img')?.src;
      if (imgSrc && img && lightbox) {
        img.src = imgSrc;
        lightbox.classList.add('active');
      }
    }
  });

  closeBtn?.addEventListener('click', () => lightbox.classList.remove('active'));
  lightbox?.addEventListener('click', (e) => {
    if (e.target === lightbox) lightbox.classList.remove('active');
  });
}

async function loadGalleryImages() {
  try {
    const q = query(collection(db, 'gallery_images'), orderBy('order', 'asc'));
    const snap = await getDocs(q);
    const grid = document.getElementById('gallery-grid');
    if (!grid || snap.empty) return;

    grid.innerHTML = snap.docs.map(d => {
      const data = d.data();
      return `
        <div class="gallery-item">
          <img src="${data.imageUrl}" alt="${escapeHtml(data.caption || 'Gallery')}" loading="lazy" />
          <div class="gallery-overlay">
            <span class="gallery-caption">${escapeHtml(data.caption || '')}</span>
          </div>
        </div>
      `;
    }).join('');
  } catch (e) { console.log('Gallery load skipped:', e.message); }
}

async function loadYearPhotos() {
  try {
    const q = query(collection(db, 'year_photos'), orderBy('year', 'desc'));
    const snap = await getDocs(q);
    const grid = document.getElementById('memories-grid');
    const tabsContainer = document.getElementById('year-tabs');
    if (!grid || snap.empty) return;

    // Dynamically build year tabs from the data
    const years = [...new Set(snap.docs.map(d => d.data().year).filter(Boolean))].sort((a, b) => b - a);
    if (tabsContainer && years.length > 0) {
      tabsContainer.innerHTML = `<button class="year-tab active" data-year="all">All</button>` +
        years.map(y => `<button class="year-tab" data-year="${y}">${y}</button>`).join('');
      // Re-init year tab click listeners
      initYearTabs();
    }

    grid.innerHTML = snap.docs.map(d => {
      const data = d.data();
      return `
        <div class="gallery-item" data-year="${data.year}">
          <img src="${data.imageUrl}" alt="${escapeHtml(data.caption || `Ramadan ${data.year}`)}" loading="lazy" />
          <div class="gallery-overlay">
            <span class="gallery-caption">${escapeHtml(data.caption || `Ramadan ${data.year}`)}</span>
          </div>
        </div>
      `;
    }).join('');
  } catch (e) { console.log('Year photos load skipped:', e.message); }
}

/**
 * Cleanup when leaving landing page — prevents memory leaks
 */
export function destroyLandingPage() {
  destroyPrayerSection();
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
  if (statsObserver) { statsObserver.disconnect(); statsObserver = null; }
  if (scrollHandler) { window.removeEventListener('scroll', scrollHandler); scrollHandler = null; }
}
