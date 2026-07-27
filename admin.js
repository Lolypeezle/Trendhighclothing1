// TRENDHIGHCLOTHING - Administrative Back-Office Controller

const AdminPortal = {
  activePanel: "admin-overview",

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

  init() {
    this.cacheElements();
    this.bindEvents();
    this.setupOrderRealtimeSync();
  },

  cacheElements() {
    this.elements = {
      navItems: document.querySelectorAll("[data-admin-panel]"),
      panels: document.querySelectorAll(".admin-panel"),
      btnLogout: document.getElementById("admin-logout-btn"),

      // Overview elements
      totalSalesText: document.getElementById("stat-total-sales"),
      totalOrdersText: document.getElementById("stat-total-orders"),
      avgValueText: document.getElementById("stat-avg-value"),
      chartContainer: document.getElementById("revenue-chart-container"),
      activityContainer: document.getElementById("recent-activity-container"),

      // Inventory elements
      inventoryTableBody: document.getElementById("admin-inventory-table-body"),
      btnAddProduct: document.getElementById("admin-add-product-btn"),
      productModal: document.getElementById("admin-product-modal-overlay"),
      productForm: document.getElementById("admin-product-form"),
      modalClose: document.getElementById("admin-modal-close"),
      modalCancel: document.getElementById("admin-modal-cancel"),
      modalTitle: document.getElementById("admin-modal-title"),

      // Hidden / Input fields
      editProductId: document.getElementById("edit-product-id"),
      productTitle: document.getElementById("product-title"),
      productCategory: document.getElementById("product-category"),
      productPrice: document.getElementById("product-price"),
      productDescription: document.getElementById("product-description"),
      productStock: document.getElementById("product-stock"),
      productColor: document.getElementById("product-color"),
      productSizes: document.getElementById("product-sizes"),
      productImageFile: document.getElementById("product-image-file"),
      productSubmitBtn: document.getElementById("admin-modal-submit"),

      // Orders elements
      ordersTableBody: document.getElementById("admin-orders-table-body")
    };
  },

  bindEvents() {
    // Panel navigation
    this.elements.navItems.forEach(item => {
      item.addEventListener("click", () => {
        const panelId = item.getAttribute("data-admin-panel");
        this.switchPanel(panelId);
      });
    });

    // Logout
    this.elements.btnLogout.addEventListener("click", async () => {
      if (confirm("Exit admin session?")) {
        try {
          const sb = this.getSupabase();
          if (sb && sb.auth) await sb.auth.signOut();
        } catch (err) {
          console.warn("Error signing out from Supabase Auth:", err);
        }
        sessionStorage.removeItem("thc_admin_auth");
        if (window.StoreApp) {
          window.StoreApp.adminLoggedIn = false;
        }
        window.location.hash = "#shop";
      }
    });

    // Add Product Modal
    this.elements.btnAddProduct.addEventListener("click", () => this.openAddModal());
    this.elements.modalClose.addEventListener("click", () => this.closeModal());
    this.elements.modalCancel.addEventListener("click", () => this.closeModal());

    // Product form submit
    this.elements.productForm.addEventListener("submit", (e) => this.handleProductSubmit(e));
  },

  switchPanel(panelId) {
    this.activePanel = panelId;

    // Update navigation active states
    this.elements.navItems.forEach(item => {
      if (item.getAttribute("data-admin-panel") === panelId) {
        item.classList.add("active");
      } else {
        item.classList.remove("active");
      }
    });

    // Update panels active states
    this.elements.panels.forEach(panel => {
      if (panel.getAttribute("id") === panelId) {
        panel.classList.add("active");
      } else {
        panel.classList.remove("active");
      }
    });

    // Refresh specific panel data
    this.refreshPanelData(panelId);
  },

  refreshPanelData(panelId) {
    if (panelId === "admin-overview") {
      this.loadDashboardData();
    } else if (panelId === "admin-inventory") {
      this.loadInventoryData();
    } else if (panelId === "admin-orders") {
      this.loadOrdersData();
    }
  },

  formatNaira(val) {
    return "₦" + Number(val).toLocaleString("en-NG", { minimumFractionDigits: 0 });
  },

  readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  },


  async fetchOrders() {
    let orders = [];
    const sb = this.getSupabase();

    // 1. Attempt Supabase SDK fetch
    if (sb) {
      try {
        const { data, error } = await sb.from('orders').select('*');
        if (!error && Array.isArray(data) && data.length > 0) {
          orders = data.map(o => ({
            id: o.id,
            date: o.created_at ? new Date(o.created_at).toLocaleString("en-NG") : (o.date || "N/A"),
            method: o.payment_method || o.method || "N/A",
            customerName: o.customer_name || o.customerName || "Customer",
            email: o.email || "",
            phone: o.phone || "",
            address: o.shipping_address || o.address || "",
            city: o.city || "",
            state: o.state || "",
            items: o.items || [],
            total: Number(o.total || 0),
            status: o.payment_status || o.status || "Paid"
          }));
        }
      } catch (err) {
        console.warn("SDK order fetch warning:", err);
      }
    }

    // 2. Direct REST API Fallback if SDK returns no orders
    if (orders.length === 0) {
      try {
        const url = "https://xbgohwvxrvvrbjbzbwkx.supabase.co/rest/v1/orders?select=*";
        const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiZ29od3Z4cnZ2cmJqYnpid2t4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5MjM3MTUsImV4cCI6MjA5OTQ5OTcxNX0.dXu3T78fRhOBx2NEN54Fp_p4Vd-5zZg3zIfbT70TrhE";
        const res = await fetch(url, {
          headers: { "apikey": key, "Authorization": "Bearer " + key }
        });
        if (res.ok) {
          const restData = await res.json();
          if (Array.isArray(restData) && restData.length > 0) {
            orders = restData.map(o => ({
              id: o.id,
              date: o.created_at ? new Date(o.created_at).toLocaleString("en-NG") : (o.date || "N/A"),
              method: o.payment_method || o.method || "N/A",
              customerName: o.customer_name || o.customerName || "Customer",
              email: o.email || "",
              phone: o.phone || "",
              address: o.shipping_address || o.address || "",
              city: o.city || "",
              state: o.state || "",
              items: o.items || [],
              total: Number(o.total || 0),
              status: o.payment_status || o.status || "Paid"
            }));
          }
        }
      } catch (restErr) {
        console.warn("Direct REST order fetch error:", restErr);
      }
    }

    // 3. Merge local fallback orders from localStorage
    try {
      const localOrders = JSON.parse(localStorage.getItem("thc_orders")) || [];
      localOrders.forEach(lo => {
        if (!orders.some(o => o.id === lo.id)) {
          orders.push({
            id: lo.id,
            date: lo.date || new Date().toLocaleString("en-NG"),
            method: lo.payment_method || lo.method || "N/A",
            customerName: lo.customer_name || lo.customerName || "Customer",
            email: lo.email || "",
            phone: lo.phone || "",
            address: lo.shipping_address || lo.address || "",
            city: lo.city || "",
            state: lo.state || "",
            items: lo.items || [],
            total: Number(lo.total || 0),
            status: lo.payment_status || lo.status || "Paid"
          });
        }
      });
    } catch (e) {}

    // Filter out demo order names (fgc, adefeni, ade femi, adefemi, femi)
    const demoKeywords = ["fgc", "adefeni", "ade femi", "adefemi", "femi"];
    orders = orders.filter(o => {
      const name = (o.customerName || "").toLowerCase();
      const email = (o.email || "").toLowerCase();
      const id = (o.id || "").toLowerCase();
      return !demoKeywords.some(kw => name.includes(kw) || email.includes(kw) || id.includes(kw));
    });

    return orders;
  },

  setupOrderRealtimeSync() {
    if ("BroadcastChannel" in window) {
      try {
        const channel = new BroadcastChannel("thc_orders_channel");
        channel.onmessage = (event) => {
          if (event.data && (event.data.type === "ORDER_CREATED" || event.data.type === "ORDER_UPDATED")) {
            this.refreshPanelData(this.activePanel);
          }
        };
      } catch (e) {}
    }

    window.addEventListener("thc-order-created", () => {
      this.refreshPanelData(this.activePanel);
    });

    try {
      const sb = this.getSupabase();
      if (sb && typeof sb.channel === "function") {
        sb.channel("orders-db-changes")
          .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
            this.refreshPanelData(this.activePanel);
          })
          .subscribe();
      }
    } catch (e) {}
  },

  async loadDashboardData() {
    const orders = await this.fetchOrders();

    let totalSales = 0;
    orders.forEach(order => {
      totalSales += order.total;
    });

    const totalOrders = orders.length;
    const avgValue = totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0;

    this.elements.totalSalesText.textContent = this.formatNaira(totalSales);
    this.elements.totalOrdersText.textContent = totalOrders;
    this.elements.avgValueText.textContent = this.formatNaira(avgValue);

    this.renderSalesChart(orders);
    this.renderActivityLog(orders);
  },

  renderSalesChart(orders) {
    const months = ["Feb", "Mar", "Apr", "May", "Jun", "Jul"];
    let salesByMonth = [0, 0, 0, 0, 0, 0];

    if (orders && orders.length > 0) {
      orders.forEach(order => {
        let totalVal = Number(order.total || 0);
        if (order.date && !isNaN(new Date(order.date).getTime())) {
          const d = new Date(order.date);
          const monthIdx = d.getMonth();
          if (monthIdx >= 1 && monthIdx <= 6) {
            salesByMonth[monthIdx - 1] += totalVal;
          } else {
            salesByMonth[5] += totalVal;
          }
        } else {
          salesByMonth[5] += totalVal;
        }
      });
    }

    const maxVal = Math.max(...salesByMonth, 50000) * 1.15;

    const paddingLeft = 45;
    const paddingRight = 15;
    const paddingTop = 20;
    const paddingBottom = 25;
    const chartW = 440;
    const chartH = 135;

    let points = "";
    let areaPoints = `45,${paddingTop + chartH} `;

    salesByMonth.forEach((val, index) => {
      const x = paddingLeft + (index * (chartW / (salesByMonth.length - 1)));
      const y = paddingTop + chartH - ((val / maxVal) * chartH);
      points += `${x},${y} `;
      areaPoints += `${x},${y} `;
    });
    areaPoints += `${paddingLeft + chartW},${paddingTop + chartH}`;

    let svgHtml = `
      <svg width="100%" height="100%" viewBox="0 0 500 200" style="overflow: visible;">
        <defs>
          <linearGradient id="chart-area-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--accent-color)" stop-opacity="0.25"/>
            <stop offset="100%" stop-color="var(--accent-color)" stop-opacity="0.0"/>
          </linearGradient>
        </defs>

        <!-- Grid Lines -->
        <line x1="45" y1="20" x2="485" y2="20" stroke="var(--border-color)" stroke-width="1"/>
        <line x1="45" y1="65" x2="485" y2="65" stroke="var(--border-color)" stroke-width="1"/>
        <line x1="45" y1="110" x2="485" y2="110" stroke="var(--border-color)" stroke-width="1"/>
        <line x1="45" y1="155" x2="485" y2="155" stroke="var(--border-color)" stroke-width="1"/>
        
        <!-- Y-Axis Labels -->
        <text x="35" y="24" font-size="9" fill="var(--text-muted)" text-anchor="end">${this.formatNaira(maxVal * 0.75)}</text>
        <text x="35" y="69" font-size="9" fill="var(--text-muted)" text-anchor="end">${this.formatNaira(maxVal * 0.5)}</text>
        <text x="35" y="114" font-size="9" fill="var(--text-muted)" text-anchor="end">${this.formatNaira(maxVal * 0.25)}</text>
        <text x="35" y="159" font-size="9" fill="var(--text-muted)" text-anchor="end">₦0</text>
        
        <!-- Shaded Area -->
        <polygon points="${areaPoints}" fill="url(#chart-area-grad)" />
        
        <!-- Graph Line -->
        <polyline points="${points}" fill="none" stroke="var(--accent-color)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    `;

    salesByMonth.forEach((val, index) => {
      const x = paddingLeft + (index * (chartW / (salesByMonth.length - 1)));
      const y = paddingTop + chartH - ((val / maxVal) * chartH);

      svgHtml += `
        <circle cx="${x}" cy="${y}" r="4" fill="var(--bg-secondary)" stroke="var(--accent-color)" stroke-width="2" />
        <text x="${x}" y="175" font-size="10" font-weight="600" fill="var(--text-primary)" text-anchor="middle">${months[index]}</text>
      `;
    });

    svgHtml += `</svg>`;
    this.elements.chartContainer.innerHTML = svgHtml;
  },

  renderActivityLog(orders) {
    let logHtml = "";

    if (orders.length === 0) {
      logHtml = `
        <div style="color:var(--text-secondary); text-align:center; padding: 20px 0;">
          No transactional activity logged.
        </div>
      `;
    } else {
      const recent = orders.slice(-4).reverse();

      recent.forEach(order => {
        logHtml += `
          <div style="border-bottom:1px solid var(--border-color); padding-bottom:12px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
              <strong>Order Received</strong>
              <span style="font-size:11px; color:var(--text-secondary);">${order.date}</span>
            </div>
            <div style="color:var(--text-secondary); font-size:12px;">
              Customer: ${order.customerName} placed order ${order.id} for ${this.formatNaira(order.total)}. 
              Method: ${order.method}.
            </div>
          </div>
        `;
      });
    }

    this.elements.activityContainer.innerHTML = logHtml;
  },

  // 2. INVENTORY CATALOG PANEL
  async loadInventoryData() {
    const demoIds = ["thc-001", "thc-002", "thc-003", "thc-004", "thc-005", "thc-006", "thc-007", "thc-008"];
    let products = [];
    try {
      const sb = this.getSupabase();
      if (sb) {
        const { data, error } = await sb.from('products').select('*');
        if (!error && data && data.length > 0) {
          products = data
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
      console.warn("Supabase SDK fetch in inventory panel note:", err.message);
    }

    if (products.length === 0) {
      try {
        const url = "https://xbgohwvxrvvrbjbzbwkx.supabase.co/rest/v1/products?select=*";
        const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiZ29od3Z4cnZ2cmJqYnpid2t4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5MjM3MTUsImV4cCI6MjA5OTQ5OTcxNX0.dXu3T78fRhOBx2NEN54Fp_p4Vd-5zZg3zIfbT70TrhE";
        const res = await fetch(url, {
          headers: { "apikey": key, "Authorization": "Bearer " + key }
        });
        if (res.ok) {
          const restData = await res.json();
          if (Array.isArray(restData) && restData.length > 0) {
            products = restData
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
        console.warn("Direct REST fetch in admin error:", restErr);
      }
    }

    let tableHtml = "";
    if (products.length === 0) {
      tableHtml = `<tr><td colspan="6" style="text-align:center; padding: 40px 0; color:var(--text-secondary);">No products in catalog. Click "Add New Product" to start.</td></tr>`;
    } else {
      products.forEach(p => {
        const isOutOfStock = p.stock === 0;
        const stockClass = isOutOfStock ? "out-of-stock" : "";
        const stockText = isOutOfStock ? "Sold Out" : `${p.stock} units`;

        const imgHtml = (p.image && (p.image.startsWith("http") || p.image.startsWith("assets") || p.image.startsWith("data:") || p.image.startsWith("/") || p.image.startsWith("blob:")))
          ? `<img src="${p.image}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 2px;" alt="${p.title}">`
          : this.getProductSVG(p.category, p.fallbackColor);

        tableHtml += `
          <tr>
            <td>
              <div class="table-product-thumb" style="display: flex; align-items: center; justify-content: center; overflow: hidden; background-color: var(--accent-light);">
                ${imgHtml}
              </div>
            </td>
            <td><strong>${p.title}</strong><br><span style="font-size:11px; color:var(--text-secondary);">${p.id}</span></td>
            <td>${p.category}</td>
            <td><strong>${this.formatNaira(p.price)}</strong></td>
            <td>
               <span class="${stockClass}" style="font-weight:600; color: ${isOutOfStock ? 'var(--error)' : 'var(--text-primary)'};">
                 ${stockText}
               </span>
            </td>
            <td style="text-align: right;">
              <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 11px;" onclick="AdminPortal.openEditModal('${p.id}')">Edit</button>
              <button class="btn" style="padding: 6px 12px; font-size: 11px; background-color:var(--error); border-color:var(--error);" onclick="AdminPortal.deleteProduct('${p.id}')">Delete</button>
            </td>
          </tr>
        `;
      });
    }

    this.elements.inventoryTableBody.innerHTML = tableHtml;
  },

  getProductSVG(category, color = "#3A3530") {
    if (category === "Hoodies") {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" stroke="${color}" fill="none" stroke-width="3">
        <path d="M25 35 C30 22, 70 22, 75 35 C78 50, 80 80, 75 88 L 25 88 C20 80, 22 50, 25 35 Z"/>
        <path d="M25 38 L 12 45 L 18 52 L 26 44"/>
        <path d="M75 38 L 88 45 L 82 52 L 74 44"/>
        <path d="M40 38 L 50 48 L 60 38"/>
      </svg>`;
    } else if (category === "Pants") {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" stroke="${color}" fill="none" stroke-width="3">
        <path d="M30 20 L 70 20 L 75 85 L 53 85 L 50 48 L 47 85 L 25 85 Z"/>
      </svg>`;
    } else if (category === "Tees") {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" stroke="${color}" fill="none" stroke-width="3">
        <path d="M22 25 L 38 18 L 62 18 L 78 25 L 85 42 L 72 45 L 72 85 L 28 85 L 28 45 L 15 42 Z"/>
      </svg>`;
    } else if (category === "Outerwear") {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" stroke="${color}" fill="none" stroke-width="3">
        <path d="M25 18 L 75 18 L 82 85 L 18 85 Z"/>
        <line x1="50" y1="18" x2="50" y2="85"/>
        <path d="M32 18 L 50 35 L 68 18"/>
      </svg>`;
    } else {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" stroke="${color}" fill="none" stroke-width="3">
        <rect x="25" y="30" width="50" height="40" rx="4"/>
        <path d="M35 30 C35 18, 65 18, 65 30"/>
      </svg>`;
    }
  },

  openAddModal() {
    this.elements.productForm.reset();
    this.elements.editProductId.value = "";
    this.elements.modalTitle.textContent = "Add New Product";
    this.elements.productModal.style.display = "flex";
    setTimeout(() => this.elements.productModal.classList.add("active"), 10);
  },

  async openEditModal(productId) {
    try {
      const sb = this.getSupabase();
      if (!sb) return;

      const { data: p, error } = await sb
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();

      if (error || !p) return;

      this.elements.editProductId.value = p.id;
      this.elements.productTitle.value = p.title;
      this.elements.productCategory.value = p.category;
      this.elements.productPrice.value = p.price;
      this.elements.productDescription.value = p.description;
      this.elements.productStock.value = p.stock;
      this.elements.productColor.value = p.fallback_color;
      this.elements.productSizes.value = (p.sizes || []).join(", ");

      this.elements.modalTitle.textContent = "Edit Product " + p.id;
      this.elements.productModal.style.display = "flex";
      setTimeout(() => this.elements.productModal.classList.add("active"), 10);
    } catch (err) {
      console.error("Error fetching product details:", err);
    }
  },

  closeModal() {
    this.elements.productModal.classList.remove("active");
    setTimeout(() => this.elements.productModal.style.display = "none", 300);
  },

  async handleProductSubmit(e) {
    e.preventDefault();

    const id = this.elements.editProductId.value;
    const title = this.elements.productTitle.value;
    const category = this.elements.productCategory.value;
    const price = parseInt(this.elements.productPrice.value, 10);
    const description = this.elements.productDescription.value;
    const stock = parseInt(this.elements.productStock.value, 10);
    const color = this.elements.productColor.value;
    const sizes = this.elements.productSizes.value.split(",").map(s => s.trim()).filter(s => s.length > 0);

    try {
      const sb = this.getSupabase();
      let imageUrl = "";
      if (id && sb) {
        // Fetch existing product to preserve old image if no new file is uploaded
        const { data: existingProd } = await sb.from('products').select('image').eq('id', id).single();
        if (existingProd) {
          imageUrl = existingProd.image;
        }
      } else {
        imageUrl = `assets/${category.toLowerCase()}.png`; // default fallback
      }

      // Check if a new file is selected for upload
      const fileInput = this.elements.productImageFile;
      if (fileInput && fileInput.files && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const submitBtn = this.elements.productSubmitBtn;
        const origText = submitBtn.textContent;
        submitBtn.textContent = "Uploading Image...";
        submitBtn.disabled = true;

        try {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
          const filePath = `products/${fileName}`;

          if (sb && sb.storage) {
            const { data, error: uploadError } = await sb.storage
              .from('product-images')
              .upload(filePath, file);

            if (!uploadError && data) {
              const { data: { publicUrl } } = sb.storage
                .from('product-images')
                .getPublicUrl(filePath);
              imageUrl = publicUrl;
            } else {
              console.warn("Supabase Storage upload failed or bucket missing. Converting image to DataURL fallback...");
              imageUrl = await this.readFileAsDataURL(file);
            }
          } else {
            imageUrl = await this.readFileAsDataURL(file);
          }
        } catch (storageErr) {
          console.warn("Storage exception. Converting image to DataURL fallback:", storageErr);
          imageUrl = await this.readFileAsDataURL(file);
        } finally {
          submitBtn.textContent = origText;
          submitBtn.disabled = false;
        }
      }

      const productPayload = {
        id: id || ("thc-" + Math.floor(100 + Math.random() * 900)),
        title,
        category,
        price,
        description,
        sizes,
        image: imageUrl,
        fallback_color: color,
        stock
      };

      if (sb) {
        if (id) {
          // EDIT MODE
          const { error } = await sb
            .from('products')
            .update({
              title,
              category,
              price,
              description,
              stock,
              fallback_color: color,
              sizes,
              image: imageUrl
            })
            .eq('id', id);

          if (error) throw error;
        } else {
          // ADD MODE
          const { error } = await sb
            .from('products')
            .insert([productPayload]);

          if (error) throw error;
        }
      } else {
        console.warn("Supabase client not active. Saving product locally.");
        const localProds = JSON.parse(localStorage.getItem("thc_custom_products")) || [];
        if (id) {
          const idx = localProds.findIndex(p => p.id === id);
          if (idx > -1) localProds[idx] = productPayload;
        } else {
          localProds.push(productPayload);
        }
        localStorage.setItem("thc_custom_products", JSON.stringify(localProds));
      }

      // Reset file input
      if (fileInput) fileInput.value = "";

      // Callback to main script if it's running
      if (window.StoreApp && window.StoreApp.loadProductsFromStorage) {
        await window.StoreApp.loadProductsFromStorage();
      }

      this.closeModal();
      await this.loadInventoryData();
    } catch (err) {
      console.error("Error submitting product:", err);
      alert("Error submitting product: " + err.message);
    }
  },

  async deleteProduct(productId) {
    if (confirm("Are you sure you want to delete this product?")) {
      try {
        const sb = this.getSupabase();
        if (sb) {
          const { error } = await sb
            .from('products')
            .delete()
            .eq('id', productId);

          if (error) throw error;
        }

        if (window.StoreApp && window.StoreApp.loadProductsFromStorage) {
          await window.StoreApp.loadProductsFromStorage();
        }

        await this.loadInventoryData();
      } catch (err) {
        console.error("Error deleting product:", err);
        alert("Error deleting product: " + err.message);
      }
    }
  },

  // 3. ORDERS FULFILLMENT PANEL
  async loadOrdersData() {
    const orders = await this.fetchOrders();

    let tableHtml = "";
    if (orders.length === 0) {
      tableHtml = `<tr><td colspan="8" style="text-align:center; padding: 40px 0; color:var(--text-secondary);">No orders have been placed yet.</td></tr>`;
    } else {
      const sortedOrders = [...orders].reverse();

      sortedOrders.forEach(o => {
        let itemsHtml = "";
        (o.items || []).forEach(it => {
          let imgTag = "";
          if (it.image && (it.image.startsWith("http") || it.image.startsWith("data:") || it.image.startsWith("assets") || it.image.startsWith("/") || it.image.startsWith("blob:"))) {
            imgTag = `<img src="${it.image}" style="width:44px; height:44px; object-fit:cover; border-radius:4px; border:1px solid var(--border-color); flex-shrink:0;">`;
          } else {
            imgTag = `<div style="width:44px; height:44px; border-radius:4px; background:var(--accent-light); display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:10px; font-weight:700; color:var(--text-secondary);">THC</div>`;
          }

          const sizeText = it.size || "M";
          const colorText = it.color || it.fallbackColor || it.category || "Standard";
          const priceText = this.formatNaira(it.price || 0);

          itemsHtml += `
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px; padding-bottom:8px; border-bottom:1px dashed var(--border-color);">
              ${imgTag}
              <div style="font-size:12px; line-height:1.3;">
                <div style="font-weight:600; color:var(--text-primary);">${it.title || 'Product'}</div>
                <div style="color:var(--text-secondary); font-size:11px; margin-top:2px;">
                  <span style="background:var(--accent-light); padding:2px 6px; border-radius:3px; font-weight:600;">Size: ${sizeText}</span>
                  <span style="margin-left:4px; color:var(--text-secondary);">Color/Cat: <strong>${colorText}</strong></span>
                </div>
                <div style="font-size:11px; margin-top:2px; color:var(--text-primary); font-weight:500;">
                  Qty: <strong>${it.qty || 1}</strong> &bull; ${priceText} ea
                </div>
              </div>
            </div>
          `;
        });

        let statusBadgeClass = "";
        let displayStatus = o.status;
        
        if (o.status === "Pending Payment") {
          statusBadgeClass = "pending-payment";
          displayStatus = "Unverified Transfer";
        } else if (o.status === "Paid" || o.status === "Pending") {
          statusBadgeClass = "paid";
          displayStatus = "Paid";
        } else if (o.status === "Shipped") {
          statusBadgeClass = "shipped";
          displayStatus = "Shipped";
        } else if (o.status === "Delivered") {
          statusBadgeClass = "delivered";
          displayStatus = "Delivered";
        }

        tableHtml += `
          <tr>
            <td><strong>${o.id}</strong><br><span style="font-size:11px; color:var(--text-secondary);">${o.date}</span></td>
            <td><strong>${o.customerName}</strong><br><span style="font-size:11px; color:var(--text-secondary);">${o.email}</span></td>
            <td>
              <div style="max-width:300px; min-width:220px;">
                ${itemsHtml}
              </div>
            </td>
            <td>
              <div style="max-width:240px; font-size:12px; line-height:1.4;">
                ${o.address}${o.city ? ', ' + o.city : ''}${o.state ? ', ' + o.state + ' State' : ''}<br>
                <span style="font-weight:600; color:var(--text-secondary);">Tel: ${o.phone}</span>
              </div>
            </td>
            <td style="font-size:11px; font-weight:500;">${o.method}</td>
            <td><strong>${this.formatNaira(o.total)}</strong><br><span style="font-size:10px; color:var(--text-secondary);">${(o.items || []).length} items</span></td>
            <td>
              <span class="action-badge ${statusBadgeClass}">
                ${displayStatus}
              </span>
            </td>
            <td style="text-align: right; white-space: nowrap;">
              ${o.status === "Pending Payment" ?
                `<button class="btn" style="padding: 6px 12px; font-size: 11px; background-color: #D97706; border-color: #D97706; color: white;" onclick="AdminPortal.updateOrderStatus('${o.id}', 'Paid')">Verify Payment</button>` :
                ((o.status === "Paid" || o.status === "Pending") ?
                  `<button class="btn" style="padding: 6px 12px; font-size: 11px;" onclick="AdminPortal.updateOrderStatus('${o.id}', 'Shipped')">Mark Shipped</button>` :
                  (o.status === "Shipped" ?
                    `<button class="btn" style="padding: 6px 12px; font-size: 11px; background-color:#1b8a5a; border-color:#1b8a5a;" onclick="AdminPortal.updateOrderStatus('${o.id}', 'Delivered')">Deliver</button>` :
                    `<span style="font-size:11px; color:var(--success); font-weight:600;">Completed</span>`
                  )
                )
              }
              <button class="btn" style="padding: 6px 10px; font-size: 11px; background-color: #EF4444; border-color: #EF4444; color: white; margin-left: 6px;" onclick="AdminPortal.deleteOrder('${o.id}')" title="Delete Order">Delete</button>
            </td>
          </tr>
        `;
      });
    }

    this.elements.ordersTableBody.innerHTML = tableHtml;
  },

  async updateOrderStatus(orderId, newStatus) {
    let updatedInCloud = false;
    try {
      const sb = this.getSupabase();
      if (sb) {
        const { error } = await sb
          .from('orders')
          .update({ payment_status: newStatus })
          .eq('id', orderId);

        if (!error) updatedInCloud = true;
      }
    } catch (err) {
      console.warn("SDK order status update warning:", err);
    }

    if (!updatedInCloud) {
      try {
        const url = `https://xbgohwvxrvvrbjbzbwkx.supabase.co/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}`;
        const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiZ29od3Z4cnZ2cmJqYnpid2t4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5MjM3MTUsImV4cCI6MjA5OTQ5OTcxNX0.dXu3T78fRhOBx2NEN54Fp_p4Vd-5zZg3zIfbT70TrhE";
        await fetch(url, {
          method: "PATCH",
          headers: {
            "apikey": key,
            "Authorization": "Bearer " + key,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ payment_status: newStatus })
        });
      } catch (restErr) {
        console.warn("Direct REST order status update error:", restErr);
      }
    }

    // Always update local storage state as well
    try {
      const localOrders = JSON.parse(localStorage.getItem("thc_orders")) || [];
      const order = localOrders.find(o => o.id === orderId);
      if (order) {
        order.payment_status = newStatus;
        order.status = newStatus;
        localStorage.setItem("thc_orders", JSON.stringify(localOrders));
      }
    } catch (e) {}

    await this.loadOrdersData();
  },

  async deleteOrder(orderId) {
    if (!confirm("Are you sure you want to delete this order from fulfillment?")) return;

    try {
      const sb = this.getSupabase();
      if (sb) {
        await sb.from('orders').delete().eq('id', orderId);
      }
    } catch (err) {
      console.warn("Supabase SDK order delete note:", err);
    }

    try {
      const url = `https://xbgohwvxrvvrbjbzbwkx.supabase.co/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}`;
      const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiZ29od3Z4cnZ2cmJqYnpid2t4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5MjM3MTUsImV4cCI6MjA5OTQ5OTcxNX0.dXu3T78fRhOBx2NEN54Fp_p4Vd-5zZg3zIfbT70TrhE";
      await fetch(url, {
        method: "DELETE",
        headers: { "apikey": key, "Authorization": "Bearer " + key }
      });
    } catch (e) {}

    try {
      let localOrders = JSON.parse(localStorage.getItem("thc_orders")) || [];
      localOrders = localOrders.filter(o => o.id !== orderId);
      localStorage.setItem("thc_orders", JSON.stringify(localOrders));
    } catch (e) {}

    await this.loadOrdersData();
    await this.loadDashboardData();
  }
};

// Expose globally so inline onclick events can trigger it
window.AdminPortal = AdminPortal;

// Resilient Initialization for Netlify & Async Scripts
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => AdminPortal.init());
} else {
  AdminPortal.init();
}
