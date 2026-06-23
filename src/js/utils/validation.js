// ============================================================
// VALIDATION — Input sanitization & form validation helpers
// ============================================================

/**
 * Escapes HTML entities to prevent XSS
 */
export function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

/**
 * Sanitizes a string input
 */
export function sanitize(str) {
    if (!str) return '';
    return String(str).trim();
}

/**
 * Validates an email address
 */
export function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
}

/**
 * Validates a 10-digit Indian phone number
 */
export function isValidPhone(phone) {
    const re = /^[6-9]\d{9}$/;
    return re.test(String(phone).replace(/\s/g, ''));
}

/**
 * Validates file type
 */
export function isValidFileType(file, allowedTypes = ['image/jpeg', 'image/png', 'application/pdf']) {
    return allowedTypes.includes(file.type);
}

/**
 * Validates file size (default max 5MB)
 */
export function isValidFileSize(file, maxSizeMB = 5) {
    return file.size <= maxSizeMB * 1024 * 1024;
}

/**
 * Formats file size in human-readable format
 */
export function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Validates a form and returns errors
 */
export function validateForm(fields) {
    const errors = {};

    fields.forEach(({ name, value, rules }) => {
        for (const rule of rules) {
            if (rule.required && (!value || !String(value).trim())) {
                errors[name] = rule.message || 'This field is required';
                break;
            }
            if (rule.email && value && !isValidEmail(value)) {
                errors[name] = rule.message || 'Please enter a valid email';
                break;
            }
            if (rule.phone && value && !isValidPhone(value)) {
                errors[name] = rule.message || 'Please enter a valid 10-digit phone number';
                break;
            }
            if (rule.minLength && value && String(value).length < rule.minLength) {
                errors[name] = rule.message || `Minimum ${rule.minLength} characters required`;
                break;
            }
            if (rule.min && value && Number(value) < rule.min) {
                errors[name] = rule.message || `Minimum value is ${rule.min}`;
                break;
            }
            if (rule.pattern && value && !rule.pattern.test(String(value))) {
                errors[name] = rule.message || 'Invalid format';
                break;
            }
            if (rule.file) {
                if (rule.required && !value) {
                    errors[name] = rule.message || 'Please upload a file';
                    break;
                }
                if (value && !isValidFileType(value)) {
                    errors[name] = 'Only JPG, PNG, and PDF files are allowed';
                    break;
                }
                if (value && !isValidFileSize(value)) {
                    errors[name] = 'File size must be less than 5MB';
                    break;
                }
            }
        }
    });

    return errors;
}

/**
 * Displays form errors on the DOM
 */
export function showFormErrors(errors, formEl) {
    // Clear previous errors
    formEl.querySelectorAll('.form-control').forEach(el => el.classList.remove('error'));
    formEl.querySelectorAll('.form-error').forEach(el => {
        el.textContent = '';
        el.classList.remove('visible');
    });

    // Show new errors
    Object.entries(errors).forEach(([name, message]) => {
        const input = formEl.querySelector(`[name="${name}"]`);
        const errorEl = formEl.querySelector(`[data-error="${name}"]`);
        if (input) input.classList.add('error');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.classList.add('visible');
        }
    });
}

/**
 * Clears form errors
 */
export function clearFormErrors(formEl) {
    formEl.querySelectorAll('.form-control').forEach(el => el.classList.remove('error'));
    formEl.querySelectorAll('.form-error').forEach(el => {
        el.textContent = '';
        el.classList.remove('visible');
    });
}

/**
 * Formats currency in INR
 */
export function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(amount);
}

/**
 * Formats a number with commas (Indian style)
 */
export function formatNumber(num) {
    return new Intl.NumberFormat('en-IN').format(num);
}
