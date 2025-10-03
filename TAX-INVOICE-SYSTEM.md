# Fatura ve Vergi Sistemi - Türkiye Yasal Uyumluluk

## 📊 Durum Analizi

### Platform Tipi
**P2P/C2C Marketplace** - Eskisini Ver Yenisini Al
- Bireysel kullanıcılar arası ikinci el ürün alışverişi
- Komisyon bazlı gelir modeli
- Mağaza sistemi ile ticari satıcı desteği

---

## 🏛️ Yasal Düzenlemeler (2025)

### 1. Bireysel Satıcılar (C2C)
**Durumu**: ✅ Fatura zorunluluğu YOK

**Kriterler**:
- Ara sıra, düzenli olmayan satışlar
- Yıllık satış: **< 280.000 TL**
- Platform: Dolap, Letgo, Sahibinden modeli

**Platform Yükümlülüğü**:
- Satış kayıtlarını tutma
- 280K eşiğini aşanları uyarma
- Vergi dairesine rapor gönderme (Dolap örneği)

---

### 2. Ticari Satıcılar (B2C)
**Durumu**: ⚠️ Fatura zorunluluğu VAR

#### a) e-Arşiv Fatura (3.000 TL - 500.000 TL arası)
- Bireysel alıcılara satış
- **3.000 TL** üzeri işlemler için zorunlu
- 2026'dan itibaren tüm tutarlar için geçerli

#### b) e-Fatura (500.000 TL üstü yıllık ciro)
- **1 Temmuz 2025** itibariyle zorunlu
- E-ticaret platformları için özel eşik: **500.000 TL**
- Tüm satışlar için e-Fatura düzenleme

#### c) Kurumsal Satış (9.900 TL üstü)
- Vergi mükellefi alıcılara
- **9.900 TL** (KDV dahil) üzeri
- e-Fatura zorunlu

---

### 3. Platform (Komisyon Geliri)
**Durumu**: ✅ Fatura KESMELİSİNİZ

**Ne Zaman**:
- Her komisyon tahsilatında
- Aylık toplam komisyon geliri için
- Satıcıya değil, kendi şirket adınıza

**Nasıl**:
- Şirketiniz kuruluysa → e-Fatura sistemi
- Gelir threshold'una göre e-Arşiv veya e-Fatura

---

## 🎯 Önerilen Sistem: 3 Katmanlı Model

### Katman 1: Satıcı Sınıflandırma

```javascript
// backend/services/seller-classification.js

const SELLER_TYPES = {
  INDIVIDUAL: 'individual',      // Bireysel (280K altı)
  COMMERCIAL: 'commercial',      // Ticari (280K-500K arası)
  ENTERPRISE: 'enterprise'       // Kurumsal (500K üstü)
};

const TAX_THRESHOLDS = {
  INDIVIDUAL_ANNUAL: 280000,     // Yıllık bireysel eşik
  E_ARCHIVE_MIN: 3000,           // e-Arşiv minimum tutar
  E_INVOICE_ANNUAL: 500000,      // e-Fatura yıllık eşik
  CORPORATE_MIN: 9900            // Kurumsal satış minimum
};

async function classifySeller(sellerId) {
  // Yıllık satış toplamı
  const annualSales = await calculateAnnualSales(sellerId);

  if (annualSales >= TAX_THRESHOLDS.E_INVOICE_ANNUAL) {
    return {
      type: SELLER_TYPES.ENTERPRISE,
      invoiceRequired: true,
      invoiceType: 'e-invoice',
      threshold: TAX_THRESHOLDS.E_INVOICE_ANNUAL
    };
  }

  if (annualSales >= TAX_THRESHOLDS.INDIVIDUAL_ANNUAL) {
    return {
      type: SELLER_TYPES.COMMERCIAL,
      invoiceRequired: true,
      invoiceType: 'e-archive',
      threshold: TAX_THRESHOLDS.INDIVIDUAL_ANNUAL
    };
  }

  return {
    type: SELLER_TYPES.INDIVIDUAL,
    invoiceRequired: false,
    threshold: TAX_THRESHOLDS.INDIVIDUAL_ANNUAL,
    remaining: TAX_THRESHOLDS.INDIVIDUAL_ANNUAL - annualSales
  };
}
```

---

### Katman 2: Otomatik Fatura Sistemi

```javascript
// backend/services/invoice-service.js

async function createInvoiceIfRequired(orderId) {
  const order = await getOrder(orderId);
  const seller = await getSeller(order.seller_id);
  const classification = await classifySeller(seller.id);

  // 1. Satıcı sınıfı kontrolü
  if (!classification.invoiceRequired) {
    console.log(`Seller ${seller.id} - Individual, no invoice required`);
    return null;
  }

  // 2. Tutar kontrolü
  if (order.total_minor < TAX_THRESHOLDS.E_ARCHIVE_MIN * 100) {
    console.log(`Order ${orderId} - Below invoice threshold`);
    return null;
  }

  // 3. Fatura oluştur
  const invoice = await generateInvoice({
    orderId: order.id,
    sellerId: seller.id,
    buyerId: order.buyer_id,
    amount: order.total_minor / 100,
    type: classification.invoiceType,
    issueDate: new Date(),
    items: await getOrderItems(orderId)
  });

  // 4. e-Fatura sistemine gönder (entegrasyon)
  if (classification.type === SELLER_TYPES.ENTERPRISE) {
    await sendToEInvoiceSystem(invoice);
  }

  return invoice;
}
```

---

### Katman 3: Platform Komisyon Faturalandırma

```javascript
// backend/services/platform-commission.js

async function issueMonthlyCommissionInvoices() {
  const startOfMonth = moment().startOf('month');
  const endOfMonth = moment().endOf('month');

  // Tüm komisyon tahsilatları
  const commissions = await db.query(`
    SELECT
      DATE_FORMAT(created_at, '%Y-%m') as month,
      SUM(commission_amount) as total_commission,
      COUNT(*) as transaction_count
    FROM commission_transactions
    WHERE created_at BETWEEN ? AND ?
      AND status = 'collected'
    GROUP BY DATE_FORMAT(created_at, '%Y-%m')
  `, [startOfMonth, endOfMonth]);

  for (const commission of commissions) {
    // Platform kendi adına fatura keser
    await db.query(`
      INSERT INTO platform_invoices
      (invoice_type, month, total_amount, transaction_count, created_at)
      VALUES ('platform_commission', ?, ?, ?, NOW())
    `, [commission.month, commission.total_commission, commission.transaction_count]);

    console.log(`Platform invoice created for ${commission.month}: ${commission.total_commission} TL`);
  }
}
```

---

## 🗄️ Veritabanı Şeması

### Yeni Tablolar

```sql
-- Satıcı vergi bilgileri
CREATE TABLE seller_tax_info (
  id INT PRIMARY KEY AUTO_INCREMENT,
  seller_id INT NOT NULL,
  tax_type ENUM('individual', 'commercial', 'enterprise') DEFAULT 'individual',
  tax_number VARCHAR(11),           -- Vergi numarası (varsa)
  tax_office VARCHAR(100),          -- Vergi dairesi
  company_name VARCHAR(255),        -- Şirket adı (varsa)
  annual_sales_limit DECIMAL(15,2), -- Yıllık satış limiti
  e_invoice_enabled BOOLEAN DEFAULT FALSE,
  last_classification_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_seller (seller_id),
  INDEX idx_tax_type (tax_type)
);

-- Fatura kayıtları
CREATE TABLE invoices (
  id INT PRIMARY KEY AUTO_INCREMENT,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  order_id INT NOT NULL,
  seller_id INT NOT NULL,
  buyer_id INT NOT NULL,
  invoice_type ENUM('e-archive', 'e-invoice', 'manual') NOT NULL,
  total_amount DECIMAL(15,2) NOT NULL,
  vat_amount DECIMAL(15,2) DEFAULT 0,
  commission_amount DECIMAL(15,2) DEFAULT 0,
  issue_date DATETIME NOT NULL,
  uuid VARCHAR(36),                 -- e-Fatura UUID
  status ENUM('draft', 'issued', 'sent', 'cancelled') DEFAULT 'draft',
  e_invoice_response TEXT,          -- e-Fatura sistem yanıtı
  pdf_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (seller_id) REFERENCES users(id),
  FOREIGN KEY (buyer_id) REFERENCES users(id),
  INDEX idx_seller (seller_id),
  INDEX idx_order (order_id),
  INDEX idx_date (issue_date)
);

-- Yıllık satış takibi
CREATE TABLE annual_sales_tracking (
  id INT PRIMARY KEY AUTO_INCREMENT,
  seller_id INT NOT NULL,
  year INT NOT NULL,
  total_sales DECIMAL(15,2) DEFAULT 0,
  total_orders INT DEFAULT 0,
  last_updated DATETIME,
  threshold_exceeded BOOLEAN DEFAULT FALSE,
  notification_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_seller_year (seller_id, year),
  INDEX idx_year (year),
  INDEX idx_threshold (threshold_exceeded)
);

-- Platform komisyon faturaları
CREATE TABLE platform_invoices (
  id INT PRIMARY KEY AUTO_INCREMENT,
  invoice_type ENUM('platform_commission', 'service_fee') NOT NULL,
  month VARCHAR(7) NOT NULL,        -- YYYY-MM
  total_amount DECIMAL(15,2) NOT NULL,
  transaction_count INT DEFAULT 0,
  invoice_number VARCHAR(50),
  pdf_url VARCHAR(500),
  status ENUM('draft', 'issued') DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_month (month)
);
```

---

## 🔔 Eşik Uyarı Sistemi

```javascript
// backend/services/threshold-alerts.js

async function checkThresholdAndNotify(sellerId) {
  const currentYear = new Date().getFullYear();

  // Yıllık satış toplamı
  const [sales] = await db.query(`
    SELECT
      COALESCE(SUM(total_minor), 0) / 100 as total_sales,
      COUNT(*) as order_count
    FROM orders
    WHERE seller_id = ?
      AND YEAR(created_at) = ?
      AND status IN ('completed', 'shipped', 'delivered')
  `, [sellerId, currentYear]);

  const totalSales = sales.total_sales;
  const thresholds = [
    { limit: 280000, message: '280.000 TL bireysel satış eşiğine yaklaşıyorsunuz' },
    { limit: 500000, message: '500.000 TL e-Fatura eşiğine yaklaşıyorsunuz' }
  ];

  for (const threshold of thresholds) {
    const remaining = threshold.limit - totalSales;
    const percentage = (totalSales / threshold.limit) * 100;

    // %80'e geldiğinde uyar
    if (percentage >= 80 && percentage < 100) {
      await sendThresholdNotification(sellerId, {
        threshold: threshold.limit,
        current: totalSales,
        remaining: remaining,
        message: threshold.message
      });
    }

    // Aşıldığında zorunlu bildirim
    if (totalSales >= threshold.limit) {
      await notificationService.createNotification({
        userId: sellerId,
        type: 'system',
        title: 'Vergi Eşiği Aşıldı',
        body: `${currentYear} yılı satışlarınız ${threshold.limit} TL'yi aştı. Vergi yükümlülükleriniz için lütfen muhasebeci ile görüşün.`,
        data: {
          threshold: threshold.limit,
          totalSales: totalSales,
          action_url: '/profile.html?tab=tax-info'
        }
      });

      // Sadece bir kez bildir
      await markThresholdNotified(sellerId, currentYear, threshold.limit);
    }
  }
}
```

---

## 📊 Raporlama Sistemi

### API Endpoints

```javascript
// GET /api/tax/my-sales-report
// Satıcının yıllık satış raporu
router.get('/my-sales-report', authRequired, async (req, res) => {
  const { year = new Date().getFullYear() } = req.query;

  const report = await db.query(`
    SELECT
      DATE_FORMAT(created_at, '%Y-%m') as month,
      COUNT(*) as order_count,
      SUM(total_minor) / 100 as total_sales,
      SUM(commission_minor) / 100 as total_commission
    FROM orders
    WHERE seller_id = ? AND YEAR(created_at) = ?
      AND status IN ('completed', 'shipped', 'delivered')
    GROUP BY DATE_FORMAT(created_at, '%Y-%m')
    ORDER BY month
  `, [req.user.id, year]);

  const summary = {
    year: year,
    totalSales: report.reduce((sum, r) => sum + r.total_sales, 0),
    totalOrders: report.reduce((sum, r) => sum + r.order_count, 0),
    totalCommission: report.reduce((sum, r) => sum + r.total_commission, 0),
    monthlyBreakdown: report
  };

  res.json({ ok: true, report: summary });
});

// GET /api/tax/threshold-status
// Vergi eşik durumu
router.get('/threshold-status', authRequired, async (req, res) => {
  const classification = await classifySeller(req.user.id);

  res.json({
    ok: true,
    classification,
    nextThreshold: getNextThreshold(classification.type),
    warningLevel: getWarningLevel(classification)
  });
});

// GET /api/tax/invoices
// Fatura listesi
router.get('/invoices', authRequired, async (req, res) => {
  const { year, page = 1, limit = 20 } = req.query;

  const invoices = await db.query(`
    SELECT
      i.*,
      o.total_minor,
      u.full_name as buyer_name
    FROM invoices i
    JOIN orders o ON i.order_id = o.id
    JOIN users u ON i.buyer_id = u.id
    WHERE i.seller_id = ?
      ${year ? 'AND YEAR(i.issue_date) = ?' : ''}
    ORDER BY i.issue_date DESC
    LIMIT ? OFFSET ?
  `, [req.user.id, year, limit, (page - 1) * limit].filter(Boolean));

  res.json({ ok: true, invoices });
});
```

---

## 🔌 e-Fatura Entegrasyonu

### Önerilen Servis Sağlayıcılar

1. **Paraşüt** - https://www.parasut.com
   - API desteği
   - Aylık 50 TL'den başlayan paketler
   - e-Arşiv + e-Fatura

2. **Logo e-Fatura** - https://www.logo.com.tr
   - Kurumsal çözüm
   - ERP entegrasyonu

3. **Uyumsoft** - https://www.uyumsoft.com.tr
   - API friendly
   - Marketplace odaklı

### Örnek Entegrasyon (Paraşüt)

```javascript
// backend/integrations/parasut.js

const axios = require('axios');

class ParasutInvoice {
  constructor() {
    this.baseURL = 'https://api.parasut.com/v4';
    this.companyId = process.env.PARASUT_COMPANY_ID;
    this.token = process.env.PARASUT_ACCESS_TOKEN;
  }

  async createEArchiveInvoice(invoice) {
    const response = await axios.post(
      `${this.baseURL}/${this.companyId}/e_archives`,
      {
        data: {
          type: 'e_archives',
          attributes: {
            issue_date: invoice.issueDate,
            due_date: invoice.dueDate,
            invoice_no: invoice.invoiceNumber,
            currency: 'TRL',
            description: invoice.description
          },
          relationships: {
            contact: {
              data: {
                type: 'contacts',
                id: invoice.contactId
              }
            },
            details: {
              data: invoice.items.map(item => ({
                type: 'e_archive_details',
                attributes: {
                  quantity: item.quantity,
                  unit_price: item.unitPrice,
                  vat_rate: item.vatRate,
                  description: item.description
                }
              }))
            }
          }
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  }
}

module.exports = new ParasutInvoice();
```

---

## 🎯 Implementasyon Adımları

### Faz 1: Temel Altyapı (1-2 Hafta)
- [ ] Veritabanı tablolarını ekle
- [ ] Satıcı sınıflandırma servisi
- [ ] Yıllık satış takip sistemi
- [ ] Threshold uyarı sistemi

### Faz 2: Fatura Sistemi (2-3 Hafta)
- [ ] Fatura oluşturma servisi
- [ ] e-Fatura API entegrasyonu (Paraşüt/Logo)
- [ ] PDF oluşturma
- [ ] Satıcı fatura listesi sayfası
- [ ] Admin fatura yönetimi

### Faz 3: Platform Komisyon (1 Hafta)
- [ ] Aylık komisyon faturası oluşturma
- [ ] Platform fatura raporları
- [ ] Muhasebe entegrasyonu

### Faz 4: Raporlama & UI (1-2 Hafta)
- [ ] Satıcı vergi raporu sayfası
- [ ] Threshold dashboard
- [ ] Excel/PDF export
- [ ] E-posta bildirimleri

---

## 💰 Maliyet Tahmini

### e-Fatura Servisi (Paraşüt Örneği)
- **Başlangıç**: 50 TL/ay (100 fatura/ay)
- **Orta**: 150 TL/ay (500 fatura/ay)
- **Kurumsal**: 500 TL/ay (sınırsız)

### Geliştirme Süresi
- **Backend**: 3-4 hafta
- **Frontend**: 2-3 hafta
- **Test & QA**: 1 hafta
- **Toplam**: 6-8 hafta

---

## ⚠️ Önemli Notlar

1. **Platform Sorumluluğu**:
   - Satıcıların vergi yükümlülüklerini yerine getiremezsiniz
   - Ancak bilgilendirme ve kayıt tutma yükümlülüğünüz var

2. **280K Eşiği**:
   - Dolap modeli: Tüm satışları rapor ediyor
   - Sizin de benzer şekilde rapor sistemini kurmalısınız

3. **e-Fatura Zorunluluğu**:
   - 500K üstü satıcılar için 1 Temmuz 2025'ten itibaren
   - Şimdiden alt yapıyı kurun

4. **Platform Komisyonu**:
   - Mutlaka fatura kesmelisiniz
   - Aylık/çeyreklik dönemler halinde

5. **Yasal Danışmanlık**:
   - Bir YMM (Mali Müşavir) ile çalışmanız önerilir
   - Vergi mevzuatı değişebilir

---

## 📞 Sonraki Adım

**Karar Vermeniz Gerekenler:**

1. Hangi fazdan başlamak istiyorsunuz?
2. e-Fatura servisi tercihiniz? (Paraşüt, Logo, vb.)
3. Satıcı sınıflandırmasını otomatik mi yoksa manuel mi yapalım?
4. Platform komisyon faturalarını nasıl yönetmek istersiniz?

**Ben size yardımcı olabilirim:**
- Database migration dosyası oluşturma
- Backend servis kodları yazma
- Frontend sayfaları geliştirme
- e-Fatura API entegrasyonu

Hangi kısımdan başlamak istersiniz? 🚀
