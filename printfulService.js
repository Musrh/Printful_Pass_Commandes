const response = await fetch(PRINTFUL_URL, {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${PRINTFUL_API_KEY}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    recipient: {
      name: bodyOrder.nomClient || bodyOrder.email,
      address1: bodyOrder.adresseLivraison || "Default Address",
      city: bodyOrder.ville || "Default City",
      country_code: bodyOrder.pays || "FR",
      zip: bodyOrder.codePostal || "00000",
    },
    items: bodyOrder.items.map(i => ({
      variant_id: Number(i.id), // 👈 on force number
      quantity: Number(i.quantity),
    })),
  }),
});

const data = await response.json();

console.log("📦 Réponse Printful :", JSON.stringify(data, null, 2));

if (!response.ok) {
  console.error("❌ Erreur Printful :", data);
  return res.status(400).json({
    success: false,
    message: data?.error?.message || JSON.stringify(data),
  });
}
