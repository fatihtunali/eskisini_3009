// public/js/sell.js
(function () {
  const API_BASE = window.getCorrectApiBase ? window.getCorrectApiBase() : (window.APP && window.APP.API_BASE) || '';
  const $  = (s, r = document) => r.querySelector(s);

  // ---- helpers ----
  const toMinor = (v) => {
    if (v == null) return null;
    const str = String(v).trim().replace(/\./g, '').replace(',', '.'); // "1.234,56" -> "1234.56"
    const num = Number(str);
    if (!Number.isFinite(num)) return null;
    return Math.round(num * 100);
  };

  const slugify = (s) => String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/ç/g,'c').replace(/ğ/g,'g').replace(/ı/g,'i')
    .replace(/ö/g,'o').replace(/ş/g,'s').replace(/ü/g,'u')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');

  async function fetchJSON(url, opts = {}) {
    const r = await fetch(url, {
      credentials: 'include',
      headers: { 'Accept': 'application/json', ...(opts.headers||{}) },
      ...opts
    });
    if (r.status === 401) {
      const u = new URL('/login.html', location.origin);
      u.searchParams.set('redirect', location.pathname + location.search);
      location.href = u.toString();
      throw new Error('unauthorized');
    }
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  async function getMe() {
    try {
      const d = await fetchJSON(`${API_BASE}/api/auth/me`);
      return d.user || d;
    } catch { return null; }
  }

  // ---- categories ----
  async function loadMainCats(selectEl) {
    console.log('loadMainCats called with element:', selectEl);
    if (!selectEl) {
      console.warn('loadMainCats: No selectEl provided');
      return;
    }
    selectEl.innerHTML = `<option value="">Seçiniz…</option>`;
    try {
      console.log('Fetching categories from API...');
      const data = await (window.API && window.API.categories
        ? window.API.categories.getMain()
        : fetchJSON(`${API_BASE}/api/categories/main`)
      );
      console.log('Categories API response:', data);
      const { ok, categories = [] } = data;
      if (ok && Array.isArray(categories)) {
        console.log(`Adding ${categories.length} categories to select`);
        for (const c of categories) {
          const opt = document.createElement('option');
          opt.value = c.slug;
          opt.textContent = c.name;
          selectEl.appendChild(opt);
        }
        console.log('Categories successfully added to select');
      } else {
        console.warn('Categories API returned invalid data:', { ok, categories });
      }
    } catch (e) {
      console.error('categories/main error:', e);
    }

    const other = document.createElement('option');
    other.value = '__other';
    other.textContent = 'Diğer / Elle gir';
    selectEl.appendChild(other);
  }

  async function loadChildCats(mainSlug, selectEl) {
    if (!selectEl) return;
    selectEl.innerHTML = `<option value="">Alt kategori (opsiyonel)</option>`;
    if (!mainSlug || mainSlug === '__other') {
      selectEl.disabled = true;
      return;
    }
    try {
      const data = await (window.API && window.API.categories 
        ? window.API.categories.getChildren(mainSlug)
        : fetchJSON(`${API_BASE}/api/categories/children/${encodeURIComponent(mainSlug)}`)
      );
      const { ok, children = [] } = data;
      if (ok && children.length) {
        for (const c of children) {
          const opt = document.createElement('option');
          opt.value = c.slug;
          opt.textContent = c.name;
          selectEl.appendChild(opt);
        }
        selectEl.disabled = false;
      } else {
        selectEl.disabled = true;
      }
    } catch (e) {
      console.warn('categories/children', e);
      selectEl.disabled = true;
    }
  }

  function getSelectedCategorySlug(catMain, catChild, customInput) {
    const childSlug = (catChild && !catChild.disabled && catChild.value) ? catChild.value : '';
    if (childSlug) return childSlug;
    const mainSlug = (catMain && catMain.value) ? catMain.value : '';
    if (mainSlug && mainSlug !== '__other') return mainSlug;
    const customSlug = (customInput && customInput.value) ? customInput.value.trim() : '';
    return customSlug || '';
  }

  // ---- cities ----
  function loadCities() {
    const citySelect = $('#city');
    if (!citySelect) return;

    // Mevcut seçenekleri temizle (ilk "Şehir seçiniz" hariç)
    const options = citySelect.querySelectorAll('option:not(:first-child)');
    options.forEach(option => option.remove());

    // cities-tr.js'den şehir listesini yükle
    const cities = window.CITIES_TR || [
      'İstanbul', 'Ankara', 'İzmir', 'Bursa', 'Antalya', 'Adana',
      'Konya', 'Gaziantep', 'Mersin', 'Diyarbakır', 'Kayseri', 'Eskişehir'
    ];

    // Şehirleri ekle
    cities.forEach((city, index) => {
      const option = document.createElement('option');
      option.value = city; // Şehir adını tam olarak kaydet
      option.textContent = city;
      citySelect.appendChild(option);
      console.log(`Added city option [${index}]:`, city, 'value:', option.value);
    });

    // Select'e change listener ekle debug için
    citySelect.addEventListener('change', function() {
      console.log('City selected - text:', this.options[this.selectedIndex].text, 'value:', this.value);
    });
  }

  // ---- bind ----
  function bind() {
    // Form id'leri için fallback: #sellForm veya #f
    const form = $('#sellForm') || $('#f');
    if (!form || form.dataset.bound) return;
    form.dataset.bound = '1';

    const submitBtn = form.querySelector('[type="submit"]');
    const msg = $('#msg');

    // ID fallback'leri: #mainCat/#subCat veya #catMain/#catChild
    const catMain  = $('#mainCat') || $('#catMain');
    const catChild = $('#subCat')  || $('#catChild');
    const customWrap = $('#customSlugWrap'); // varsa
    const customSlug = $('#customSlug');     // varsa

    // Title/slug
    const titleEl = $('#title');
    const slugEl  = $('#slug');

    // Price
    const priceInput = $('#price');
    const priceMinorHidden = $('#price_minor');

    // Images
    const images = $('#images');
    const imgCount = $('#imgCount');
    const uploadBtn = $('#uploadBtn');
    const uploadedImagesContainer = $('#uploadedImages');

    // ---- UI helpers ----
    // Slug önerisi
    if (titleEl && slugEl) {
      titleEl.addEventListener('input', () => {
        if (!slugEl.value) slugEl.placeholder = slugify(titleEl.value);
      });
    }

    // Fiyat -> minor
    if (priceInput && priceMinorHidden) {
      const prettify = (txt) => {
        let s = (txt || '').toString()
          .replace(/[^\d.,]/g,'')
          .replace(/,{2,}/g, ',')
          .replace(/\.(?=.*\.)/g,''); // tek nokta
        return s;
      };
      priceInput.addEventListener('input', () => {
        priceInput.value = prettify(priceInput.value);
        priceMinorHidden.value = toMinor(priceInput.value) ?? '';
      });
    }

    // Görsel sayaç ve yönetimi
    let uploadedImages = [];

    const updateImageCount = () => {
      if (imgCount) {
        imgCount.textContent = String(uploadedImages.length);
      }
      if (images) {
        images.value = uploadedImages.map(img => img.url).join('\n');
      }
    };

    const renderUploadedImages = () => {
      if (!uploadedImagesContainer) return;

      uploadedImagesContainer.innerHTML = uploadedImages.map((img, index) => `
        <div class="image-preview ${index === 0 ? 'cover' : ''}" data-index="${index}">
          <img src="${img.url}" alt="Uploaded image">
          <button type="button" class="remove-btn" onclick="removeImage(${index})">&times;</button>
          ${index === 0 ? '<div class="cover-badge">Kapak</div>' : ''}
        </div>
      `).join('');
    };

    // Global function to remove image
    window.removeImage = (index) => {
      if (index >= 0 && index < uploadedImages.length) {
        uploadedImages.splice(index, 1);
        updateImageCount();
        renderUploadedImages();
      }
    };

    // File input for uploads
    const createFileInput = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.accept = 'image/*';
      input.style.display = 'none';
      return input;
    };

    // Image upload handler
    if (uploadBtn) {
      uploadBtn.addEventListener('click', () => {
        const fileInput = createFileInput();
        document.body.appendChild(fileInput);

        fileInput.addEventListener('change', async (e) => {
          const files = Array.from(e.target.files);
          if (files.length === 0) return;

          if (uploadedImages.length + files.length > 10) {
            alert('En fazla 10 görsel yükleyebilirsiniz');
            return;
          }

          uploadBtn.disabled = true;
          uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Yükleniyor...';

          try {
            const formData = new FormData();
            files.forEach(file => {
              if (file.size > 5 * 1024 * 1024) {
                throw new Error(`${file.name} dosyası çok büyük (max 5MB)`);
              }
              formData.append('images', file);
            });

            const response = await fetch(`${API_BASE}/api/uploads/images`, {
              method: 'POST',
              credentials: 'include',
              body: formData
            });

            const data = await response.json();
            if (!data.ok) {
              throw new Error(data.error || 'Yükleme başarısız');
            }

            uploadedImages.push(...data.images);
            updateImageCount();
            renderUploadedImages();

          } catch (error) {
            console.error('Upload error:', error);
            alert('Görsel yükleme hatası: ' + error.message);
          } finally {
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Görsel Yükle';
            document.body.removeChild(fileInput);
          }
        });

        fileInput.click();
      });
    }

    // Legacy image count for textarea (if exists)
    if (images && imgCount && !uploadBtn) {
      const recalc = () => {
        const n = images.value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean).length;
        imgCount.textContent = String(n);
      };
      images.addEventListener('input', recalc);
      recalc();
    }

    // Kategoriler (boot'ta yüklenecek)
    catMain?.addEventListener('change', async () => {
      const v = catMain.value;
      if (customWrap) customWrap.style.display = (v === '__other') ? '' : 'none';
      if (!catChild) return;
      if (v === '__other') {
        catChild.innerHTML = `<option value="">Önce ana kategoriyi seçin</option>`;
        catChild.disabled = true;
        return;
      }
      await loadChildCats(v, catChild);
    });

    // Submit
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (msg) msg.textContent = '';
      if (submitBtn?.dataset.busy === '1') return;

      // Edit modunda mı kontrol et - en başta tanımla
      const isEditMode = form.dataset.editId;

      try {
        submitBtn && (submitBtn.dataset.busy = '1', submitBtn.disabled = true);

        // auth
        const user = await getMe();
        if (!user) return; // 401 yönlendirmesi fetchJSON'da

        const fd = new FormData(form);

        // kategori slug
        const category_slug = getSelectedCategorySlug(catMain, catChild, customSlug);
        if (!category_slug) {
          alert('Lütfen bir kategori seçin veya slug girin.');
          return;
        }

        // fiyat
        let price_minor = null;
        if (fd.has('price_minor') && String(fd.get('price_minor')).trim() !== '') {
          const pm = Number(String(fd.get('price_minor')).trim());
          price_minor = Number.isFinite(pm) ? pm : null;
        } else if (fd.has('price')) {
          price_minor = toMinor(fd.get('price'));
        } else if (priceInput) {
          price_minor = toMinor(priceInput.value);
        }
        if (!Number.isFinite(price_minor) || price_minor <= 0) {
          alert('Lütfen geçerli bir fiyat girin.');
          return;
        }

        // başlık
        const title = String(fd.get('title') || titleEl?.value || '').trim();
        if (!title) {
          alert('Başlık zorunludur.');
          return;
        }

        // slug
        let slug = String(fd.get('slug') || slugEl?.value || '').trim();
        if (!slug) slug = slugify(title);

        // diğer alanlar
        const image_urls = String(fd.get('image_urls') || images?.value || '')
          .split(/[\n,]/).map(s=>s.trim()).filter(Boolean);

        const payload = {
          category_slug,
          title,
          slug,
          description_md: String(fd.get('description_md') || '').trim(),
          price_minor,
          currency: (fd.get('currency') || 'TRY').toString().trim().toUpperCase() || 'TRY',
          condition_grade: String(fd.get('condition_grade') || 'good'),
          location_city: String(fd.get('location_city') || ''),
          allow_trade: fd.has('allow_trade') ? true : false,
          image_urls
        };

        console.log('Form data - location_city:', fd.get('location_city'));
        console.log('Payload - location_city:', payload.location_city);

        // API çağrısı - sadece fetch kullan
        const url = isEditMode
          ? `${API_BASE}/api/listings/${isEditMode}`
          : `${API_BASE}/api/listings`;
        const method = isEditMode ? 'PUT' : 'POST';

        const r = await fetch(url, {
          method,
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        const data = await r.json().catch(() => ({}));
        if (!r.ok || data.ok === false) {
          throw new Error(data.error || data.message || `HTTP ${r.status}`);
        }

        const successMessage = isEditMode
          ? `İlan güncellendi #${data.id ?? isEditMode}`
          : `İlan oluşturuldu #${data.id ?? ''}`;
        alert(successMessage);

        const detailUrl = slug
          ? `/listing.html?slug=${encodeURIComponent(slug)}`
          : `/listing.html?id=${encodeURIComponent(data.id || isEditMode)}`;
        location.href = detailUrl;

      } catch (err) {
        console.error(err);
        const errorMessage = isEditMode
          ? 'İlan güncellenemedi: ' + (err.message || 'Hata')
          : 'İlan oluşturulamadı: ' + (err.message || 'Hata');
        alert(errorMessage);
      } finally {
        submitBtn && (submitBtn.disabled = false, submitBtn.dataset.busy = '0');
      }
    });
  }

  async function boot() {
    console.log('=== SELL.JS BOOT STARTED ===');

    bind();
    console.log('1. Bind completed');

    loadCities();
    console.log('2. Cities loaded');

    // Kategorileri önce yükle
    const catMain = $('#mainCat') || $('#catMain');
    console.log('3. Found catMain element:', !!catMain);
    if (catMain) {
      console.log('3a. Loading main categories...');
      await loadMainCats(catMain);
      console.log('3b. Main categories loaded');
    }

    console.log('4. Checking edit mode...');
    await checkEditMode();
    console.log('=== SELL.JS BOOT COMPLETED ===');
  }

  async function checkEditMode() {
    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get('edit');

    if (editId) {
      // Edit modunda: status field'ini göster ve başlığı değiştir
      const statusField = $('#statusField');
      const title = $('.sell-title');

      if (statusField) statusField.style.display = '';
      if (title) title.textContent = 'İlan Düzenle';

      // İlan verilerini yükle ve form'u doldur
      await loadListingForEdit(editId);
    }
  }

  async function loadListingForEdit(listingId) {
    try {
      console.log('Loading listing for edit:', listingId);
      const data = await fetchJSON(`${API_BASE}/api/listings/${listingId}`);
      if (!data.ok || !data.listing) {
        throw new Error('İlan bulunamadı');
      }

      const listing = data.listing;
      console.log('Loaded listing data:', listing);

      // Kategorileri seç (category_slug'dan ana/alt kategoriyi bul)
      const mainCatSelect = $('#mainCat');
      const subCatSelect = $('#subCat');

      if (mainCatSelect && listing.category_slug) {
        console.log('Setting category for slug:', listing.category_slug);

        // Önce mevcut ana kategorilerden bu slug'a sahip olanı ara
        let foundMainCategory = false;
        for (let option of mainCatSelect.options) {
          if (option.value === listing.category_slug) {
            mainCatSelect.value = listing.category_slug;
            foundMainCategory = true;
            console.log('Found main category:', listing.category_slug);
            break;
          }
        }

        // Eğer ana kategoride bulunamadıysa, alt kategorilerden ara
        if (!foundMainCategory && subCatSelect) {
          // Tüm ana kategorileri dene ve alt kategorilerini yükle
          for (let option of mainCatSelect.options) {
            if (option.value && option.value !== '__other') {
              await loadChildCats(option.value, subCatSelect);

              // Bu ana kategorinin alt kategorilerinde ara
              for (let subOption of subCatSelect.options) {
                if (subOption.value === listing.category_slug) {
                  mainCatSelect.value = option.value;
                  subCatSelect.value = listing.category_slug;
                  console.log('Found sub category:', listing.category_slug, 'under main:', option.value);
                  foundMainCategory = true;
                  break;
                }
              }

              if (foundMainCategory) break;
            }
          }
        }

        if (!foundMainCategory) {
          console.warn('Category not found:', listing.category_slug);
        }
      }

      // Form alanlarını doldur
      if ($('#title')) $('#title').value = listing.title || '';
      if ($('#slug')) $('#slug').value = listing.slug || '';
      if ($('#desc')) $('#desc').value = listing.description_md || '';

      // Şehir seçimi - select dropdown'da değer ayarla
      const citySelect = $('#city');
      if (citySelect && listing.location_city) {
        console.log('Setting city to:', listing.location_city);
        citySelect.value = listing.location_city;
        console.log('City select value after setting:', citySelect.value);
      }

      if ($('#status')) $('#status').value = listing.status || 'draft';
      if ($('#condition')) $('#condition').value = listing.condition_grade || 'good';
      if ($('#currency')) $('#currency').value = listing.currency || 'TRY';
      if ($('#allow_trade')) $('#allow_trade').checked = !!listing.allow_trade;

      // Fiyatı düzgün formatta göster
      if ($('#price') && listing.price_minor) {
        const priceStr = (listing.price_minor / 100).toLocaleString('tr-TR', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2
        });
        $('#price').value = priceStr;
        $('#price_minor').value = listing.price_minor;
      }

      // Görselleri yükle
      console.log('Listing images data:', listing.images);
      console.log('Listing image_urls:', listing.image_urls);

      let imageUrls = [];

      // API'den gelen format: images array with file_url
      if (listing.images && Array.isArray(listing.images)) {
        imageUrls = listing.images.map(img => img.file_url).filter(Boolean);
        console.log('Using images from listing.images:', imageUrls);
      }
      // Fallback: image_urls array
      else if (listing.image_urls && Array.isArray(listing.image_urls)) {
        imageUrls = listing.image_urls;
        console.log('Using images from listing.image_urls:', imageUrls);
      }

      if (imageUrls.length > 0) {
        const imagesInput = $('#images');
        if (imagesInput) {
          imagesInput.value = JSON.stringify(imageUrls);
        }

        // Görsel önizlemelerini göster
        displayExistingImages(imageUrls);
        console.log('Displayed', imageUrls.length, 'images');
      } else {
        console.log('No images found for this listing');
      }

      // Form'un edit modunda olduğunu işaretle
      const form = $('#sellForm');
      if (form) {
        form.dataset.editId = listingId;
      }

    } catch (error) {
      console.error('Edit için ilan yükleme hatası:', error);
      alert('İlan bilgileri yüklenemedi: ' + error.message);
    }
  }

  function displayExistingImages(imageUrls) {
    console.log('displayExistingImages called with:', imageUrls);

    const uploadedImagesDiv = $('#uploadedImages');
    const imgCountSpan = $('#imgCount');

    console.log('uploadedImagesDiv element:', uploadedImagesDiv);
    console.log('imgCountSpan element:', imgCountSpan);

    if (!uploadedImagesDiv) {
      console.error('uploadedImages div not found!');
      return;
    }

    if (!Array.isArray(imageUrls)) {
      console.error('imageUrls is not an array:', imageUrls);
      return;
    }

    uploadedImagesDiv.innerHTML = '';

    imageUrls.forEach((url, index) => {
      console.log(`Creating image ${index + 1}:`, url);
      const imageDiv = document.createElement('div');
      imageDiv.className = 'uploaded-image';
      imageDiv.innerHTML = `
        <img src="${url}" alt="Ürün görseli ${index + 1}" style="max-width: 150px; max-height: 150px;" />
        <button type="button" class="remove-image" data-index="${index}">
          <i class="fas fa-times"></i>
        </button>
        ${index === 0 ? '<span class="cover-badge">Kapak</span>' : ''}
      `;
      uploadedImagesDiv.appendChild(imageDiv);
    });

    if (imgCountSpan) {
      imgCountSpan.textContent = imageUrls.length;
    }

    console.log('Successfully displayed', imageUrls.length, 'images');

    // Silme butonlarına event listener ekle
    uploadedImagesDiv.querySelectorAll('.remove-image').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.closest('.remove-image').dataset.index);
        removeExistingImage(index);
      });
    });
  }

  function removeExistingImage(index) {
    const imagesInput = $('#images');
    if (!imagesInput) return;

    try {
      const imageUrls = JSON.parse(imagesInput.value || '[]');
      imageUrls.splice(index, 1);
      imagesInput.value = JSON.stringify(imageUrls);
      displayExistingImages(imageUrls);
    } catch (e) {
      console.error('Error removing image:', e);
    }
  }

  // Initialize sell page when dependencies are ready
  function startSell() {
    console.log('🚀 Sell.js: Starting sell page initialization');
    console.log('🚀 Sell.js: API_BASE available:', API_BASE);

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        if (typeof includePartials === 'function') includePartials();
        boot();
      });
    } else {
      if (typeof includePartials === 'function') includePartials();
      boot();
    }
  }

  // Wait for dependencies to be loaded before starting
  if (window.dependenciesLoadedTriggered) {
    console.log('🚀 Sell.js: Dependencies already loaded, starting immediately');
    startSell();
  } else {
    console.log('🚀 Sell.js: Waiting for dependencies to load...');
    document.addEventListener('dependenciesLoaded', function() {
      console.log('🚀 Sell.js: Dependencies loaded event received, starting sell');
      startSell();
    });
  }

  // Keep legacy partials:loaded listener for backwards compatibility
  document.addEventListener('partials:loaded', boot);
})();