# TRENDHIGHCLOTHING

> **IT'S U AGAINST THE WORLD.**  
> *Defining your own path in luxury editorial streetwear.*

---

## 🖤 Overview

**TRENDHIGHCLOTHING** is an ultra-fast, luxury editorial boutique and e-commerce web application. Built with high performance, smooth aesthetics, and real-time data synchronization, the platform provides a seamless shopping experience for customers and a back-office administration suite for catalog management and order fulfillment.

---

## ✨ Features

- **⚡ Ultra-Fast 0ms Loading (Stale-While-Revalidate)**: Instant storefront rendering from local cache upon page load, accompanied by non-blocking background database revalidation.
- **📸 High-Performance Product Uploads**:
  - **Optimistic UI Updates**: Newly created products show up instantly (<10ms) across the store grid and admin inventory before cloud uploads complete.
  - **Client-Side Image Compression**: Automatic canvas image scaling (max 1000px, WebP/JPEG) reduces 5-10MB camera uploads to ~50–100KB for rapid processing.
- **🔄 Real-Time Multi-Device & Cross-Tab Synchronization**: Powered by **Web BroadcastChannel** and **Supabase Realtime Postgres Subscriptions** to broadcast live inventory updates across open tabs and devices without refreshing.
- **💳 Flutterwave Gateway Integration**:
  - Card, Bank Transfer, USSD, and Mobile Money payments.
  - Automatic 256-bit encrypted transaction verification and redirect callbacks.
- **💼 Administrative Back-Office Portal**:
  - Real-time revenue charts and average order metrics.
  - Complete product CRUD (Add, Edit, Delete with image uploads).
  - Order fulfillment workflow (Verify Payment, Mark Shipped, Deliver).
- **🎨 Premium Editorial Aesthetics**: Modern dark mode UI, custom typography, smooth micro-animations, and GPU-accelerated layout transitions.

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | HTML5, Vanilla JavaScript (ES6+), Vanilla CSS (Design Tokens, Glassmorphism) |
| **Backend & DB** | Supabase (Postgres Database, Storage, Auth, Realtime) |
| **Payments** | Flutterwave v3 Checkout API |
| **Assets & Icons** | Inline SVG Vector System & HTML5 Canvas Processing |

---

## 📁 Repository Structure

```text
Trendhighclothing/
├── index.html          # Main storefront, checkout, and admin SPA layout
├── styles.css          # Core design system & responsive layout styles
├── app.js              # Front-end controller, state management, & real-time sync
├── admin.js            # Back-office admin dashboard & inventory management
├── flutterwave.js      # Payment gateway initialization & callback handlers
├── supabase-config.js  # Supabase client initialization & credentials
├── products.js         # Fallback product configuration
├── server.js           # Lightweight local Node.js development server
├── logo.png            # Brand mark assets
└── background.jpeg     # Editorial hero background asset
```

---

## 🚀 Getting Started

### Prerequisites
- Modern web browser (Chrome, Safari, Firefox, Edge)
- Optional: [Node.js](https://nodejs.org/) (v16+) for local server hosting

### Running Locally

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Lolypeezle/Trendhighclothing1.git
   cd Trendhighclothing1
   ```

2. **Serve the project**:
   - **Option A (Node Server)**:
     ```bash
     node server.js
     ```
     Access the site at `http://localhost:3000`.

   - **Option B (VS Code Live Server / Static Hosting)**:
     Open `index.html` with any static web server or live server extension.

---

## ⚙️ Configuration

Environment credentials for Supabase and Flutterwave are configured in `supabase-config.js` and `flutterwave.js`:

```javascript
// Supabase Configuration
const SUPABASE_URL = "https://xbgohwvxrvvrbjbzbwkx.supabase.co";
const SUPABASE_KEY = "YOUR_SUPABASE_ANON_KEY";
```

---

## 📜 License

Distributed under the **MIT License**. See `LICENSE` for more information.

Developed for **TRENDHIGHCLOTHING**.
