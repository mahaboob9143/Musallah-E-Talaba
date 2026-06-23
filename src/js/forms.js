// ============================================================
// FORMS — Sehri Registration, Feedback, Donation Inquiry
// ============================================================

import { db, storage } from './firebase-config.js';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { validateForm, showFormErrors, clearFormErrors, sanitize, formatFileSize } from './utils/validation.js';
import { checkRateLimit, recordAttempt, formatResetTime, RATE_LIMITS } from './utils/rate-limiter.js';
import { toast } from './components/notifications.js';

let selectedFile = null;
let currentFormTab = 'sehri';
let currentSettings = null;

/**
 * Renders the forms section with tabs
 */
export function renderForms(container, settings) {
  if (!container) return;
  currentSettings = settings;

  const sehriEnabled = settings?.formsEnabled?.sehriRegistration !== false;
  const feedbackEnabled = settings?.formsEnabled?.feedback !== false;
  const donationEnabled = settings?.formsEnabled?.donation !== false;

  // Default to first enabled tab
  const enabledTabs = [];
  if (sehriEnabled) enabledTabs.push('sehri');
  if (feedbackEnabled) enabledTabs.push('feedback');
  if (donationEnabled) enabledTabs.push('donation');
  currentFormTab = enabledTabs[0] || 'sehri';

  container.innerHTML = `
    <div class="form-tabs">
      ${sehriEnabled ? `<button class="form-tab ${currentFormTab === 'sehri' ? 'active' : ''}" data-form="sehri">📝 Sehri Registration</button>` : ''}
      ${feedbackEnabled ? `<button class="form-tab ${currentFormTab === 'feedback' ? 'active' : ''}" data-form="feedback">💬 Feedback</button>` : ''}
      ${donationEnabled ? `<button class="form-tab ${currentFormTab === 'donation' ? 'active' : ''}" data-form="donation">💰 Donation Inquiry</button>` : ''}
    </div>
    <div id="form-content"></div>
  `;

  // Tab switching
  container.querySelectorAll('.form-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      container.querySelectorAll('.form-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFormTab = tab.dataset.form;
      renderCurrentForm(document.getElementById('form-content'), settings);
    });
  });

  renderCurrentForm(document.getElementById('form-content'), settings);
}

function renderCurrentForm(container, settings) {
  if (!container) return;
  switch (currentFormTab) {
    case 'sehri': renderSehriForm(container, settings); break;
    case 'feedback': renderFeedbackForm(container); break;
    case 'donation': renderDonationForm(container); break;
  }
}

function renderSehriForm(container, settings) {
  const upi = settings?.upiId || '';
  const fee = settings?.registrationFee || 1200;
  const feeFormatted = new Intl.NumberFormat('en-IN').format(fee);
  container.innerHTML = `
    <div class="form-container animate-fade-in-up">
      <h3 class="form-title">Sehri Registration</h3>
      <p class="form-desc">Fill in your details and upload your payment receipt to register for daily Sehri.</p>
      ${upi ? `<div class="upi-info">
        <div class="upi-label">Pay ₹${feeFormatted} to UPI ID</div>
        <div class="upi-id">${upi}</div>
      </div>` : `<div class="upi-info">
        <div class="upi-label">Registration Fee: ₹${feeFormatted}</div>
      </div>`}
      <form id="sehri-form" novalidate>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Name <span class="required">*</span></label><input type="text" name="name" class="form-control" placeholder="Enter your full name" /><div class="form-error" data-error="name"></div></div>
          <div class="form-group"><label class="form-label">Mobile Number <span class="required">*</span></label><input type="tel" name="mobile" class="form-control" placeholder="10-digit number" maxlength="10" /><div class="form-error" data-error="mobile"></div></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Roll Number <span class="required">*</span></label><input type="text" name="rollNumber" class="form-control" placeholder="e.g. 21CS123" /><div class="form-error" data-error="rollNumber"></div></div>
          <div class="form-group"><label class="form-label">Branch <span class="required">*</span></label><select name="branch" class="form-control"><option value="">Select Branch</option><option>B.Tech</option><option>MCA</option><option>MBA</option><option>Diploma</option><option>B.Pharmacy</option><option>Pharm.D</option><option>Other</option></select><div class="form-error" data-error="branch"></div></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Year <span class="required">*</span></label><select name="year" class="form-control"><option value="">Select Year</option><option>1st</option><option>2nd</option><option>3rd</option><option>4th</option><option>Other</option></select><div class="form-error" data-error="year"></div></div>
          <div class="form-group"><label class="form-label">Course <span class="required">*</span></label><select name="course" class="form-control"><option value="">Select Course</option><option>CSE</option><option>CSD</option><option>CSM</option><option>CAI</option><option>CSO</option><option>CSB</option><option>Cybersecurity</option><option>IT</option><option>IOT</option><option>ECE</option><option>EEE</option><option>MEC</option><option>CIVIL</option><option>Medical</option><option>Other</option></select><div class="form-error" data-error="course"></div></div>
        </div>
        <div class="form-group"><label class="form-label">My Zone <span class="required">*</span></label><select name="zone" class="form-control"><option value="">Select Zone</option><option>Zone 1: Near by Star boys PG</option><option>Zone 2: Beyond the Railway track</option><option>Zone 3: Near by Praveen Xerox</option><option>Zone 4: Near by SV Xerox</option><option>Zone 5: Near by JP Restaurant</option><option>Other</option></select><div class="form-error" data-error="zone"></div></div>
        <div class="form-group"><label class="form-label">Address <span class="required">*</span></label><textarea name="address" class="form-control" placeholder="Ex: Praveen Xerox shop street, Sri Balaji PG, 3rd floor, 2nd Room" rows="3"></textarea><div class="form-error" data-error="address"></div></div>
        <div class="form-group"><label class="form-label">Upload Receipt (₹${feeFormatted}) <span class="required">*</span></label><div class="file-upload-area" id="file-upload-area"><div class="upload-icon">📎</div><div class="upload-text"><strong>Click to upload</strong> or drag & drop<br>JPG, PNG, PDF — Max 5MB</div><input type="file" id="file-input" accept=".jpg,.jpeg,.png,.pdf" style="display:none" /></div><div id="file-preview"></div><div class="form-error" data-error="receipt"></div></div>
        <button type="submit" class="btn btn-primary btn-block btn-lg">Submit Registration</button>
      </form>
      <div class="form-success hidden" id="sehri-success"><div class="success-icon">✅</div><h3 class="success-title">Registration Submitted!</h3><p class="success-msg">Our financial team will verify your payment within 24 hours. You'll receive a confirmation once verified.</p></div>
    </div>
  `;

  initFileUpload();
  document.getElementById('sehri-form')?.addEventListener('submit', (e) => handleSehriSubmit(e));
}

function renderFeedbackForm(container) {
  container.innerHTML = `
    <div class="form-container animate-fade-in-up">
      <h3 class="form-title">Share Your Feedback</h3>
      <p class="form-desc">Help us improve by sharing your experience and suggestions.</p>
      <form id="feedback-form" novalidate>
        <div class="form-group"><label class="form-label">Your Name <span class="required">*</span></label><input type="text" name="name" class="form-control" placeholder="Enter your name" /><div class="form-error" data-error="name"></div></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Email</label><input type="email" name="email" class="form-control" placeholder="optional" /><div class="form-error" data-error="email"></div></div>
          <div class="form-group"><label class="form-label">Phone</label><input type="tel" name="phone" class="form-control" placeholder="optional" maxlength="10" /><div class="form-error" data-error="phone"></div></div>
        </div>
        <div class="form-group"><label class="form-label">Rate Your Experience <span class="required">*</span></label><div class="star-rating" id="star-rating"><input type="radio" name="rating" value="5" id="star5"><label for="star5">★</label><input type="radio" name="rating" value="4" id="star4"><label for="star4">★</label><input type="radio" name="rating" value="3" id="star3"><label for="star3">★</label><input type="radio" name="rating" value="2" id="star2"><label for="star2">★</label><input type="radio" name="rating" value="1" id="star1"><label for="star1">★</label></div><div class="form-error" data-error="rating"></div></div>
        <div class="form-group"><label class="form-label">How did this help you? <span class="required">*</span></label><textarea name="helpMessage" class="form-control" rows="4" placeholder="Share your experience..."></textarea><div class="form-error" data-error="helpMessage"></div></div>
        <div class="form-group"><label class="form-label">What can we improve?</label><textarea name="improvements" class="form-control" rows="3" placeholder="Optional suggestions..."></textarea></div>
        <button type="submit" class="btn btn-primary btn-block btn-lg">Submit Feedback</button>
      </form>
      <div class="form-success hidden" id="feedback-success"><div class="success-icon">💚</div><h3 class="success-title">Thank You!</h3><p class="success-msg">Your feedback helps us serve the community better.</p></div>
    </div>
  `;
  document.getElementById('feedback-form')?.addEventListener('submit', (e) => handleFeedbackSubmit(e));
}

function renderDonationForm(container) {
  container.innerHTML = `
    <div class="form-container animate-fade-in-up">
      <h3 class="form-title">Donation Inquiry</h3>
      <p class="form-desc">Interested in contributing? Fill in the details and our team will contact you shortly.</p>
      <form id="donation-form" novalidate>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Name <span class="required">*</span></label><input type="text" name="name" class="form-control" placeholder="Your full name" /><div class="form-error" data-error="name"></div></div>
          <div class="form-group"><label class="form-label">Email <span class="required">*</span></label><input type="email" name="email" class="form-control" placeholder="your@email.com" /><div class="form-error" data-error="email"></div></div>
        </div>
        <div class="form-group"><label class="form-label">Subject <span class="required">*</span></label><input type="text" name="subject" class="form-control" placeholder="e.g., Donation for Ramadan" /><div class="form-error" data-error="subject"></div></div>
        <div class="form-group"><label class="form-label">Amount (₹) <span class="required">*</span></label><input type="number" name="amount" class="form-control" placeholder="Enter amount" min="1" /><div class="form-error" data-error="amount"></div></div>
        <div class="form-group"><label class="form-label">Description</label><textarea name="description" class="form-control" rows="3" placeholder="Additional details..."></textarea></div>
        <button type="submit" class="btn btn-primary btn-block btn-lg">Submit Inquiry</button>
      </form>
      <div class="form-success hidden" id="donation-success"><div class="success-icon">🤲</div><h3 class="success-title">JazakAllah Khair!</h3><p class="success-msg">Thank you! Our team will contact you shortly regarding your contribution.</p></div>
    </div>
  `;
  document.getElementById('donation-form')?.addEventListener('submit', (e) => handleDonationSubmit(e));
}

function initFileUpload() {
  const area = document.getElementById('file-upload-area');
  const input = document.getElementById('file-input');
  const preview = document.getElementById('file-preview');
  if (!area || !input) return;

  area.addEventListener('click', () => input.click());
  area.addEventListener('dragover', (e) => { e.preventDefault(); area.classList.add('dragover'); });
  area.addEventListener('dragleave', () => area.classList.remove('dragover'));
  area.addEventListener('drop', (e) => {
    e.preventDefault(); area.classList.remove('dragover');
    if (e.dataTransfer.files.length) { handleFile(e.dataTransfer.files[0], preview); }
  });
  input.addEventListener('change', () => { if (input.files.length) handleFile(input.files[0], preview); });
}

function handleFile(file, previewEl) {
  const validTypes = ['image/jpeg', 'image/png', 'application/pdf'];
  if (!validTypes.includes(file.type)) { toast.error('Only JPG, PNG, or PDF files allowed'); return; }
  if (file.size > 5 * 1024 * 1024) { toast.error('File must be less than 5MB'); return; }

  selectedFile = file;
  const isImage = file.type.startsWith('image/');

  if (isImage && previewEl) {
    const reader = new FileReader();
    reader.onload = (e) => {
      previewEl.innerHTML = `<div class="file-preview"><img src="${e.target.result}" alt="Receipt preview" /><div class="file-info"><div class="file-name">${file.name}</div><div class="file-size">${formatFileSize(file.size)}</div></div><button type="button" class="btn btn-sm btn-danger" id="remove-file">&times;</button></div>`;
      previewEl.querySelector('#remove-file')?.addEventListener('click', () => { selectedFile = null; previewEl.innerHTML = ''; });
    };
    reader.readAsDataURL(file);
  } else if (previewEl) {
    previewEl.innerHTML = `<div class="file-preview"><div style="width:60px;height:60px;background:var(--bg-tertiary);border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;font-size:1.5rem;">📄</div><div class="file-info"><div class="file-name">${file.name}</div><div class="file-size">${formatFileSize(file.size)}</div></div><button type="button" class="btn btn-sm btn-danger" id="remove-file">&times;</button></div>`;
    previewEl.querySelector('#remove-file')?.addEventListener('click', () => { selectedFile = null; previewEl.innerHTML = ''; });
  }
}

async function handleSehriSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');

  // Rate limit
  const rl = checkRateLimit(RATE_LIMITS.SEHRI_REGISTRATION.key, RATE_LIMITS.SEHRI_REGISTRATION.max, RATE_LIMITS.SEHRI_REGISTRATION.window);
  if (!rl.allowed) { toast.warning(`Too many attempts. Try again in ${formatResetTime(rl.resetTime)}`); return; }

  const data = Object.fromEntries(new FormData(form));
  const errors = validateForm([
    { name: 'name', value: data.name, rules: [{ required: true, message: 'Please enter your Name' }] },
    { name: 'mobile', value: data.mobile, rules: [{ required: true, message: 'Please enter your Mobile Number' }, { phone: true, message: 'Please enter a valid 10-digit Mobile Number' }] },
    { name: 'rollNumber', value: data.rollNumber, rules: [{ required: true, message: 'Please enter your Roll Number' }] },
    { name: 'branch', value: data.branch, rules: [{ required: true, message: 'Please select Branch' }] },
    { name: 'year', value: data.year, rules: [{ required: true, message: 'Please select Year' }] },
    { name: 'course', value: data.course, rules: [{ required: true, message: 'Please select Course' }] },
    { name: 'zone', value: data.zone, rules: [{ required: true, message: 'Please select Zone' }] },
    { name: 'address', value: data.address, rules: [{ required: true, message: 'Please enter your Address' }] },
    { name: 'receipt', value: selectedFile, rules: [{ file: true, required: true, message: 'Please upload your payment Receipt' }] }
  ]);

  if (Object.keys(errors).length) { showFormErrors(errors, form); toast.error('Please fix the errors above'); return; }

  btn.disabled = true; btn.textContent = 'Submitting...';

  try {
    let receiptUrl = '';
    let receiptMeta = {};
    if (selectedFile) {
      const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}_${selectedFile.name}`;
      const storageRef = ref(storage, `receipts/${fileName}`);
      await uploadBytes(storageRef, selectedFile);
      receiptUrl = await getDownloadURL(storageRef);
      receiptMeta = { fileName: selectedFile.name, fileSize: selectedFile.size, mimeType: selectedFile.type };
    }

    await addDoc(collection(db, 'sehri_registrations'), {
      name: sanitize(data.name), mobile: sanitize(data.mobile), rollNumber: sanitize(data.rollNumber),
      branch: data.branch, year: data.year, course: data.course, zone: data.zone,
      address: sanitize(data.address), receiptUrl, receiptMetadata: receiptMeta,
      paymentAmount: currentSettings?.registrationFee || 1200, paymentStatus: 'pending',
      submittedAt: serverTimestamp(), registrationYear: new Date().getFullYear()
    });

    recordAttempt(RATE_LIMITS.SEHRI_REGISTRATION.key, RATE_LIMITS.SEHRI_REGISTRATION.max, RATE_LIMITS.SEHRI_REGISTRATION.window);
    form.classList.add('hidden');
    document.getElementById('sehri-success')?.classList.remove('hidden');
    toast.success('Registration submitted successfully!');
  } catch (err) {
    console.error(err);
    toast.error('Submission failed. Please try again.');
    btn.disabled = false; btn.textContent = 'Submit Registration';
  }
}

async function handleFeedbackSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');
  const rl = checkRateLimit(RATE_LIMITS.FEEDBACK.key, RATE_LIMITS.FEEDBACK.max, RATE_LIMITS.FEEDBACK.window);
  if (!rl.allowed) { toast.warning(`You can submit feedback once per day. Try again in ${formatResetTime(rl.resetTime)}`); return; }

  const data = Object.fromEntries(new FormData(form));
  const rating = parseInt(data.rating);
  const errors = validateForm([
    { name: 'name', value: data.name, rules: [{ required: true, message: 'Please enter your Name' }] },
    { name: 'email', value: data.email, rules: data.email ? [{ email: true, message: 'Please enter a valid Email' }] : [] },
    { name: 'phone', value: data.phone, rules: data.phone ? [{ phone: true, message: 'Please enter a valid Phone Number' }] : [] },
    { name: 'rating', value: data.rating, rules: [{ required: true, message: 'Please select a Rating' }] },
    { name: 'helpMessage', value: data.helpMessage, rules: [{ required: true, message: 'Please describe how this helped you' }] }
  ]);

  if (Object.keys(errors).length) { showFormErrors(errors, form); return; }
  btn.disabled = true; btn.textContent = 'Submitting...';

  try {
    await addDoc(collection(db, 'feedback_submissions'), {
      name: sanitize(data.name), email: sanitize(data.email) || null, phone: sanitize(data.phone) || null,
      rating, helpMessage: sanitize(data.helpMessage), improvementSuggestions: sanitize(data.improvements) || null,
      submittedAt: serverTimestamp()
    });
    recordAttempt(RATE_LIMITS.FEEDBACK.key, RATE_LIMITS.FEEDBACK.max, RATE_LIMITS.FEEDBACK.window);
    form.classList.add('hidden');
    document.getElementById('feedback-success')?.classList.remove('hidden');
    toast.success('Thank you for your feedback!');
  } catch (err) {
    toast.error('Submission failed. Please try again.');
    btn.disabled = false; btn.textContent = 'Submit Feedback';
  }
}

async function handleDonationSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');
  const rl = checkRateLimit(RATE_LIMITS.DONATION.key, RATE_LIMITS.DONATION.max, RATE_LIMITS.DONATION.window);
  if (!rl.allowed) { toast.warning(`Too many requests. Try again in ${formatResetTime(rl.resetTime)}`); return; }

  const data = Object.fromEntries(new FormData(form));
  const errors = validateForm([
    { name: 'name', value: data.name, rules: [{ required: true, message: 'Please enter your Name' }] },
    { name: 'email', value: data.email, rules: [{ required: true, message: 'Please enter your Email' }, { email: true, message: 'Please enter a valid Email address' }] },
    { name: 'subject', value: data.subject, rules: [{ required: true, message: 'Please enter a Subject' }] },
    { name: 'amount', value: data.amount, rules: [{ required: true, message: 'Please enter the Amount' }, { min: 1, message: 'Amount must be at least ₹1' }] }
  ]);

  if (Object.keys(errors).length) { showFormErrors(errors, form); return; }
  btn.disabled = true; btn.textContent = 'Submitting...';

  try {
    await addDoc(collection(db, 'donations'), {
      name: sanitize(data.name), email: sanitize(data.email), subject: sanitize(data.subject),
      amount: Number(data.amount), description: sanitize(data.description) || null,
      status: 'pending', submittedAt: serverTimestamp()
    });
    recordAttempt(RATE_LIMITS.DONATION.key, RATE_LIMITS.DONATION.max, RATE_LIMITS.DONATION.window);
    form.classList.add('hidden');
    document.getElementById('donation-success')?.classList.remove('hidden');
    toast.success('Donation inquiry submitted!');
  } catch (err) {
    toast.error('Submission failed. Please try again.');
    btn.disabled = false; btn.textContent = 'Submit Inquiry';
  }
}
