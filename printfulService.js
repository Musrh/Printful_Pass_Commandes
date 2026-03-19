import express from "express";
import fetch from "node-fetch";
import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(express.json());

// 🔹 Firebase
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// 🔹 Fonction pour transformer id → variant_id
function transformItemsForPrintful(items) {
  return items.map(i => ({
    variant_id: i.id, // id stocké dans Firestore devient variant_id pour Printful
    quantity: i.quantity,
    name: i.nom
  }));
}

// 🔹 Route admin pour envoyer commande à Printful
app.post("/admin/send-to-printful/:orderId", async (req, res) => {
  const { orderId } = req.params;

  try {
    const orderSnap = await db.collection("commandes").doc(orderId).get();
    if (!orderSnap.exists) return res.status(404).json({ message: "Commande non trouvée" });

    const order = orderSnap.data();

    if (!order.items || order.items.length === 0) {
      return res.status(400).json({ message: "Aucun produit dans la commande" });
    }

    // Transformation id → variant_id
    const printfulItems = transformItemsForPrintful(order.items);

    const body = {
      recipient: {
        name: order.email || "Client",
        address1: order.adresseLivraison || "",
        city: order.city || "",
        country_code: order.pays || "FR",
        zip: order.zip || ""
      },
      items: printfulItems
    };

    // Envoi à Printful
    const response = await fetch("https://api.printful.com/orders", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.PRINTFUL_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) throw new Error(data?.error?.message || "Erreur Printful");

    // Marquer commande comme envoyée
    await db.collection("commandes").doc(orderId).update({ envoyePrintful: true });

    console.log("✅ Commande envoyée à Printful:", data);
    res.json({ success: true, data });
  } catch (err) {
    console.error("❌ Envoi Printful failed:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Printful service running on port ${PORT}`));
