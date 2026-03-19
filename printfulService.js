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
  const bodyOrder = req.body; // données du front-end

  if (!bodyOrder || !bodyOrder.items) {
    return res.status(400).json({ success: false, message: "Données invalides" });
  }

  try {
    // 🔹 Charger les produits Printful depuis Firestore
    const productIds = bodyOrder.items.map(i => i.id);
    const productsSnap = await db
      .collection("PrintfulProducts")
      .where("id", "in", productIds)
      .get();

    const printfulProducts = productsSnap.docs.map(d => d.data());

    // 🔹 Construire items avec variant_id correct
    const itemsForPrintful = bodyOrder.items.map(i => {
      const product = printfulProducts.find(p => p.id === i.id);
      if (!product) throw new Error(`Produit introuvable: ${i.nom}`);

      const variant = product.variants.find(
        v => v.size === i.taille && v.color === i.couleur
      );
      if (!variant)
        throw new Error(
          `Variant non trouvé pour ${i.nom} ${i.couleur}/${i.taille}`
        );

      return {
        variant_id: variant.id,
        quantity: i.quantity,
      };
    });

    // 🔹 Envoyer à Printful
    const response = await fetch(PRINTFUL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PRINTFUL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient: {
          name: bodyOrder.nomClient || bodyOrder.email,
          address1: bodyOrder.adresseLivraison,
          city: bodyOrder.ville,
          country_code: bodyOrder.pays,
          zip: bodyOrder.codePostal,
        },
        items: itemsForPrintful,
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || "Erreur Printful");

    // 🔹 Marquer commande envoyée
    await db.collection("commandes").doc(orderId).update({ envoyePrintful: true });

    res.json({ success: true, message: "Commande envoyée à Printful", data });
  } catch (err) {
    console.error("❌ Erreur Printful:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () =>
  console.log(`🚀 Printful service running on port ${PORT}`)
);
