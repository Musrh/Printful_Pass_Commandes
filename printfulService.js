import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();
const app = express();

app.use(cors({
  origin: "https://wellshoppings.com",
  methods: ["POST", "GET"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json());

// 🔥 Firebase
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const PRINTFUL_API_KEY = process.env.PRINTFUL_API_KEY;
const PRINTFUL_URL = "https://api.printful.com/orders";

// ✅ Route Admin
app.post("/admin/send-to-printful/:orderId", async (req, res) => {
  const { orderId } = req.params;

  try {
    const docRef = db.collection("commandes").doc(orderId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return res.status(404).json({ error: "Commande introuvable" });
    }

    const order = docSnap.data();

    if (order.envoye_printful) {
      return res.json({ message: "Déjà envoyée à Printful" });
    }

    // 🔄 Construire items Printful
    const items = order.items.map(item => ({
      variant_id: item.variant_id || item.id,
      quantity: item.quantity
    }));

    const body = {
      recipient: {
        name: order.email,
        address1: order.adresseLivraison,
        city: "",
        country_code: "FR",
        zip: ""
      },
      items
    };

    const response = await fetch(PRINTFUL_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${PRINTFUL_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Printful error:", data);
      return res.status(500).json({ error: data });
    }

    await docRef.update({
      envoye_printful: true,
      printful_order_id: data.result.id
    });

    console.log("✅ Commande envoyée à Printful");

    res.json({ success: true });

  } catch (err) {
    console.error("❌ Erreur:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/", (req, res) => {
  res.send("🚀 Printful service running");
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () =>
  console.log(`🚀 Printful service running on port ${PORT}`)
);
