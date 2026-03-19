// 🔹 Construire les items avec vrai variant_id
const finalItems = [];

for (const item of bodyOrder.items) {

  // 🔎 Chercher le produit dans Firestore
  const productRef = await db
    .collection("PrintfulProducts")
    .doc(String(item.id))
    .get();

  if (!productRef.exists) {
    throw new Error(`Produit ${item.id} introuvable dans PrintfulProducts`);
  }

  const productData = productRef.data();

  // 🔎 Trouver le bon variant
  const variant = productData.variants.find(
    v =>
      v.size === item.taille &&
      v.color === item.couleur
  );

  if (!variant) {
    throw new Error(
      `Variant introuvable pour ${item.nom} (${item.couleur} / ${item.taille})`
    );
  }

  console.log(
    `✅ Variant trouvé pour ${item.nom}:`,
    variant.id
  );

  finalItems.push({
    variant_id: Number(variant.id),
    quantity: Number(item.quantity),
  });
}
