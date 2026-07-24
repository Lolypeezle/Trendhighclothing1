// TRENDHIGHCLOTHING - Client-side Flutterwave Secure Integration Service
// Communicates with backend /api/flutterwave/* endpoints to ensure secret keys are NEVER exposed to browser dev tools.

const FlutterwaveService = {
  publicKey: "",

  async getPublicKey() {
    if (this.publicKey) return this.publicKey;
    try {
      const res = await fetch("/api/config/public-key");
      const data = await res.json();
      this.publicKey = data.publicKey || "";
      return this.publicKey;
    } catch (e) {
      console.warn("Could not fetch Flutterwave public key:", e);
      return "";
    }
  },

  /**
   * Initializes payment securely through server endpoint
   */
  async processPayment({ amount, email, name, phone, onSuccess, onCancel }) {
    const tx_ref = "THC-FLW-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
    const pubKey = await this.getPublicKey();

    // 1. Try inline checkout if Flutterwave JS SDK is loaded and public key is available
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
        customizations: {
          title: "TRENDHIGH CLOTHING",
          description: "Order Checkout Payment",
          logo: window.location.origin + "/logo.png"
        },
        callback: async function (data) {
          console.log("[Flutterwave Inline Callback]:", data);
          // Always verify server-side to prevent client tampering!
          const verification = await FlutterwaveService.verifyTransaction(data.transaction_id, tx_ref);
          if (verification.success) {
            if (onSuccess) onSuccess(verification.data);
          } else {
            alert("Payment verification failed: " + (verification.message || "Invalid transaction"));
            if (onCancel) onCancel();
          }
        },
        onclose: function () {
          console.log("Flutterwave payment modal closed");
          if (onCancel) onCancel();
        }
      });
      return;
    }

    // 2. Server-side redirect payment link initialization
    try {
      const response = await fetch("/api/flutterwave/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amount,
          email: email,
          name: name,
          phone_number: phone,
          tx_ref: tx_ref,
          redirect_url: window.location.origin + "/index.html?payment_callback=1&tx_ref=" + tx_ref
        })
      });

      const result = await response.json();

      if (response.ok && result.status === "success" && result.data && result.data.link) {
        // Securely redirect to Flutterwave hosted checkout link
        window.location.href = result.data.link;
      } else {
        const errorMsg = result.message || (result.data ? result.data.message : "Failed to initialize Flutterwave payment.");
        
        // Check if placeholder key notice
        if (errorMsg.includes("Secret Key is not configured") || errorMsg.includes("FLWSECK")) {
          alert("🔑 Flutterwave API Setup Notice:\n\n" + errorMsg + "\n\nPlease add your live or test keys to your .env file.");
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
   */
  async verifyTransaction(transaction_id, tx_ref) {
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
   */
  async checkUrlCallback(onSuccessCallback) {
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get("status");
    const tx_ref = urlParams.get("tx_ref");
    const transaction_id = urlParams.get("transaction_id");

    if ((status === "successful" || status === "completed" || urlParams.get("payment_callback")) && (transaction_id || tx_ref)) {
      // Remove query parameters from URL clean history
      window.history.replaceState({}, document.title, window.location.pathname);

      const verification = await this.verifyTransaction(transaction_id, tx_ref);
      if (verification.success && onSuccessCallback) {
        onSuccessCallback(verification.data);
      } else if (!verification.success) {
        alert("Payment Verification Failed: " + (verification.message || "Transaction could not be confirmed."));
      }
    }
  }
};

window.FlutterwaveService = FlutterwaveService;
