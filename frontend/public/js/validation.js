// Enhanced Input Validation and Security Library
// Eskisini Ver Yenisini Al - Client-side security and validation

(function(window) {
  'use strict';

  // CSRF Token management
  let csrfToken = null;

  // Rate limiting for form submissions
  const rateLimiter = new Map();
  const RATE_LIMIT_WINDOW = 60000; // 1 minute
  const MAX_REQUESTS_PER_WINDOW = 5;

  // Security utilities
  const Security = {
    // XSS Prevention
    sanitizeHTML: function(str) {
      if (typeof str !== 'string') return '';
      const temp = document.createElement('div');
      temp.textContent = str;
      return temp.innerHTML;
    },

    // SQL Injection Prevention for search terms
    sanitizeSearchTerm: function(str) {
      if (typeof str !== 'string') return '';
      return str.replace(/['"\\;-]/g, '').replace(/--/g, '').trim();
    },

    // CSRF Token management
    getCSRFToken: function() {
      if (!csrfToken) {
        csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
      }
      return csrfToken;
    },

    setCSRFToken: function(token) {
      csrfToken = token;
    },

    // Rate limiting check
    checkRateLimit: function(identifier) {
      const now = Date.now();
      const windowStart = now - RATE_LIMIT_WINDOW;

      if (!rateLimiter.has(identifier)) {
        rateLimiter.set(identifier, []);
      }

      const requests = rateLimiter.get(identifier);
      // Remove old requests outside the window
      const validRequests = requests.filter(time => time > windowStart);

      if (validRequests.length >= MAX_REQUESTS_PER_WINDOW) {
        return false; // Rate limit exceeded
      }

      validRequests.push(now);
      rateLimiter.set(identifier, validRequests);
      return true;
    }
  };

  // Enhanced Validation Rules
  const ValidationRules = {
    // Email validation with enhanced security
    email: {
      test: function(value) {
        if (!value) return false;
        // RFC 5322 compliant email validation
        const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        return emailRegex.test(value) && value.length <= 254;
      },
      message: 'Geçerli bir e-posta adresi giriniz.'
    },

    // Strong password validation
    password: {
      test: function(value) {
        if (!value) return false;
        return value.length >= 8 &&
               /[A-Z]/.test(value) &&
               /[a-z]/.test(value) &&
               /[0-9]/.test(value);
      },
      message: 'Şifre en az 8 karakter olmalı ve büyük harf, küçük harf, sayı içermelidir.'
    },

    // Basic password (for existing users)
    passwordBasic: {
      test: function(value) {
        return value && value.length >= 6;
      },
      message: 'Şifre en az 6 karakter olmalıdır.'
    },

    // Turkish phone number validation
    phone: {
      test: function(value) {
        if (!value) return true; // Optional field
        const normalized = value.replace(/[^\d+]/g, '');
        return /^\+90[0-9]{10}$/.test(normalized) || /^0[0-9]{10}$/.test(normalized);
      },
      message: 'Geçerli bir Türkiye telefon numarası giriniz (örn: +905551234567).'
    },

    // Turkish TC Kimlik No validation
    tcNo: {
      test: function(value) {
        if (!value) return true; // Optional field
        if (!/^[0-9]{11}$/.test(value)) return false;

        // TC Kimlik No algorithm validation
        const digits = value.split('').map(Number);
        if (digits[0] === 0) return false;

        const sum1 = digits[0] + digits[2] + digits[4] + digits[6] + digits[8];
        const sum2 = digits[1] + digits[3] + digits[5] + digits[7];
        const check1 = (sum1 * 7 - sum2) % 10;
        const check2 = (sum1 + sum2 + digits[9]) % 10;

        return check1 === digits[9] && check2 === digits[10];
      },
      message: 'Geçerli bir TC Kimlik numarası giriniz.'
    },

    // Username validation
    username: {
      test: function(value) {
        if (!value) return false;
        return /^[a-zA-Z0-9_-]{3,30}$/.test(value);
      },
      message: 'Kullanıcı adı 3-30 karakter arası olmalı ve sadece harf, rakam, tire ve alt çizgi içerebilir.'
    },

    // Required field validation
    required: {
      test: function(value) {
        return value !== null && value !== undefined && String(value).trim().length > 0;
      },
      message: 'Bu alan zorunludur.'
    },

    // Price validation (Turkish format)
    price: {
      test: function(value) {
        if (!value) return false;
        // Accepts formats: 1000, 1.000, 1.000,50, 1000,50
        const normalized = value.replace(/\./g, '').replace(',', '.');
        const price = parseFloat(normalized);
        return !isNaN(price) && price > 0 && price <= 999999999;
      },
      message: 'Geçerli bir fiyat giriniz (örn: 1.000,50).'
    },

    // URL slug validation
    slug: {
      test: function(value) {
        if (!value) return true; // Optional
        return /^[a-z0-9-]+$/.test(value) && value.length <= 100;
      },
      message: 'URL sadece küçük harf, rakam ve tire içerebilir.'
    },

    // Text length validation
    maxLength: function(max) {
      return {
        test: function(value) {
          return !value || value.length <= max;
        },
        message: `Maksimum ${max} karakter girebilirsiniz.`
      };
    },

    minLength: function(min) {
      return {
        test: function(value) {
          return !value || value.length >= min;
        },
        message: `En az ${min} karakter girmelisiniz.`
      };
    }
  };

  // Form Validator Class
  class FormValidator {
    constructor(form, options = {}) {
      this.form = form;
      this.options = {
        showErrors: true,
        validateOnSubmit: true,
        validateOnBlur: true,
        preventSubmitOnError: true,
        csrfProtection: true,
        rateLimitIdentifier: form.id || 'default',
        ...options
      };
      this.errors = new Map();
      this.init();
    }

    init() {
      if (this.options.validateOnSubmit) {
        this.form.addEventListener('submit', this.handleSubmit.bind(this));
      }

      if (this.options.validateOnBlur) {
        this.form.addEventListener('blur', this.handleBlur.bind(this), true);
      }

      // Add security headers to form
      if (this.options.csrfProtection) {
        this.addCSRFProtection();
      }
    }

    addCSRFProtection() {
      const token = Security.getCSRFToken();
      if (token) {
        let csrfField = this.form.querySelector('input[name="_token"]');
        if (!csrfField) {
          csrfField = document.createElement('input');
          csrfField.type = 'hidden';
          csrfField.name = '_token';
          this.form.appendChild(csrfField);
        }
        csrfField.value = token;
      }
    }

    handleSubmit(event) {
      // Rate limiting check
      if (!Security.checkRateLimit(this.options.rateLimitIdentifier)) {
        this.showError('Çok fazla deneme yaptınız. Lütfen bir dakika bekleyip tekrar deneyin.');
        event.preventDefault();
        return false;
      }

      const isValid = this.validateForm();

      if (this.options.preventSubmitOnError && !isValid) {
        event.preventDefault();
        return false;
      }

      return isValid;
    }

    handleBlur(event) {
      const field = event.target;
      if (field.tagName === 'INPUT' || field.tagName === 'SELECT' || field.tagName === 'TEXTAREA') {
        this.validateField(field);
      }
    }

    validateForm() {
      this.errors.clear();
      let isValid = true;

      const fields = this.form.querySelectorAll('input, select, textarea');
      fields.forEach(field => {
        if (!this.validateField(field)) {
          isValid = false;
        }
      });

      if (this.options.showErrors) {
        this.displayErrors();
      }

      return isValid;
    }

    validateField(field) {
      const fieldName = field.name || field.id;
      const value = field.value;
      const rules = this.getFieldRules(field);

      for (const rule of rules) {
        if (!rule.test(value)) {
          this.errors.set(fieldName, rule.message);
          this.markFieldInvalid(field, rule.message);
          return false;
        }
      }

      this.markFieldValid(field);
      return true;
    }

    getFieldRules(field) {
      const rules = [];
      const fieldType = field.type;
      const fieldName = field.name || field.id;

      // Required validation
      if (field.hasAttribute('required')) {
        rules.push(ValidationRules.required);
      }

      // Type-based validation
      switch (fieldType) {
        case 'email':
          rules.push(ValidationRules.email);
          break;
        case 'password':
          if (fieldName.includes('new') || fieldName.includes('register')) {
            rules.push(ValidationRules.password);
          } else {
            rules.push(ValidationRules.passwordBasic);
          }
          break;
        case 'tel':
          rules.push(ValidationRules.phone);
          break;
      }

      // Custom validation based on field name or data attributes
      if (fieldName === 'username') {
        rules.push(ValidationRules.username);
      } else if (fieldName === 'tc_no') {
        rules.push(ValidationRules.tcNo);
      } else if (fieldName.includes('price')) {
        rules.push(ValidationRules.price);
      } else if (fieldName === 'slug') {
        rules.push(ValidationRules.slug);
      }

      // Length validation
      if (field.hasAttribute('maxlength')) {
        const max = parseInt(field.getAttribute('maxlength'));
        rules.push(ValidationRules.maxLength(max));
      }

      if (field.hasAttribute('minlength')) {
        const min = parseInt(field.getAttribute('minlength'));
        rules.push(ValidationRules.minLength(min));
      }

      return rules;
    }

    markFieldValid(field) {
      field.classList.remove('is-invalid');
      field.classList.add('is-valid');
      this.hideFieldError(field);
    }

    markFieldInvalid(field, message) {
      field.classList.remove('is-valid');
      field.classList.add('is-invalid');
      if (this.options.showErrors) {
        this.showFieldError(field, message);
      }
    }

    showFieldError(field, message) {
      const existingError = field.parentNode.querySelector('.invalid-feedback');
      if (existingError) {
        existingError.textContent = message;
      } else {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'invalid-feedback d-block';
        errorDiv.textContent = message;
        field.parentNode.appendChild(errorDiv);
      }
    }

    hideFieldError(field) {
      const existingError = field.parentNode.querySelector('.invalid-feedback');
      if (existingError) {
        existingError.remove();
      }
    }

    showError(message) {
      // Show global form error
      let errorContainer = this.form.querySelector('.form-error-global');
      if (!errorContainer) {
        errorContainer = document.createElement('div');
        errorContainer.className = 'alert alert-danger form-error-global';
        errorContainer.setAttribute('role', 'alert');
        this.form.insertBefore(errorContainer, this.form.firstChild);
      }
      errorContainer.textContent = message;
      errorContainer.style.display = 'block';
    }

    displayErrors() {
      if (this.errors.size > 0) {
        const messages = Array.from(this.errors.values()).join('\n');
        this.showError(messages);
      }
    }

    // Public methods
    isValid() {
      return this.validateForm();
    }

    getErrors() {
      return new Map(this.errors);
    }

    clearErrors() {
      this.errors.clear();
      const fields = this.form.querySelectorAll('.is-invalid');
      fields.forEach(field => {
        field.classList.remove('is-invalid');
        this.hideFieldError(field);
      });
    }
  }

  // Input Sanitization Utilities
  const Sanitizer = {
    // Remove script tags and dangerous content
    sanitizeInput: function(input) {
      if (typeof input !== 'string') return input;

      return input
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .trim();
    },

    // Sanitize price input (Turkish format)
    sanitizePrice: function(input) {
      if (!input) return '';
      return input.replace(/[^\d.,]/g, '');
    },

    // Sanitize phone number
    sanitizePhone: function(input) {
      if (!input) return '';
      let cleaned = input.replace(/[^\d+]/g, '');
      if (cleaned.startsWith('0')) {
        cleaned = '+90' + cleaned.substring(1);
      } else if (cleaned.startsWith('90')) {
        cleaned = '+' + cleaned;
      }
      return cleaned;
    },

    // Sanitize TC No
    sanitizeTCNo: function(input) {
      if (!input) return '';
      return input.replace(/[^\d]/g, '').substring(0, 11);
    }
  };

  // Auto-initialize validation on forms with data-validate attribute
  document.addEventListener('DOMContentLoaded', function() {
    const forms = document.querySelectorAll('form[data-validate]');
    forms.forEach(form => {
      new FormValidator(form);
    });

    // Auto-sanitize inputs
    const inputs = document.querySelectorAll('input[data-sanitize]');
    inputs.forEach(input => {
      const sanitizeType = input.getAttribute('data-sanitize');

      input.addEventListener('input', function() {
        let value = this.value;

        switch (sanitizeType) {
          case 'price':
            value = Sanitizer.sanitizePrice(value);
            break;
          case 'phone':
            value = Sanitizer.sanitizePhone(value);
            break;
          case 'tcno':
            value = Sanitizer.sanitizeTCNo(value);
            break;
          default:
            value = Sanitizer.sanitizeInput(value);
        }

        if (value !== this.value) {
          this.value = value;
        }
      });
    });
  });

  // Export to global scope
  window.FormValidator = FormValidator;
  window.ValidationRules = ValidationRules;
  window.Security = Security;
  window.Sanitizer = Sanitizer;

})(window);