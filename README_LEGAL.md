# Eskisini Ver Yenisini Al - Yasal Uyumluluk Projesi

## 🚀 Projenin Başlatılması

### Veritabanı Kurulumu
1. `database/legal_compliance.sql` dosyasını MySQL'e import edin
2. Mevcut tablolarınızın üzerine yasal uyumluluk tabloları eklenecek

### Server Başlatma
```bash
npm run dev
```

### Erişim URL'leri

#### Ana API Endpoints
- **Ana Server**: http://localhost:3000
- **Frontend**: http://localhost:5500

#### Yasal Uyumluluk Sayfaları
- **KVKK Yönetimi**: http://localhost:5500/legal/kvkk.html
- **Vergi Raporları**: http://localhost:5500/legal/tax-reports.html  
- **Şikayet Sistemi**: http://localhost:5500/legal/complaints.html

#### API Endpoints
```
/api/legal/kvkk/consent-text          # KVKK rıza metni getir
/api/legal/kvkk/give-consent          # Rıza ver
/api/legal/kvkk/withdraw-consent      # Rızayı geri çek
/api/legal/kvkk/export-data           # Kullanıcı verilerini indir
/api/legal/kvkk/delete-account        # Hesap silme talebi
/api/legal/kvkk/my-consents           # Kullanıcının rıza durumları

/api/legal/tax/annual-report/:year    # Yıllık vergi raporu
/api/legal/tax/create-invoice         # e-Fatura oluştur
/api/legal/tax/invoices               # Faturalar listesi
/api/legal/tax/tax-threshold-check    # Vergi eşik kontrolü

/api/legal/complaints/categories      # Şikayet kategorileri
/api/legal/complaints/create          # Yeni şikayet oluştur
/api/legal/complaints/my-complaints   # Kullanıcının şikayetleri
/api/legal/complaints/:id             # Şikayet detayı
/api/legal/complaints/:id/reply       # Şikayete yanıt ekle
/api/legal/complaints/:id/close       # Şikayeti kapat
```

## 🔒 Yasal Uyumluluk Özellikleri

### ✅ KVKK (Kişisel Verilerin Korunması)
- Kullanıcı rıza yönetimi sistemi
- Veri kategorileri ve işlenme amaçları
- Veri indirme (taşınabilirlik hakkı)
- Hesap silme talebi (unutulma hakkı)
- Çerez yönetim sistemi
- Audit log sistemi

### ✅ Vergi Uyumu
- Yıllık satış raporları
- e-Fatura sistemi altyapısı
- Vergi eşik uyarıları
- Aylık/kategori bazlı döküm
- Excel/PDF rapor indirme

### ✅ Tüketici Koruma
- Şikayet yönetim sistemi
- Çoklu kategori desteği
- Dosya eki yükleme
- Şikayet takip sistemi
- Memnuniyet anketi
- Otomatik şikayet numarası

### ✅ E-Ticaret Uyumu
- Mesafeli satış sözleşmesi
- 14 günlük cayma hakkı
- Güvenli ödeme sistemleri
- Kullanım şartları ve gizlilik politikası

## 🛠️ Teknik Özellikler

### Backend
- **Node.js + Express** API sunucusu
- **MySQL** veritabanı
- **JWT** authentication
- **JSON** veri formatı
- **RESTful** API tasarımı

### Frontend
- **Vanilla JavaScript** (ES6+)
- **Bootstrap 5** UI framework
- **Font Awesome** ikonları
- **Chart.js** grafik kütüphanesi
- **Responsive** tasarım

### Güvenlik
- **CORS** koruması
- **Rate limiting**
- **Input validation** 
- **SQL injection** koruması
- **XSS** koruması
- **HTTPS** desteği

## 📋 Test Senaryoları

### 1. KVKK Sistemi Testi
```javascript
// Rıza verme testi
fetch('/api/legal/kvkk/give-consent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
        consent_type: 'marketing',
        kvkk_version: 'v1.0'
    })
});

// Veri indirme testi
fetch('/api/legal/kvkk/export-data', {
    method: 'GET',
    credentials: 'include'
});
```

### 2. Vergi Raporu Testi
```javascript
// Yıllık rapor testi
fetch('/api/legal/tax/annual-report/2025', {
    method: 'GET',
    credentials: 'include'
});

// Vergi eşik kontrolü
fetch('/api/legal/tax/tax-threshold-check', {
    method: 'GET', 
    credentials: 'include'
});
```

### 3. Şikayet Sistemi Testi
```javascript
// Yeni şikayet oluşturma
fetch('/api/legal/complaints/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
        category: 'product_quality',
        subject: 'Test şikayet',
        description: 'Test açıklama',
        urgency_level: 'medium'
    })
});
```

## 🎯 Sonraki Adımlar

### Öncelik 1: Hemen Yapılacaklar
- [ ] SQL dosyasını veritabanına import et
- [ ] Server'ı başlat ve test et  
- [ ] KVKK sayfasını test et
- [ ] Vergi raporu sayfasını test et
- [ ] Şikayet sistemi sayfasını test et

### Öncelik 2: Ek Geliştirmeler  
- [ ] E-posta bildirim sistemi
- [ ] SMS entegrasyonu
- [ ] Dosya upload sistemi
- [ ] Admin paneli geliştirme
- [ ] Mobil uygulama hazırlığı

### Öncelik 3: İyileştirmeler
- [ ] Performance optimizasyonu
- [ ] SEO iyileştirmesi
- [ ] A/B testing altyapısı
- [ ] Multi-language desteği
- [ ] PWA özelliklerinin eklenmesi

## 🚦 Durum Kontrolleri

### ✅ Tamamlanan Özellikler
- Backend API route'ları
- Frontend sayfaları  
- Veritabanı tabloları
- Temel stil dosyaları
- JavaScript işlevleri
- Authentication entegrasyonu

### 🔄 Devam Eden İşler
- Dosya upload işlevi
- E-posta bildirimler
- Advanced search
- Report caching

### ❌ Henüz Başlanmamış
- Admin dashboard
- Mobile app
- Email templates
- Automated testing

## 💡 Önemli Notlar

1. **Güvenlik**: Tüm API endpoint'leri authentication gerektiriyor
2. **KVKK**: Rıza yönetimi sistemi tamamen otomatik
3. **Vergi**: Eşik uyarıları otomatik hesaplanıyor
4. **Şikayet**: Otomatik numaralama ve durum takibi mevcut
5. **Dosyalar**: Upload sistemi temel seviyede hazır

## 🔧 Troubleshooting

### Yaygın Hatalar
1. **Database Connection Error**: .env dosyasındaki DB ayarlarını kontrol edin
2. **CORS Error**: server.js'de ORIGINS ayarını kontrol edin  
3. **401 Unauthorized**: Login olup cookie'lerin aktif olduğunu kontrol edin
4. **500 Server Error**: Server console'da hata mesajlarını kontrol edin

### Debug İpuçları
```javascript
// Browser console'da auth kontrol
console.log(document.cookie);

// API response kontrol  
fetch('/api/legal/kvkk/my-consents', {credentials: 'include'})
  .then(r => r.json())
  .then(console.log);
```

---

**🎉 Proje hazır! Şimdi test edebilir ve kullanmaya başlayabilirsiniz.**

Herhangi bir sorun yaşarsanız hemen bildirin, birlikte çözelim! 🚀