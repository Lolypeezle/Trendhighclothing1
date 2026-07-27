// TRENDHIGHCLOTHING - Front-End Controller & Orchestrator

const StoreApp = {
  products: [],
  cart: [],
  selectedProduct: null,
  selectedSize: null,
  adminLoggedIn: false,
  
  // Cache DOM references
  elements: {},

  getSupabase() {
    if (window.supabaseClient && typeof window.supabaseClient.from === "function") {
      return window.supabaseClient;
    }
    if (window.supabase && typeof window.supabase.from === "function") {
      return window.supabase;
    }
    if (window.supabase && typeof window.supabase.createClient === "function") {
      var url = window.SUPABASE_URL || "https://xbgohwvxrvvrbjbzbwkx.supabase.co";
      var key = window.SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiZ29od3Z4cnZ2cmJqYnpid2t4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5MjM3MTUsImV4cCI6MjA5OTQ5OTcxNX0.dXu3T78fRhOBx2NEN54Fp_p4Vd-5zZg3zIfbT70TrhE";
      window.supabaseClient = window.supabase.createClient(url, key);
      return window.supabaseClient;
    }
    return null;
  },

  async init() {
    this.cacheElements();
    await this.initDatabase();
    this.bindEvents();
    this.setupRouting();
    this.updateCartBadge();
    this.makeLogoTransparent();
    this.checkPaymentRedirectCallback();
  },

  async checkPaymentRedirectCallback() {
    if (window.FlutterwaveService) {
      window.FlutterwaveService.checkUrlCallback((paymentDetails) => {
        const savedCheckout = JSON.parse(localStorage.getItem("thc_pending_checkout") || "{}");
        const shippingDetails = savedCheckout.shippingDetails || {
          firstName: "Valued",
          lastName: "Customer",
          email: paymentDetails.email || "customer@example.com",
          phone: "",
          address: "Shipping Address",
          city: "Lagos",
          state: "Lagos"
        };
        const grandTotal = savedCheckout.grandTotal || paymentDetails.amount || 0;
        const subtotal = savedCheckout.subtotal || (grandTotal - 5000);
        const shipping = savedCheckout.shipping || 5000;

        this.completeOrderCheckout(paymentDetails, shippingDetails, subtotal, shipping, grandTotal);
        localStorage.removeItem("thc_pending_checkout");
      });
    }
  },

  cacheElements() {
    this.elements = {
      // Navigation
      navLogo: document.getElementById("nav-logo"),
      navLinks: document.querySelectorAll(".nav-link"),
      navAdmin: document.getElementById("nav-admin"),
      
      // Page Views
      views: {
        storefront: document.getElementById("storefront-view"),
        checkout: document.getElementById("checkout-view"),
        success: document.getElementById("success-view"),
        adminLogin: document.getElementById("admin-login-view"),
        adminDashboard: document.getElementById("admin-view")
      },
      
      // Storefront Filter & Products
      productsGrid: document.getElementById("products-grid"),
      categoryChips: document.querySelectorAll("#category-filter-container .category-chip"),
      searchInput: document.getElementById("search-input"),
      sortSelect: document.getElementById("sort-select"),
      heroShopBtn: document.getElementById("hero-shop-btn"),
      
      // Cart Toggle and Badge
      cartBtn: document.getElementById("cart-btn"),
      cartCount: document.getElementById("cart-count"),
      
      // Drawers & Overlays
      drawerOverlay: document.getElementById("drawer-overlay"),
      detailDrawer: document.getElementById("product-detail-drawer"),
      cartDrawer: document.getElementById("cart-drawer"),
      
      // Product Detail Drawer inside elements
      detailClose: document.getElementById("detail-drawer-close"),
      detailImage: document.getElementById("detail-image-container"),
      detailCategory: document.getElementById("detail-category"),
      detailTitle: document.getElementById("detail-title"),
      detailPrice: document.getElementById("detail-price"),
      detailDescription: document.getElementById("detail-description"),
      detailSizes: document.getElementById("detail-sizes-container"),
      detailAddBtn: document.getElementById("add-to-cart-drawer-btn"),
      detailStock: document.getElementById("detail-stock-status"),
      
      // Cart Drawer inside elements
      cartClose: document.getElementById("cart-drawer-close"),
      cartItems: document.getElementById("cart-items-container"),
      cartSubtotal: document.getElementById("cart-subtotal"),
      cartShipping: document.getElementById("cart-shipping"),
      cartTotal: document.getElementById("cart-total"),
      cartCheckoutBtn: document.getElementById("cart-checkout-btn"),
      cartFooter: document.getElementById("cart-drawer-footer"),
      
      // Checkout Form Elements
      checkoutForm: document.getElementById("checkout-details-form"),
      checkoutItems: document.getElementById("checkout-summary-items"),
      checkoutSubtotal: document.getElementById("checkout-subtotal"),
      checkoutDelivery: document.getElementById("checkout-delivery"),
      checkoutTotal: document.getElementById("checkout-total"),
      btnProceedPayment: document.getElementById("proceed-payment-btn"),
      btnCancelCheckout: document.getElementById("cancel-checkout-btn"),
      
      // Receipt Elements
      receiptRef: document.getElementById("receipt-ref"),
      receiptDate: document.getElementById("receipt-date"),
      receiptMethod: document.getElementById("receipt-method"),
      receiptCustomer: document.getElementById("receipt-customer"),
      receiptAddress: document.getElementById("receipt-address"),
      receiptSubtotal: document.getElementById("receipt-subtotal"),
      receiptShipping: document.getElementById("receipt-shipping"),
      receiptTotal: document.getElementById("receipt-total"),
      btnSuccessShop: document.getElementById("success-shop-btn"),
      
      // Admin Login Elements
      adminLoginForm: document.getElementById("admin-login-form"),
      adminPassword: document.getElementById("admin-password"),
      loginError: document.getElementById("login-error-msg"),

      // Payment Confirmation Modal
      paymentModal: document.getElementById("payment-confirmation-modal"),
      paymentStatusTitle: document.getElementById("payment-status-title"),
      paymentStatusDesc: document.getElementById("payment-status-desc")
    };
  },

  loadProductsFromCache() {
    const cachedProducts = JSON.parse(localStorage.getItem("thc_products_cache")) || [];
    const customProducts = JSON.parse(localStorage.getItem("thc_custom_products")) || [];
    const demoIds = ["thc-001", "thc-002", "thc-003", "thc-004", "thc-005", "thc-006", "thc-007", "thc-008"];

    const productMap = new Map();
    cachedProducts.forEach(p => {
      if (!demoIds.includes(p.id)) productMap.set(p.id, p);
    });
    customProducts.forEach(p => {
      if (!demoIds.includes(p.id)) productMap.set(p.id, p);
    });

    this.products = Array.from(productMap.values());
    return this.products;
  },

  saveProductsToCache(products) {
    localStorage.setItem("thc_products_cache", JSON.stringify(products));
  },

  async initDatabase() {
    // 1. Load cart from local storage (keeps cart local for guest users)
    this.cart = JSON.parse(localStorage.getItem("thc_cart")) || [];
    
    // Check admin session in Supabase Auth
    try {
      const sb = this.getSupabase();
      if (sb && sb.auth) {
        const { data: { session } } = await sb.auth.getSession();
        if (session && session.user) {
          this.adminLoggedIn = true;
          sessionStorage.setItem("thc_admin_auth", "true");
        } else {
          this.adminLoggedIn = sessionStorage.getItem("thc_admin_auth") === "true";
        }
      }
    } catch (err) {
      console.warn("Could not check Supabase Auth session:", err);
      this.adminLoggedIn = sessionStorage.getItem("thc_admin_auth") === "true";
    }

    // 2. Read from local cache
    const cachedCount = this.loadProductsFromCache().length;

    if (cachedCount > 0) {
      // Instant render from cache (0ms delay), revalidate in background
      this.renderStorefront();
      this.loadProductsFromStorage();
    } else {
      // Cache empty: fetch products from Supabase before rendering to prevent "No items found" flash
      await this.loadProductsFromStorage();
    }
  },

  async loadProductsFromStorage() {
    const demoIds = ["thc-001", "thc-002", "thc-003", "thc-004", "thc-005", "thc-006", "thc-007", "thc-008"];
    let fetchedProducts = [];
    try {
      const sb = this.getSupabase();
      if (sb) {
        const { data, error } = await sb.from('products').select('*');
        if (!error && data && data.length > 0) {
          fetchedProducts = data
            .filter(p => !demoIds.includes(p.id))
            .map(p => ({
              id: p.id,
              title: p.title,
              category: p.category,
              price: p.price,
              description: p.description,
              sizes: p.sizes,
              image: p.image,
              fallbackColor: p.fallback_color,
              stock: p.stock
            }));
        }
      }
    } catch (err) {
      console.warn("Supabase SDK fetch note:", err.message);
    }

    // Direct REST API fallback if SDK fetch returned no items or failed
    if (fetchedProducts.length === 0) {
      try {
        const url = "https://xbgohwvxrvvrbjbzbwkx.supabase.co/rest/v1/products?select=*";
        const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiZ29od3Z4cnZ2cmJqYnpid2t4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5MjM3MTUsImV4cCI6MjA5OTQ5OTcxNX0.dXu3T78fRhOBx2NEN54Fp_p4Vd-5zZg3zIfbT70TrhE";
        const res = await fetch(url, {
          headers: { "apikey": key, "Authorization": "Bearer " + key }
        });
        if (res.ok) {
          const restData = await res.json();
          if (Array.isArray(restData) && restData.length > 0) {
            fetchedProducts = restData
              .filter(p => !demoIds.includes(p.id))
              .map(p => ({
                id: p.id,
                title: p.title,
                category: p.category,
                price: p.price,
                description: p.description,
                sizes: p.sizes,
                image: p.image,
                fallbackColor: p.fallback_color,
                stock: p.stock
              }));
          }
        }
      } catch (restErr) {
        console.warn("Direct REST fetch error:", restErr);
      }
    }

    if (fetchedProducts.length > 0) {
      this.saveProductsToCache(fetchedProducts);
    }
    
    // Reload combined cache & custom products
    this.loadProductsFromCache();
    this.renderStorefront();

    if (window.AdminPortal && typeof window.AdminPortal.loadInventoryData === "function" && window.AdminPortal.activePanel === "admin-inventory") {
      window.AdminPortal.loadInventoryData();
    }
  },

  bindEvents() {
    // View navigation mapping
    this.elements.navLogo.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.hash = "#shop";
    });
    
    this.elements.navLinks.forEach(link => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const view = link.getAttribute("data-view");
        if (view === "admin-view") {
          window.location.hash = this.adminLoggedIn ? "#admin" : "#admin-login";
        } else {
          window.location.hash = "#shop";
        }
      });
    });

    // Hash routing change
    window.addEventListener("hashchange", () => this.setupRouting());

    // Cart Drawer Toggle
    this.elements.cartBtn.addEventListener("click", () => this.toggleDrawer("cart", true));
    this.elements.cartClose.addEventListener("click", () => this.toggleDrawer("cart", false));
    this.elements.drawerOverlay.addEventListener("click", () => {
      this.toggleDrawer("cart", false);
      this.toggleDrawer("detail", false);
    });

    // Detail Drawer Toggle
    this.elements.detailClose.addEventListener("click", () => this.toggleDrawer("detail", false));
    
    // Add to Cart from Detail Drawer
    this.elements.detailAddBtn.addEventListener("click", () => this.handleAddToCartFromDrawer());

    // Filters and Search storefront
    this.elements.categoryChips.forEach(chip => {
      chip.addEventListener("click", () => {
        this.elements.categoryChips.forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        this.filterStorefront();
      });
    });
    
    this.elements.searchInput.addEventListener("input", () => this.filterStorefront());
    this.elements.sortSelect.addEventListener("change", () => this.filterStorefront());
    this.elements.heroShopBtn.addEventListener("click", () => {
      const controlsOffset = document.querySelector(".shop-controls").offsetTop - 100;
      window.scrollTo({ top: controlsOffset, behavior: "smooth" });
    });

    // Cart drawer buttons
    this.elements.cartCheckoutBtn.addEventListener("click", () => {
      this.toggleDrawer("cart", false);
      window.location.hash = "#checkout";
    });

    // Checkout actions
    this.elements.btnCancelCheckout.addEventListener("click", () => {
      window.location.hash = "#shop";
    });
    
    this.elements.btnProceedPayment.addEventListener("click", () => this.handleCheckoutSubmission());

    // Listen for Shipping Method option selection
    document.querySelectorAll('input[name="shipping-method"]').forEach(radio => {
      radio.addEventListener("change", (e) => {
        document.querySelectorAll('.shipping-option-card').forEach(card => card.classList.remove('active'));
        const card = e.target.closest('.shipping-option-card');
        if (card) card.classList.add('active');
        this.renderCheckoutSummary();
      });
    });

    // Success action
    this.elements.btnSuccessShop.addEventListener("click", () => {
      window.location.hash = "#shop";
    });

    // Admin login submit
    this.elements.adminLoginForm.addEventListener("submit", (e) => this.handleAdminLogin(e));

    // Footer filter mapping
    document.querySelectorAll(".footer-filter-link").forEach(link => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const cat = link.getAttribute("data-category");
        window.location.hash = "#shop";
        
        // Find category chip and click it
        this.elements.categoryChips.forEach(c => {
          if (c.getAttribute("data-category") === cat) {
            c.click();
          }
        });
        
        const controlsOffset = document.querySelector(".shop-controls").offsetTop - 100;
        window.scrollTo({ top: controlsOffset, behavior: "smooth" });
      });
    });

    // Dynamic header style on scroll
    const header = document.querySelector("header");
    window.addEventListener("scroll", () => {
      if (window.scrollY > 40) {
        header.classList.add("scrolled");
      } else {
        header.classList.remove("scrolled");
      }
    });
  },

  setupRouting() {
    const hash = window.location.hash || "#shop";
    const header = document.querySelector("header");
    
    // Toggle on-hero class depending on view
    if (hash === "#shop" || hash === "") {
      header.classList.add("on-hero");
    } else {
      header.classList.remove("on-hero");
    }
    
    // Hide all views first
    Object.values(this.elements.views).forEach(v => v.classList.remove("active"));
    this.elements.navLinks.forEach(l => l.classList.remove("active"));
    document.querySelectorAll(".mobile-nav-link").forEach(l => l.classList.remove("active"));
    
    // Route page active views
    if (hash === "#shop") {
      this.elements.views.storefront.classList.add("active");
      this.elements.navLinks[0].classList.add("active"); // Shop link active
      const mobShop = document.querySelector('.mobile-nav-link[data-view="storefront-view"]');
      if (mobShop) mobShop.classList.add("active");
      this.renderStorefront();
    } else if (hash === "#checkout") {
      if (this.cart.length === 0) {
        window.location.hash = "#shop";
        return;
      }
      this.elements.views.checkout.classList.add("active");
      this.renderCheckoutSummary();
    } else if (hash === "#success") {
      this.elements.views.success.classList.add("active");
    } else if (hash === "#admin-login") {
      if (this.adminLoggedIn) {
        window.location.hash = "#admin";
        return;
      }
      this.elements.views.adminLogin.classList.add("active");
      this.elements.navAdmin.classList.add("active");
      const mobAdmin = document.getElementById("mobile-nav-admin");
      if (mobAdmin) mobAdmin.classList.add("active");
    } else if (hash === "#admin") {
      if (!this.adminLoggedIn) {
        window.location.hash = "#admin-login";
        return;
      }
      this.elements.views.adminDashboard.classList.add("active");
      this.elements.navAdmin.classList.add("active");
      const mobAdmin = document.getElementById("mobile-nav-admin");
      if (mobAdmin) mobAdmin.classList.add("active");
      
      // Trigger dashboard loading
      if (window.AdminPortal) {
        window.AdminPortal.switchPanel("admin-overview");
      }
    }
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: "instant" });
  },

  // RENDER STOREFRONT PRODUCT CATALOG
  renderStorefront(productsToRender = this.products) {
    let cardsHtml = "";
    
    if (productsToRender.length === 0) {
      cardsHtml = `
        <div style="grid-column: 1/-1; text-align:center; padding:60px 0; color:var(--text-secondary);">
          <p style="font-family:var(--font-serif); font-size: 20px; font-style: italic;">No items found</p>
          <p style="font-size:13px; margin-top:8px;">Try adjusting your keywords or category filters.</p>
        </div>
      `;
    } else {
      productsToRender.forEach(p => {
        const isOutOfStock = p.stock === 0;
        const badgeHtml = isOutOfStock ? `<span class="product-card-badge out-of-stock">Sold Out</span>` : "";
        const buttonDisabled = isOutOfStock ? "disabled" : "";
        
        cardsHtml += `
          <div class="product-card" onclick="StoreApp.openProductDetail('${p.id}')">
            ${badgeHtml}
            <div class="product-image-container">
              ${this.getProductImageOrSVG(p)}
            </div>
            <div class="product-info">
              <h2 class="product-card-title">${p.title}</h2>
              <div class="product-card-price-row">
                <span class="product-card-price">${this.formatNaira(p.price)}</span>
              </div>
              <button class="btn-quick-add" onclick="event.stopPropagation(); StoreApp.quickAddToCart('${p.id}')" ${buttonDisabled}>
                ${isOutOfStock ? "Sold Out" : "Add to Cart"}
              </button>
            </div>
          </div>
        `;
      });
    }
    
    this.elements.productsGrid.innerHTML = cardsHtml;
  },

  formatNaira(val) {
    return "₦" + Number(val).toLocaleString("en-NG", { minimumFractionDigits: 0 });
  },

  // Visual vectors corresponding to luxury fashion pieces
  getProductSVG(category, color = "#3A3530") {
    if (category === "Hoodies") {
      return `<svg class="product-image-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" stroke="${color}" fill="none">
        <path d="M25 35 C30 22, 70 22, 75 35 C78 50, 80 80, 75 88 L 25 88 C20 80, 22 50, 25 35 Z"/>
        <path d="M25 38 L 12 45 L 18 52 L 26 44"/>
        <path d="M75 38 L 88 45 L 82 52 L 74 44"/>
        <path d="M40 38 L 50 48 L 60 38"/>
      </svg>`;
    } else if (category === "Pants") {
      return `<svg class="product-image-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" stroke="${color}" fill="none">
        <path d="M30 20 L 70 20 L 75 85 L 53 85 L 50 48 L 47 85 L 25 85 Z"/>
      </svg>`;
    } else if (category === "Tees") {
      return `<svg class="product-image-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" stroke="${color}" fill="none">
        <path d="M22 25 L 38 18 L 62 18 L 78 25 L 85 42 L 72 45 L 72 85 L 28 85 L 28 45 L 15 42 Z"/>
      </svg>`;
    } else if (category === "Outerwear") {
      return `<svg class="product-image-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" stroke="${color}" fill="none">
        <path d="M25 18 L 75 18 L 82 85 L 18 85 Z"/>
        <line x1="50" y1="18" x2="50" y2="85"/>
        <path d="M32 18 L 50 35 L 68 18"/>
      </svg>`;
    } else {
      return `<svg class="product-image-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" stroke="${color}" fill="none">
        <rect x="25" y="30" width="50" height="40" rx="4"/>
        <path d="M35 30 C35 18, 65 18, 65 30"/>
      </svg>`;
    }
  },

  getProductImageOrSVG(p) {
    if (p && p.image && (p.image.startsWith("http") || p.image.startsWith("assets") || p.image.startsWith("data:") || p.image.startsWith("/") || p.image.startsWith("blob:"))) {
      return `<img src="${p.image}" class="product-image-img" alt="${p.title || 'Product'}" loading="lazy" decoding="async" style="width: 100%; height: 100%; object-fit: cover; transition: var(--transition-smooth);">`;
    }
    return this.getProductSVG(p ? p.category : "Tees", p ? p.fallbackColor : "#3A3530");
  },

  // FILTER & SEARCH LOGIC
  filterStorefront() {
    const selectedCategoryChip = document.querySelector("#category-filter-container .category-chip.active");
    const category = selectedCategoryChip ? selectedCategoryChip.getAttribute("data-category") : "all";
    const searchQuery = this.elements.searchInput.value.toLowerCase().trim();
    const sortVal = this.elements.sortSelect.value;
    
    let filtered = [...this.products];
    
    // Category check
    if (category !== "all") {
      filtered = filtered.filter(p => p.category === category);
    }
    
    // Search check
    if (searchQuery.length > 0) {
      filtered = filtered.filter(p => 
        p.title.toLowerCase().includes(searchQuery) || 
        p.description.toLowerCase().includes(searchQuery)
      );
    }
    
    // Sort check
    if (sortVal === "price-asc") {
      filtered.sort((a, b) => a.price - b.price);
    } else if (sortVal === "price-desc") {
      filtered.sort((a, b) => b.price - a.price);
    } else if (sortVal === "stock-desc") {
      filtered.sort((a, b) => b.stock - a.stock);
    }
    
    this.renderStorefront(filtered);
  },

  // SIDE DRAWERS (Cart & Product details)
  toggleDrawer(drawerType, open) {
    const overlay = this.elements.drawerOverlay;
    const drawer = drawerType === "cart" ? this.elements.cartDrawer : this.elements.detailDrawer;
    
    if (open) {
      overlay.style.display = "block";
      drawer.style.display = "flex";
      setTimeout(() => {
        overlay.classList.add("active");
        drawer.classList.add("active");
      }, 10);
      
      if (drawerType === "cart") {
        this.renderCart();
      }
    } else {
      overlay.classList.remove("active");
      drawer.classList.remove("active");
      setTimeout(() => {
        overlay.style.display = "none";
        drawer.style.display = "none";
      }, 400);
    }
  },

  // Detail Drawer Actions
  openProductDetail(productId) {
    const p = this.products.find(prod => prod.id === productId);
    if (!p) return;
    
    this.selectedProduct = p;
    this.selectedSize = null;
    
    // Setup fields
    this.elements.detailCategory.textContent = p.category;
    this.elements.detailTitle.textContent = p.title;
    this.elements.detailPrice.textContent = this.formatNaira(p.price);
    this.elements.detailDescription.textContent = p.description;
    this.elements.detailImage.innerHTML = this.getProductImageOrSVG(p);
    
    // Sizing
    let sizesHtml = "";
    p.sizes.forEach(size => {
      const isOutOfStock = p.stock === 0;
      const disabledClass = isOutOfStock ? "disabled" : "";
      sizesHtml += `<button class="size-chip ${disabledClass}" onclick="StoreApp.selectSize(this, '${size}')" ${isOutOfStock ? 'disabled' : ''}>${size}</button>`;
    });
    this.elements.detailSizes.innerHTML = sizesHtml;
    
    // Stock statement
    if (p.stock === 0) {
      this.elements.detailStock.textContent = "Sold Out";
      this.elements.detailStock.style.color = "var(--error)";
      this.elements.detailAddBtn.disabled = true;
      this.elements.detailAddBtn.textContent = "Unavailable";
    } else {
      this.elements.detailStock.textContent = `Only ${p.stock} units available`;
      this.elements.detailStock.style.color = "var(--text-secondary)";
      this.elements.detailAddBtn.disabled = false;
      this.elements.detailAddBtn.textContent = "Add to Cart";
    }
    
    this.toggleDrawer("detail", true);
  },

  selectSize(btnElement, size) {
    const chips = this.elements.detailSizes.querySelectorAll(".size-chip");
    chips.forEach(c => c.classList.remove("active"));
    
    btnElement.classList.add("active");
    this.selectedSize = size;
  },

  handleAddToCartFromDrawer() {
    if (!this.selectedProduct) return;
    
    if (!this.selectedSize) {
      alert("Please select your size before adding to cart.");
      return;
    }

    this.addToCart(this.selectedProduct.id, this.selectedSize);
    this.toggleDrawer("detail", false);
    
    // Micro animation to open cart drawer briefly
    setTimeout(() => {
      this.toggleDrawer("cart", true);
    }, 450);
  },

  addToCart(productId, size) {
    const p = this.products.find(prod => prod.id === productId);
    if (!p || p.stock === 0) return;
    
    // Check if item details exist in cart
    const cartIdx = this.cart.findIndex(item => item.id === productId && item.size === size);
    
    if (cartIdx > -1) {
      // Check stock threshold
      if (this.cart[cartIdx].qty < p.stock) {
        this.cart[cartIdx].qty += 1;
      } else {
        alert(`Cannot add more. Limit of ${p.stock} units reached.`);
        return;
      }
    } else {
      this.cart.push({
        id: p.id,
        title: p.title,
        price: p.price,
        category: p.category,
        size: size,
        qty: 1,
        fallbackColor: p.fallbackColor,
        image: p.image
      });
    }
    
    localStorage.setItem("thc_cart", JSON.stringify(this.cart));
    this.updateCartBadge();
    this.renderCart();
  },

  quickAddToCart(productId) {
    const p = this.products.find(prod => prod.id === productId);
    if (!p || p.stock === 0) return;
    const defaultSize = p.sizes.includes("L") ? "L" : p.sizes[0];
    this.addToCart(productId, defaultSize);
    this.toggleDrawer("cart", true);
  },

  updateCartBadge() {
    let totalQty = 0;
    this.cart.forEach(item => {
      totalQty += item.qty;
    });
    this.elements.cartCount.textContent = totalQty;
  },

  // CART DRAWER RENDER
  renderCart() {
    let cartHtml = "";
    
    if (this.cart.length === 0) {
      cartHtml = `
        <div class="cart-empty-message">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <circle cx="9" cy="21" r="1"></circle>
            <circle cx="20" cy="21" r="1"></circle>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
          </svg>
          <p style="font-family:var(--font-serif); font-style:italic; font-size:18px;">Your bag is empty</p>
          <button class="btn btn-secondary" onclick="StoreApp.toggleDrawer('cart', false)" style="padding:10px 20px; font-size:12px;">Shop New Arrivals</button>
        </div>
      `;
      this.elements.cartFooter.style.display = "none";
    } else {
      this.elements.cartFooter.style.display = "block";
      
      let subtotal = 0;
      this.cart.forEach(item => {
        const itemTotal = item.price * item.qty;
        subtotal += itemTotal;
        
        cartHtml += `
          <div class="cart-item">
            <div class="cart-item-img" style="display: flex; align-items: center; justify-content: center; overflow: hidden; background-color: var(--accent-light); border-radius: 2px;">
              ${this.getProductImageOrSVG(item)}
            </div>
            
            <div class="cart-item-details">
              <div class="cart-item-title-row">
                <h3 class="cart-item-title">${item.title}</h3>
                <button class="btn-remove-item" onclick="StoreApp.removeFromCart('${item.id}', '${item.size}')">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
              
              <div class="cart-item-meta">Size: ${item.size}</div>
              
              <div class="cart-item-qty-row">
                <div class="qty-control">
                  <button class="qty-btn" onclick="StoreApp.changeQty('${item.id}', '${item.size}', -1)">-</button>
                  <span class="qty-value">${item.qty}</span>
                  <button class="qty-btn" onclick="StoreApp.changeQty('${item.id}', '${item.size}', 1)">+</button>
                </div>
                <span class="cart-item-price">${this.formatNaira(itemTotal)}</span>
              </div>
            </div>
          </div>
        `;
      });
      
      const shipping = subtotal > 0 ? 5000 : 0;
      const grandTotal = subtotal + shipping;

      if (this.elements.cartSubtotal) this.elements.cartSubtotal.textContent = this.formatNaira(subtotal);
      if (this.elements.cartShipping) this.elements.cartShipping.textContent = this.formatNaira(shipping);
      if (this.elements.cartTotal) this.elements.cartTotal.textContent = this.formatNaira(grandTotal);
    }
    
    this.elements.cartItems.innerHTML = cartHtml;
  },

  changeQty(productId, size, change) {
    const idx = this.cart.findIndex(item => item.id === productId && item.size === size);
    if (idx === -1) return;
    
    const p = this.products.find(prod => prod.id === productId);
    if (!p) return;
    
    const newQty = this.cart[idx].qty + change;
    
    if (newQty <= 0) {
      this.removeFromCart(productId, size);
    } else if (newQty <= p.stock) {
      this.cart[idx].qty = newQty;
    } else {
      alert(`Limit reached. Only ${p.stock} units in inventory.`);
    }
    
    localStorage.setItem("thc_cart", JSON.stringify(this.cart));
    this.updateCartBadge();
    this.renderCart();
  },

  removeFromCart(productId, size) {
    this.cart = this.cart.filter(item => !(item.id === productId && item.size === size));
    localStorage.setItem("thc_cart", JSON.stringify(this.cart));
    this.updateCartBadge();
    this.renderCart();
  },

  getSelectedShippingFee() {
    const selectedRadio = document.querySelector('input[name="shipping-method"]:checked');
    return selectedRadio ? Number(selectedRadio.value) : 5000;
  },

  // CHECKOUT PAGE BINDINGS
  renderCheckoutSummary() {
    let summaryHtml = "";
    let subtotal = 0;
    
    this.cart.forEach(item => {
      const itemTotal = item.price * item.qty;
      subtotal += itemTotal;
      
      summaryHtml += `
        <div class="summary-item-card">
          <div class="summary-item-meta">
            <div class="summary-item-thumb" style="display: flex; align-items: center; justify-content: center; overflow: hidden; background-color: var(--accent-light); border-radius: 2px;">
              ${this.getProductImageOrSVG(item)}
            </div>
            <div>
              <h3 class="summary-item-name">${item.title}</h3>
              <span class="summary-item-size">Size: ${item.size} (x${item.qty})</span>
            </div>
          </div>
          <span class="summary-item-price">${this.formatNaira(itemTotal)}</span>
        </div>
      `;
    });
    
    const shipping = this.getSelectedShippingFee();
    const grandTotal = subtotal + shipping;
    
    if (this.elements.checkoutItems) this.elements.checkoutItems.innerHTML = summaryHtml;
    if (this.elements.checkoutSubtotal) this.elements.checkoutSubtotal.textContent = this.formatNaira(subtotal);
    if (this.elements.checkoutDelivery) this.elements.checkoutDelivery.textContent = this.formatNaira(shipping);
    if (this.elements.checkoutTotal) this.elements.checkoutTotal.textContent = this.formatNaira(grandTotal);
  },

  handleCheckoutSubmission() {
    const form = this.elements.checkoutForm;
    
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    
    // Read billing & delivery data
    const firstName = document.getElementById("first-name").value;
    const lastName = document.getElementById("last-name").value;
    const email = document.getElementById("shipping-email").value;
    const phone = document.getElementById("shipping-phone").value;
    const address = document.getElementById("shipping-address").value;
    const city = document.getElementById("shipping-city").value;
    const state = document.getElementById("shipping-state").value;
    
    let subtotal = 0;
    this.cart.forEach(item => subtotal += (item.price * item.qty));
    const shipping = this.getSelectedShippingFee();
    const grandTotal = subtotal + shipping;
    
    // Store pending shipping details for redirect recovery
    const shippingDetails = { firstName, lastName, email, phone, address, city, state, subtotal, shipping, grandTotal };
    localStorage.setItem("thc_pending_checkout", JSON.stringify({ shippingDetails, grandTotal, subtotal, shipping }));

    // Launch Flutterwave Secure Payment Integration
    if (window.FlutterwaveService) {
      FlutterwaveService.processPayment({
        amount: grandTotal,
        subtotal: subtotal,
        shipping: shipping,
        email: email,
        name: `${firstName} ${lastName}`,
        phone: phone,
        onSuccess: (paymentDetails) => {
          localStorage.removeItem("thc_pending_checkout");
          this.completeOrderCheckout(paymentDetails, shippingDetails, subtotal, shipping, grandTotal);
        },
        onCancel: () => {
          console.log("Payment flow cancelled.");
        }
      });
    } else {
      // Fallback
      this.completeOrderCheckout({
        reference: "THC-FLW-" + Date.now(),
        method: "Flutterwave",
        status: "Paid",
        date: new Date().toLocaleString("en-NG")
      }, shippingDetails, subtotal, shipping, grandTotal);
    }
  },

  showPaymentConfirmationOverlay(msg) {
    if (this.elements.paymentModal) {
      if (msg && this.elements.paymentStatusDesc) {
        this.elements.paymentStatusDesc.textContent = msg;
      }
      this.elements.paymentModal.style.display = "flex";
      setTimeout(() => {
        this.elements.paymentModal.classList.add("active");
      }, 10);
    }
  },

  hidePaymentConfirmationOverlay() {
    if (this.elements.paymentModal) {
      this.elements.paymentModal.classList.remove("active");
      setTimeout(() => {
        this.elements.paymentModal.style.display = "none";
      }, 300);
    }
  },

  async completeOrderCheckout(paymentDetails, shippingDetails, subtotal, shipping, grandTotal) {
    const calcSubtotal = subtotal || (grandTotal - (shipping || 5000));
    const calcShipping = shipping || 5000;

    const newOrder = {
      id: paymentDetails.reference,
      customer_name: `${shippingDetails.firstName} ${shippingDetails.lastName}`,
      email: shippingDetails.email,
      phone: shippingDetails.phone,
      shipping_address: shippingDetails.address,
      city: shippingDetails.city,
      state: shippingDetails.state,
      items: [...this.cart],
      total: grandTotal,
      payment_reference: paymentDetails.reference,
      payment_status: paymentDetails.status,
      payment_method: paymentDetails.method
    };
    
    try {
      // 1. Insert order to Supabase
      const { error: orderError } = await supabase
        .from('orders')
        .insert([newOrder]);
        
      if (orderError) throw orderError;
      
      // 2. Deduct stocks from products in Supabase
      for (const cartItem of this.cart) {
        const prod = this.products.find(p => p.id === cartItem.id);
        if (prod) {
          const newStock = Math.max(0, prod.stock - cartItem.qty);
          const { error: stockError } = await supabase
            .from('products')
            .update({ stock: newStock })
            .eq('id', cartItem.id);
            
          if (stockError) {
            console.error(`Failed to update stock for ${cartItem.id}:`, stockError);
          }
        }
      }
      
      // Reload products state from Supabase
      await this.loadProductsFromStorage();
      
      // Populate Receipt View
      this.elements.receiptRef.textContent = newOrder.id;
      this.elements.receiptDate.textContent = paymentDetails.date || new Date().toLocaleString("en-NG");
      this.elements.receiptMethod.textContent = newOrder.payment_method;
      this.elements.receiptCustomer.textContent = newOrder.customer_name;
      this.elements.receiptAddress.textContent = `${newOrder.shipping_address}, ${newOrder.city}, ${newOrder.state} State`;
      if (this.elements.receiptSubtotal) this.elements.receiptSubtotal.textContent = this.formatNaira(calcSubtotal);
      if (this.elements.receiptShipping) this.elements.receiptShipping.textContent = this.formatNaira(calcShipping);
      this.elements.receiptTotal.textContent = this.formatNaira(newOrder.total);
      
      // Clear Cart
      this.cart = [];
      localStorage.setItem("thc_cart", JSON.stringify(this.cart));
      this.updateCartBadge();
      
      // Reset checkout form fields
      this.elements.checkoutForm.reset();
      
      // Route to Success Screen
      window.location.hash = "#success";
    } catch (err) {
      console.error("Order completion failed:", err);
      
      // Local fallback so user is not blocked
      const localOrders = JSON.parse(localStorage.getItem("thc_orders")) || [];
      localOrders.push({
        ...newOrder,
        subtotal: calcSubtotal,
        shipping: calcShipping,
        date: paymentDetails.date || new Date().toLocaleString("en-NG"),
        method: paymentDetails.method,
        customerName: newOrder.customer_name,
        address: newOrder.shipping_address
      });
      localStorage.setItem("thc_orders", JSON.stringify(localOrders));
      
      // Proceed to show receipt anyway
      this.elements.receiptRef.textContent = newOrder.id;
      this.elements.receiptDate.textContent = paymentDetails.date || new Date().toLocaleString("en-NG");
      this.elements.receiptMethod.textContent = paymentDetails.method;
      this.elements.receiptCustomer.textContent = newOrder.customer_name;
      this.elements.receiptAddress.textContent = `${newOrder.shipping_address}, ${newOrder.city}, ${newOrder.state} State`;
      if (this.elements.receiptSubtotal) this.elements.receiptSubtotal.textContent = this.formatNaira(calcSubtotal);
      if (this.elements.receiptShipping) this.elements.receiptShipping.textContent = this.formatNaira(calcShipping);
      this.elements.receiptTotal.textContent = this.formatNaira(newOrder.total);
      this.cart = [];
      localStorage.setItem("thc_cart", JSON.stringify(this.cart));
      this.updateCartBadge();
      this.elements.checkoutForm.reset();
      window.location.hash = "#success";
    }
  },

  // ADMIN LOGIN (Authenticated via Supabase Auth Database)
  async handleAdminLogin(e) {
    e.preventDefault();
    const email = document.getElementById("admin-email").value.trim();
    const password = this.elements.adminPassword.value.trim();

    const sbClient = window.supabaseClient || window.supabase;
    if (!sbClient || !sbClient.auth || typeof sbClient.auth.signInWithPassword !== "function") {
      this.elements.loginError.style.display = "block";
      this.elements.loginError.textContent = "Supabase Auth client not ready. Please refresh the page.";
      return;
    }

    try {
      const { data, error } = await sbClient.auth.signInWithPassword({
        email: email,
        password: password
      });
      
      if (error) throw error;
      
      if (data && data.user) {
        this.adminLoggedIn = true;
        sessionStorage.setItem("thc_admin_auth", "true");
        this.elements.loginError.style.display = "none";
        this.elements.adminPassword.value = "";
        document.getElementById("admin-email").value = "";
        window.location.hash = "#admin";
      }
    } catch (err) {
      console.error("Login failed:", err);
      this.elements.loginError.style.display = "block";
      this.elements.loginError.textContent = "Login failed: " + (err.message || "Invalid credentials");
    }
  },

  makeLogoTransparent() {
    const logoImg = document.getElementById("nav-logo").querySelector("img");
    if (!logoImg) return;

    const processImage = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      
      canvas.width = logoImg.naturalWidth;
      canvas.height = logoImg.naturalHeight;
      
      ctx.drawImage(logoImg, 0, 0);
      
      try {
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        
        // Loop through all pixels (RGBA)
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i+1];
          const b = data[i+2];
          
          // If the pixel is very dark (close to black background)
          if (r < 50 && g < 50 && b < 50) {
            data[i+3] = 0; // Set alpha to 0 (make transparent)
          }
        }
        
        ctx.putImageData(imgData, 0, 0);
        logoImg.src = canvas.toDataURL("image/png");
      } catch (e) {
        console.warn("Failed to clean logo background locally (CORS policy or canvas lock):", e);
      }
    };

    if (logoImg.complete) {
      processImage();
    } else {
      logoImg.addEventListener("load", processImage);
    }
  }
};

// Expose globally
window.StoreApp = StoreApp;

// Resilient Initialization for Netlify & Async Scripts
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => StoreApp.init());
} else {
  StoreApp.init();
}
