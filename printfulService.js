// printfulService.js
import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(express.json());

const PRINTFUL_API_KEY = process.env.PRINTFUL_API_KEY;
const PRINTFUL_URL = "https://api.printful.com/orders";

// Endpoint pour créer une commande Printful
app.post("/create-order", async (req, res) => {
  const { order } = req.body; // order doit contenir: nomClient, adresse, ville, pays, codePostal, items

  try {
    const body = {
      recipient: {
        name: order.nomClient,
        address1: order.adresse,
        city: order.ville,
        country_code: order.pays,
        zip: order.codePostal
      },
      items: order.items.map(i => ({
        variant_id: i.variant_id,
        quantity: i.quantity,
        name: i.nom
      }))
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
    if (!response.ok) throw new Error(data?.error?.message || "Erreur Printful");

    res.json({ success: true, data });
  } catch (err) {
    console.error("❌ Printful order failed:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Printful service running on port ${PORT}`));
