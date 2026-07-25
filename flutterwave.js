// TRENDHIGHCLOTHING - Client-side Flutterwave Secure Integration Service
// Communicates with backend /api/flutterwave/* endpoints to ensure secret keys are NEVER exposed to browser dev tools.

(function () {
  const isFileProtocol = window.location.protocol === "file:";

  var FlutterwaveService = {
    publicKey: "",

    /**
     * Fetches the Flutterwave Public Key securely from the backend configuration endpoint
     * @returns {Promise<string>} Public Key string
     */
    async getPublicKey() {
      if (this.publicKey) return this.publicKey;
      if (isFileProtocol) {
        console.warn("[FlutterwaveService] Running via file:// protocol. Local API endpoints are disabled. Please run server via 'node server.js'.");
        return "";
      }

      try {
        const res = await fetch("/api/config/public-key");
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const data = await res.json();
        this.publicKey = data.publicKey || "";
        return this.publicKey;
      } catch (e) {
        console.warn("[FlutterwaveService] Could not fetch public key from server:", e.message);
        return "";
      }
    },

    /**
     * Initializes payment securely through server endpoint or Flutterwave Inline Checkout
     * @param {Object} params
     * @param {number} params.amount - Order amount in NGN
     * @param {string} params.email - Customer email address
     * @param {string} [params.name] - Customer full name
     * @param {string} [params.phone] - Customer phone number
     * @param {Function} [params.onSuccess] - Success callback receiving payment details
     * @param {Function} [params.onCancel] - Cancellation / Failure callback
     */
    /**
     * Initializes payment securely through server endpoint or Flutterwave Inline Checkout
     * @param {Object} params
     * @param {number} params.amount - Order total amount in NGN (subtotal + shipping)
     * @param {number} [params.subtotal] - Order subtotal in NGN
     * @param {number} [params.shipping] - Shipping fee in NGN
     * @param {string} params.email - Customer email address
     * @param {string} [params.name] - Customer full name
     * @param {string} [params.phone] - Customer phone number
     * @param {Function} [params.onSuccess] - Success callback receiving payment details
     * @param {Function} [params.onCancel] - Cancellation / Failure callback
     */
    async processPayment({ amount, subtotal, shipping, email, name, phone, onSuccess, onCancel }) {
      if (!amount || amount <= 0) {
        alert("Invalid payment amount.");
        if (onCancel) onCancel();
        return;
      }

      if (!email) {
        alert("Please provide a valid email address for checkout.");
        if (onCancel) onCancel();
        return;
      }

      const tx_ref = "THC-FLW-" + Date.now() + "-" + Math.floor(Math.random() * 10000);
      const pubKey = await this.getPublicKey();
      
      const subtotalVal = subtotal || amount;
      const shippingVal = shipping || 0;
      const paymentDescription = `Order Payment (Subtotal: ₦${Number(subtotalVal).toLocaleString()} + Shipping: ₦${Number(shippingVal).toLocaleString()})`;

      // 1. Inline checkout if Flutterwave JS SDK is loaded and public key is configured
      if (typeof window.FlutterwaveCheckout === "function" && pubKey && !pubKey.includes("xxxxxxxx")) {
        window.FlutterwaveCheckout({
          public_key: pubKey,
          tx_ref: tx_ref,
          amount: amount,
          currency: "NGN",
          payment_options: "card, mobilemoney, ussd, banktransfer",
          customer: {
            email: email,
            phone_number: phone || "",
            name: name || "Customer"
          },
          meta: {
            subtotal: subtotalVal,
            shipping: shippingVal
          },
          customizations: {
            title: "TRENDHIGH CLOTHING",
            description: paymentDescription,
            logo: window.location.origin + "/logo.png"
          },
          callback: async function (data) {
            console.log("[Flutterwave Inline Callback]:", data);
            if (window.StoreApp && window.StoreApp.showPaymentConfirmationOverlay) {
              window.StoreApp.showPaymentConfirmationOverlay("Confirming payment automatically with Flutterwave...");
            }
            
            const verification = await window.FlutterwaveService.verifyTransaction(data.transaction_id, tx_ref);
            
            if (window.StoreApp && window.StoreApp.hidePaymentConfirmationOverlay) {
              window.StoreApp.hidePaymentConfirmationOverlay();
            }

            if (verification.success) {
              if (onSuccess) onSuccess(verification.data);
            } else {
              alert("Payment verification failed: " + (verification.message || "Invalid transaction"));
              if (onCancel) onCancel();
            }
          },
          onclose: function () {
            console.log("[Flutterwave] Payment modal closed by user");
            if (onCancel) onCancel();
          }
        });
        return;
      }

      // Warn if opening directly via file://
      if (isFileProtocol) {
        alert("⚠️ Local Server Notice:\n\nYou are opening this page directly from your filesystem (file://).\n\nPlease start the local server by running 'node server.js' in terminal and open http://localhost:8080");
        if (onCancel) onCancel();
        return;
      }

      // 2. Server-side hosted redirect payment link initialization
      try {
        const response = await fetch("/api/flutterwave/initialize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: amount,
            subtotal: subtotalVal,
            shipping: shippingVal,
            email: email,
            name: name,
            phone_number: phone,
            tx_ref: tx_ref,
            description: paymentDescription,
            redirect_url: `${window.location.origin}/index.html?payment_callback=1&tx_ref=${tx_ref}`
          })
        });

        const result = await response.json();

        if (response.ok && result.status === "success" && result.data && result.data.link) {
          // Securely redirect to Flutterwave hosted checkout link
          window.location.href = result.data.link;
        } else {
          const errorMsg = result.message || (result.data ? result.data.message : "Failed to initialize Flutterwave payment.");

          if (errorMsg.includes("Secret Key is not configured") || errorMsg.includes("FLWSECK")) {
            alert("🔑 Flutterwave Setup Required:\n\n" + errorMsg + "\n\nPlease add your API keys to your server .env file.");
          } else {
            alert("Flutterwave Payment Error: " + errorMsg);
          }

          if (onCancel) onCancel();
        }
      } catch (err) {
        console.error("[Flutterwave Integration Error]:", err);
        alert("Network error connecting to payment gateway: " + err.message);
        if (onCancel) onCancel();
      }
    },

    /**
     * Verifies payment via backend server endpoint
     * @param {string|number} transaction_id - Flutterwave Transaction ID
     * @param {string} tx_ref - Unique merchant transaction reference
     * @returns {Promise<Object>} Verification status object
     */
    async verifyTransaction(transaction_id, tx_ref) {
      if (isFileProtocol) {
        return { success: false, message: "Server endpoint not available in file:// mode" };
      }

      try {
        const url = `/api/flutterwave/verify?transaction_id=${encodeURIComponent(transaction_id || "")}&tx_ref=${encodeURIComponent(tx_ref || "")}`;
        const res = await fetch(url);
        const resData = await res.json();

        if (res.ok && resData.status === "success" && resData.data && resData.data.status === "successful") {
          return {
            success: true,
            data: {
              reference: resData.data.tx_ref || tx_ref,
              flw_id: resData.data.id,
              amount: resData.data.amount,
              method: resData.data.payment_type || "Flutterwave",
              status: "Paid",
              date: resData.data.created_at || new Date().toLocaleString("en-NG")
            }
          };
        } else {
          return {
            success: false,
            message: resData.message || (resData.data ? resData.data.processor_response : "Transaction failed or unverified")
          };
        }
      } catch (e) {
        return { success: false, message: e.message };
      }
    },

    /**
     * Automatically handles redirect callbacks from Flutterwave if returning to index.html
     * @param {Function} onSuccessCallback - Function to execute when payment is verified
     */
    async checkUrlCallback(onSuccessCallback) {
      const urlParams = new URLSearchParams(window.location.search);
      const status = urlParams.get("status");
      const tx_ref = urlParams.get("tx_ref");
      const transaction_id = urlParams.get("transaction_id");

      if ((status === "successful" || status === "completed" || urlParams.get("payment_callback")) && (transaction_id || tx_ref)) {
        // Remove query parameters from URL to clean browser history
        window.history.replaceState({}, document.title, window.location.pathname);

        if (window.StoreApp && window.StoreApp.showPaymentConfirmationOverlay) {
          window.StoreApp.showPaymentConfirmationOverlay("Confirming payment automatically with Flutterwave...");
        }

        const verification = await this.verifyTransaction(transaction_id, tx_ref);

        if (window.StoreApp && window.StoreApp.hidePaymentConfirmationOverlay) {
          window.StoreApp.hidePaymentConfirmationOverlay();
        }

        if (verification.success && onSuccessCallback) {
          onSuccessCallback(verification.data);
        } else if (!verification.success) {
          alert("Payment Verification Failed: " + (verification.message || "Transaction could not be confirmed."));
        }
      }
    }
  };

  window.FlutterwaveService = FlutterwaveService;
})();
