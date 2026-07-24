// TRENDHIGHCLOTHING - Administrative Back-Office Controller

const AdminPortal = {
  activePanel: "admin-overview",


  elements: {},

  init() {
    this.cacheElements();
    this.bindEvents();
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
          await supabase.auth.signOut();
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


  async loadDashboardData() {
    let orders = [];
    try {
      const { data, error } = await supabase.from('orders').select('*');
      if (!error && data) {
        orders = data.map(o => ({
          id: o.id,
          date: o.created_at ? new Date(o.created_at).toLocaleString("en-NG") : "N/A",
          method: o.payment_method || "N/A",
          customerName: o.customer_name,
          email: o.email,
          phone: o.phone,
          address: o.shipping_address,
          city: o.city,
          state: o.state,
          items: o.items || [],
          total: Number(o.total),
          status: o.payment_status || "Pending"
        }));
      }
    } catch (err) {
      console.error("Error fetching orders for dashboard:", err);
    }

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
    let salesByMonth = [340000, 480000, 410000, 620000, 750000, 0];

    let liveJulySales = 0;
    orders.forEach(order => {
      liveJulySales += order.total;
    });
    salesByMonth[5] = liveJulySales > 0 ? liveJulySales : 120000; 

    const maxVal = Math.max(...salesByMonth) * 1.15;

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
    let products = [];
    try {
      const { data, error } = await supabase.from('products').select('*');
      if (!error && data) {
        products = data.map(p => ({
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
    } catch (err) {
      console.error("Error loading products from Supabase:", err);
    }

    let tableHtml = "";
    if (products.length === 0) {
      tableHtml = `<tr><td colspan="6" style="text-align:center; padding: 40px 0; color:var(--text-secondary);">No products in catalog. Click "Add New Product" to start.</td></tr>`;
    } else {
      products.forEach(p => {
        const isOutOfStock = p.stock === 0;
        const stockClass = isOutOfStock ? "out-of-stock" : "";
        const stockText = isOutOfStock ? "Sold Out" : `${p.stock} units`;

        const imgHtml = (p.image && (p.image.startsWith("http") || p.image.startsWith("assets")))
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
      const { data: p, error } = await supabase
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
      let imageUrl = "";
      if (id) {
        // Fetch existing product to preserve old image if no new file is uploaded
        const { data: existingProd } = await supabase.from('products').select('image').eq('id', id).single();
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
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
        const filePath = `products/${fileName}`;

        const submitBtn = this.elements.productSubmitBtn;
        const origText = submitBtn.textContent;
        submitBtn.textContent = "Uploading Image...";
        submitBtn.disabled = true;

        const { data, error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(filePath, file);

        if (uploadError) {
          submitBtn.textContent = origText;
          submitBtn.disabled = false;
          throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(filePath);

        imageUrl = publicUrl;
        submitBtn.textContent = origText;
        submitBtn.disabled = false;
      }

      if (id) {
        // EDIT MODE
        const { error } = await supabase
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
        const newId = "thc-" + Math.floor(100 + Math.random() * 900);
        const { error } = await supabase
          .from('products')
          .insert([{
            id: newId,
            title,
            category,
            price,
            description,
            sizes,
            image: imageUrl,
            fallback_color: color,
            stock
          }]);

        if (error) throw error;
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
        const { error } = await supabase
          .from('products')
          .delete()
          .eq('id', productId);

        if (error) throw error;

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
    let orders = [];
    try {
      const { data, error } = await supabase.from('orders').select('*');
      if (!error && data) {
        orders = data.map(o => ({
          id: o.id,
          date: o.created_at ? new Date(o.created_at).toLocaleString("en-NG") : "N/A",
          method: o.payment_method || "N/A",
          customerName: o.customer_name,
          email: o.email,
          phone: o.phone,
          address: o.shipping_address,
          city: o.city,
          state: o.state,
          items: o.items || [],
          total: Number(o.total),
          status: o.payment_status || "Pending"
        }));
      }
    } catch (err) {
      console.error("Error loading orders from Supabase:", err);
    }

    let tableHtml = "";
    if (orders.length === 0) {
      tableHtml = `<tr><td colspan="7" style="text-align:center; padding: 40px 0; color:var(--text-secondary);">No orders have been placed yet.</td></tr>`;
    } else {
      const sortedOrders = [...orders].reverse();

      sortedOrders.forEach(o => {
        let itemsSummary = "";
        o.items.forEach(it => {
          itemsSummary += `<div style="font-size:11px; margin-bottom:2px;">• ${it.title} (x${it.qty}) - Size: ${it.size}</div>`;
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
              <div style="max-width:240px; font-size:12px; line-height:1.4;">
                ${o.address}, ${o.city}, ${o.state} State<br>
                <span style="font-weight:600; color:var(--text-secondary);">Tel: ${o.phone}</span>
              </div>
            </td>
            <td style="font-size:11px; font-weight:500;">${o.method}</td>
            <td><strong>${this.formatNaira(o.total)}</strong><br><span style="font-size:10px; color:var(--text-secondary);">${o.items.length} items</span></td>
            <td>
              <span class="action-badge ${statusBadgeClass}">
                ${displayStatus}
              </span>
            </td>
            <td style="text-align: right;">
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
            </td>
          </tr>
        `;
      });
    }

    this.elements.ordersTableBody.innerHTML = tableHtml;
  },

  async updateOrderStatus(orderId, newStatus) {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ payment_status: newStatus })
        .eq('id', orderId);

      if (error) throw error;
      await this.loadOrdersData();
    } catch (err) {
      console.error("Error updating order status:", err);
      alert("Error updating status: " + err.message);
    }
  }
};

// Expose globally so inline onclick events can trigger it
window.AdminPortal = AdminPortal;

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  AdminPortal.init();
});
