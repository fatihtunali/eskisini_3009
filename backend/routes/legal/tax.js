const express = require('express');
const { authRequired } = require('../../mw/auth.js');
const { pool } = require('../../db.js');

const router = express.Router();

// Kullanıcının yıllık vergi raporunu oluştur
router.get('/annual-report/:year', authRequired, async (req, res) => {
  try {
    const { year } = req.params;
    const user_id = req.user.id;

    if (!year || year < 2020 || year > new Date().getFullYear()) {
      return res.status(400).json({
        ok: false,
        error: 'invalid_year'
      });
    }

    // Yıllık satış verilerini getir
    const [salesData] = await pool.execute(`
      SELECT 
        COUNT(*) as total_transactions,
        SUM(total_amount) as total_revenue,
        SUM(commission) as total_commission,
        SUM(tax_amount) as total_tax_withheld
      FROM transactions t
      JOIN payments p ON t.id = p.transaction_id
      WHERE t.seller_id = ? 
      AND YEAR(t.created_at) = ?
      AND p.status = 'completed'
    `, [user_id, year]);

    // Aylık döküm
    const [monthlyBreakdown] = await pool.execute(`
      SELECT 
        MONTH(t.created_at) as month,
        COUNT(*) as transactions,
        SUM(total_amount) as revenue,
        SUM(commission) as commission,
        SUM(tax_amount) as tax_withheld
      FROM transactions t
      JOIN payments p ON t.id = p.transaction_id
      WHERE t.seller_id = ? 
      AND YEAR(t.created_at) = ?
      AND p.status = 'completed'
      GROUP BY MONTH(t.created_at)
      ORDER BY month
    `, [user_id, year]);

    // Kategori bazlı döküm
    const [categoryBreakdown] = await pool.execute(`
      SELECT 
        c.name as category_name,
        COUNT(*) as transactions,
        SUM(total_amount) as revenue
      FROM transactions t
      JOIN payments p ON t.id = p.transaction_id
      JOIN listings l ON t.listing_id = l.id
      JOIN categories c ON l.category_id = c.id
      WHERE t.seller_id = ? 
      AND YEAR(t.created_at) = ?
      AND p.status = 'completed'
      GROUP BY c.id, c.name
      ORDER BY revenue DESC
    `, [user_id, year]);

    const reportData = {
      year: parseInt(year),
      user_id: user_id,
      summary: salesData[0],
      monthly_breakdown: monthlyBreakdown,
      category_breakdown: categoryBreakdown,
      generated_at: new Date().toISOString(),
      tax_notes: {
        tr: 'Bu rapor vergi beyannamesi için kullanılabilir. Ayrıntılı vergi danışmanlığı için muhasebeci ile görüşünüz.',
        en: 'This report can be used for tax declaration. For detailed tax consultancy, please consult your accountant.'
      }
    };

    // Rapor oluşturma kaydını tut
    await pool.execute(`
      INSERT INTO tax_reports (user_id, year, total_sales, generated_at, report_data)
      VALUES (?, ?, ?, NOW(), ?)
    `, [user_id, year, salesData[0].total_revenue || 0, JSON.stringify(reportData)]);

    res.json({
      ok: true,
      data: reportData
    });
  } catch (error) {
    console.error('Tax report error:', error);
    res.status(500).json({
      ok: false,
      error: 'server_error'
    });
  }
});

// e-Fatura oluşturma endpoint'i
router.post('/create-invoice', authRequired, async (req, res) => {
  try {
    const { transaction_id } = req.body;
    const user_id = req.user.id;

    // İşlem detaylarını al
    const [transaction] = await pool.execute(`
      SELECT t.*, l.title as item_title, u.name as buyer_name, u.email as buyer_email
      FROM transactions t
      JOIN listings l ON t.listing_id = l.id
      JOIN users u ON t.buyer_id = u.id
      WHERE t.id = ? AND t.seller_id = ?
    `, [transaction_id, user_id]);

    if (transaction.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'transaction_not_found'
      });
    }

    const txn = transaction[0];

    // e-Fatura verilerini hazırla
    const invoiceData = {
      invoice_number: `ESK-${txn.id}-${Date.now()}`,
      transaction_id: txn.id,
      seller_id: user_id,
      buyer_name: txn.buyer_name,
      buyer_email: txn.buyer_email,
      item_description: txn.item_title,
      amount: txn.total_amount,
      commission: txn.commission || 0,
      tax_rate: 20, // KDV %20
      tax_amount: (txn.total_amount * 0.20),
      created_at: new Date().toISOString()
    };

    // e-Fatura kaydını veritabanına ekle
    await pool.execute(`
      INSERT INTO invoices (
        invoice_number, transaction_id, seller_id, buyer_id,
        amount, tax_amount, commission, status, created_at, invoice_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'created', NOW(), ?)
    `, [
      invoiceData.invoice_number,
      transaction_id,
      user_id,
      txn.buyer_id,
      invoiceData.amount,
      invoiceData.tax_amount,
      invoiceData.commission,
      JSON.stringify(invoiceData)
    ]);

    res.json({
      ok: true,
      data: invoiceData,
      message: 'invoice_created'
    });
  } catch (error) {
    console.error('Invoice creation error:', error);
    res.status(500).json({
      ok: false,
      error: 'server_error'
    });
  }
});

// Kullanıcının faturalarını listele
router.get('/invoices', authRequired, async (req, res) => {
  try {
    const user_id = req.user.id;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const [invoices] = await pool.execute(`
      SELECT 
        i.*,
        t.total_amount,
        l.title as item_title,
        u.name as buyer_name
      FROM invoices i
      JOIN transactions t ON i.transaction_id = t.id
      JOIN listings l ON t.listing_id = l.id
      JOIN users u ON t.buyer_id = u.id
      WHERE i.seller_id = ?
      ORDER BY i.created_at DESC
      LIMIT ? OFFSET ?
    `, [user_id, parseInt(limit), parseInt(offset)]);

    // Toplam sayı
    const [countResult] = await pool.execute(`
      SELECT COUNT(*) as total FROM invoices WHERE seller_id = ?
    `, [user_id]);

    res.json({
      ok: true,
      data: invoices,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        pages: Math.ceil(countResult[0].total / limit)
      }
    });
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({
      ok: false,
      error: 'server_error'
    });
  }
});

// Vergi eşik kontrolü ve uyarısı
router.get('/tax-threshold-check', authRequired, async (req, res) => {
  try {
    const user_id = req.user.id;
    const currentYear = new Date().getFullYear();

    // Bu yılki toplam satış
    const [salesData] = await pool.execute(`
      SELECT 
        COUNT(*) as total_sales,
        SUM(total_amount) as total_revenue
      FROM transactions t
      JOIN payments p ON t.id = p.transaction_id
      WHERE t.seller_id = ? 
      AND YEAR(t.created_at) = ?
      AND p.status = 'completed'
    `, [user_id, currentYear]);

    const totalRevenue = salesData[0].total_revenue || 0;
    const totalSales = salesData[0].total_sales || 0;

    // Türkiye vergi eşikleri (2025 için örnek değerler)
    const TAX_THRESHOLDS = {
      individual_annual_limit: 120000, // Bireysel yıllık satış limiti
      vat_registration_limit: 500000, // KDV mükellefi olmak için sınır
      business_registration_limit: 50000 // İş kaydı gerektiren sınır
    };

    const warnings = [];
    
    if (totalRevenue > TAX_THRESHOLDS.individual_annual_limit * 0.8) {
      warnings.push({
        type: 'individual_limit_warning',
        message: 'Bireysel satış sınırına yaklaşıyorsunuz. Vergi danışmanı ile görüşün.',
        current: totalRevenue,
        limit: TAX_THRESHOLDS.individual_annual_limit
      });
    }

    if (totalRevenue > TAX_THRESHOLDS.business_registration_limit) {
      warnings.push({
        type: 'business_registration_required',
        message: 'İş kaydı yaptırmanız gerekebilir.',
        current: totalRevenue,
        limit: TAX_THRESHOLDS.business_registration_limit
      });
    }

    res.json({
      ok: true,
      data: {
        current_year: currentYear,
        total_revenue: totalRevenue,
        total_sales: totalSales,
        tax_thresholds: TAX_THRESHOLDS,
        warnings: warnings,
        needs_tax_consultation: warnings.length > 0
      }
    });
  } catch (error) {
    console.error('Tax threshold check error:', error);
    res.status(500).json({
      ok: false,
      error: 'server_error'
    });
  }
});

module.exports = router;