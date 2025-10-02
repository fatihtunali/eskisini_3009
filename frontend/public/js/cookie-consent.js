// Global cookie consent manager
(function() {
    'use strict';
    
    // Cookie consent durumunu kontrol et
    function checkCookieConsent() {
        const consent = localStorage.getItem('cookieConsent');
        if (!consent) {
            showCookieBanner();
        }
        return consent;
    }
    
    // Cookie banner'ını göster
    function showCookieBanner() {
        // Banner zaten var mı kontrol et
        if (document.getElementById('globalCookieBanner')) return;
        
        const banner = document.createElement('div');
        banner.id = 'globalCookieBanner';
        banner.style.cssText = `
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: rgba(52, 58, 64, 0.95);
            color: white;
            padding: 1rem;
            z-index: 9999;
            box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
            backdrop-filter: blur(10px);
        `;
        
        banner.innerHTML = `
            <div style="max-width: 1200px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
                <div style="flex: 1; min-width: 300px;">
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                        <i class="fas fa-cookie-bite"></i>
                        <strong>Çerez Bildirimi</strong>
                    </div>
                    <p style="margin: 0; font-size: 0.9rem; opacity: 0.9;">
                        Bu web sitesi deneyiminizi geliştirmek için çerezler kullanmaktadır. 
                        KVKK kapsamında kişisel verileriniz korunmaktadır.
                        <a href="/legal/kvkk.html" style="color: #ffc107;">Detaylar</a>
                    </p>
                </div>
                <div style="display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap;">
                    <button onclick="window.cookieManager.showSettings()" style="
                        background: transparent; 
                        border: 1px solid rgba(255,255,255,0.3); 
                        color: white; 
                        padding: 0.5rem 1rem; 
                        border-radius: 0.375rem; 
                        cursor: pointer;
                        font-size: 0.875rem;
                    ">
                        Ayarlar
                    </button>
                    <button onclick="window.cookieManager.acceptAll()" style="
                        background: #28a745; 
                        border: none; 
                        color: white; 
                        padding: 0.5rem 1.5rem; 
                        border-radius: 0.375rem; 
                        cursor: pointer;
                        font-weight: 500;
                        font-size: 0.875rem;
                    ">
                        Tümünü Kabul Et
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(banner);
    }
    
    // Cookie ayarları modalı
    function showCookieSettings() {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1rem;
        `;
        
        modal.innerHTML = `
            <div style="
                background: white;
                border-radius: 0.5rem;
                max-width: 500px;
                width: 100%;
                max-height: 80vh;
                overflow-y: auto;
            ">
                <div style="padding: 1.5rem; border-bottom: 1px solid #dee2e6;">
                    <h5 style="margin: 0; display: flex; align-items: center; justify-content: space-between;">
                        Çerez Ayarları
                        <button onclick="this.closest('[style*=fixed]').remove()" style="
                            background: none;
                            border: none;
                            font-size: 1.5rem;
                            cursor: pointer;
                            color: #6c757d;
                        ">&times;</button>
                    </h5>
                </div>
                <div style="padding: 1.5rem;">
                    <div style="margin-bottom: 1rem;">
                        <label style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                            <input type="checkbox" id="necessaryCookies" checked disabled>
                            <strong>Gerekli Çerezler (Zorunlu)</strong>
                        </label>
                        <small style="color: #6c757d;">Site işlevselliği için gerekli</small>
                    </div>
                    
                    <div style="margin-bottom: 1rem;">
                        <label style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                            <input type="checkbox" id="analyticsCookies">
                            <strong>Analitik Çerezler</strong>
                        </label>
                        <small style="color: #6c757d;">Site kullanım istatistikleri</small>
                    </div>
                    
                    <div style="margin-bottom: 1.5rem;">
                        <label style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                            <input type="checkbox" id="marketingCookies">
                            <strong>Pazarlama Çerezleri</strong>
                        </label>
                        <small style="color: #6c757d;">Kişiselleştirilmiş deneyim</small>
                    </div>
                    
                    <div style="display: flex; gap: 0.75rem; justify-content: end;">
                        <button onclick="this.closest('[style*=fixed]').remove()" style="
                            background: #6c757d;
                            color: white;
                            border: none;
                            padding: 0.5rem 1rem;
                            border-radius: 0.375rem;
                            cursor: pointer;
                        ">İptal</button>
                        <button onclick="window.cookieManager.saveSettings()" style="
                            background: #007bff;
                            color: white;
                            border: none;
                            padding: 0.5rem 1rem;
                            border-radius: 0.375rem;
                            cursor: pointer;
                        ">Kaydet</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }
    
    // Tüm çerezleri kabul et
    function acceptAll() {
        const consent = {
            necessary: true,
            analytics: true,
            marketing: true,
            timestamp: new Date().toISOString()
        };
        
        localStorage.setItem('cookieConsent', JSON.stringify(consent));
        hideCookieBanner();
        
        // Analytics aktif et
        if (typeof gtag !== 'undefined') {
            gtag('consent', 'update', {
                'analytics_storage': 'granted',
                'ad_storage': 'granted'
            });
        }
        
        showToast('Çerez tercihleri kaydedildi', 'success');
    }
    
    // Ayarları kaydet
    function saveSettings() {
        const consent = {
            necessary: true,
            analytics: document.getElementById('analyticsCookies')?.checked || false,
            marketing: document.getElementById('marketingCookies')?.checked || false,
            timestamp: new Date().toISOString()
        };
        
        localStorage.setItem('cookieConsent', JSON.stringify(consent));
        hideCookieBanner();
        
        // Modal'ı kapat
        document.querySelectorAll('[style*="position: fixed"]').forEach(el => {
            if (el.innerHTML.includes('Çerez Ayarları')) {
                el.remove();
            }
        });
        
        // Analytics ayarla
        if (typeof gtag !== 'undefined') {
            gtag('consent', 'update', {
                'analytics_storage': consent.analytics ? 'granted' : 'denied',
                'ad_storage': consent.marketing ? 'granted' : 'denied'
            });
        }
        
        showToast('Çerez ayarları kaydedildi', 'success');
    }
    
    // Banner'ı gizle
    function hideCookieBanner() {
        const banner = document.getElementById('globalCookieBanner');
        if (banner) {
            banner.remove();
        }
    }
    
    // Toast bildirimi
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#28a745' : '#007bff'};
            color: white;
            padding: 0.75rem 1rem;
            border-radius: 0.375rem;
            z-index: 10001;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        `;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
    
    // Global API
    window.cookieManager = {
        checkCookieConsent,
        showCookieBanner,
        showSettings: showCookieSettings,
        acceptAll,
        saveSettings,
        hideCookieBanner
    };
    
    // Sayfa yüklendiğinde çalıştır
    document.addEventListener('DOMContentLoaded', function() {
        // 1 saniye sonra banner'ı göster (sayfa yüklendikten sonra)
        setTimeout(checkCookieConsent, 1000);
    });
    
})();