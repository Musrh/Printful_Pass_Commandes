import express from "express";
import fetch from "node-fetch";
import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(express.json());

const PRINTFUL_API_KEY = process.env.PRINTFUL_API_KEY;
const PRINTFUL_URL = "https://api.printful.com/orders";

// 🔹 Firebase admin
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// 🔹 Route pour envoyer une commande Firestore à Printful
app.post("/admin/send-to-printful/:orderId", async (req, res) => {
  const { orderId } = req.params;
  const bodyOrder = req.body;

  if (!bodyOrder || !bodyOrder.items || bodyOrder.items.length === 0) {
    return res.status(400).json({ success: false, message: "Données invalides" });
  }

  try {
    // 🔹 Vérifier / transformer id en variant_id pour chaque produit
    const itemsForPrintful = bodyOrder.items.map(i => ({
      variant_id: i.id, // ici on prend id et on renomme variant_id
      quantity: i.quantity,
    }));

    console.log(`📝 Variant IDs pour envoi : ${itemsForPrintful.map(i => i.variant_id).join(", ")}`);

    const response = await fetch(PRINTFUL_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${PRINTFUL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient: {
          name: bodyOrder.nomClient || bodyOrder.email,
          address1: bodyOrder.adresse || "",
          city: bodyOrder.ville || "",
          country_code: bodyOrder.pays || "FR",
          zip: bodyOrder.codePostal || "",
        },
        items: itemsForPrintful,
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || "Erreur Printful");

    // 🔹 Mettre à jour Firestore pour marquer commande envoyée
    await db.collection("commandes").doc(orderId).update({ envoyePrintful: true });

    console.log(`✅ Commande ${orderId} envoyée à Printful avec succès. Printful order ID: ${data?.result?.id}`);

    res.json({
      success: true,
      message: `Commande ${orderId} envoyée à Printful ✅`,
      printfulOrderId: data?.result?.id,
      items: itemsForPrintful, // pour afficher les variant_id côté front
    });
  } catch (err) {
    console.error(`❌ Erreur Printful pour commande ${orderId}:`, err);
    res.status(500).json({ success: false, message: err.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Printful service running on port ${PORT}`));
