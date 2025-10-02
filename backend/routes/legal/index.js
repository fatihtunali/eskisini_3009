const express = require('express');
const kvkkRoutes = require('./kvkk.js');
const taxRoutes = require('./tax.js');
const complaintsRoutes = require('./complaints.js');

const router = express.Router();

// Alt route'ları bağla
router.use('/kvkk', kvkkRoutes);
router.use('/tax', taxRoutes);
router.use('/complaints', complaintsRoutes);

// Genel yasal dokümanlara erişim
router.get('/documents', async (req, res) => {
  try {
    const documents = {
      terms_of_service: {
        tr: '/legal/docs/kullanim-sozlesmesi.html',
        en: '/legal/docs/terms-of-service.html',
        last_updated: '2025-01-01'
      },
      privacy_policy: {
        tr: '/legal/docs/gizlilik-politikasi.html',
        en: '/legal/docs/privacy-policy.html',
        last_updated: '2025-01-01'
      },
      cookie_policy: {
        tr: '/legal/docs/cerez-politikasi.html',
        en: '/legal/docs/cookie-policy.html',
        last_updated: '2025-01-01'
      },
      kvkk_clarification: {
        tr: '/legal/docs/kvkk-aydinlatma-metni.html',
        last_updated: '2025-01-01'
      },
      distance_sales: {
        tr: '/legal/docs/mesafeli-satis-sozlesmesi.html',
        last_updated: '2025-01-01'
      }
    };

    res.json({
      ok: true,
      data: documents
    });
  } catch (error) {
    console.error('Get legal documents error:', error);
    res.status(500).json({
      ok: false,
      error: 'server_error'
    });
  }
});

// Platform compliance durumu
router.get('/compliance-status', async (req, res) => {
  try {
    const complianceStatus = {
      kvkk_compliant: true,
      tax_system_active: true,
      e_commerce_licensed: true,
      consumer_protection_measures: true,
      data_encryption: true,
      ssl_active: true,
      last_audit_date: '2024-12-01',
      next_audit_date: '2025-06-01',
      certificates: [
        {
          name: 'ISO 27001 - Information Security Management',
          status: 'active',
          expires: '2025-12-31'
        },
        {
          name: 'E-Commerce License - Ministry of Trade',
          status: 'active',
          expires: '2026-03-15'
        }
      ]
    };

    res.json({
      ok: true,
      data: complianceStatus
    });
  } catch (error) {
    console.error('Get compliance status error:', error);
    res.status(500).json({
      ok: false,
      error: 'server_error'
    });
  }
});

module.exports = router;