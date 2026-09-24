export const EMPTY_EQUIPMENT = Object.freeze({
    tunic: null,
    pants: null,
    boots: null,
    hat: null,
    hair: null,
    pet: null,
    aura: null,
    background: null
});

export function equipmentSlot(category) {
    return ({
        tunic: "tunic",
        tunics: "tunic",
        pants: "pants",
        boot: "boots",
        boots: "boots",
        hat: "hat",
        hats: "hat",
        hair: "hair",
        hairstyle: "hair",
        hairstyles: "hair",
        pet: "pet",
        pets: "pet",
        aura: "aura",
        auras: "aura",
        background: "background",
        backgrounds: "background"
    })[category] ?? null;
}

export function buildInventory(ownedItems, catalogById, storedEquipment = {}) {
    const equipped = { ...EMPTY_EQUIPMENT };
    for (const slot of Object.keys(equipped)) {
        equipped[slot] = storedEquipment[slot] ?? null;
    }

    const items = ownedItems.map((owned) => {
        const catalog = catalogById.get(owned.itemId);
        const category = catalog?.category ?? owned.category ?? "unknown";
        const slot = equipmentSlot(category);
        return {
            itemId: owned.itemId,
            name: catalog?.name ?? owned.name ?? owned.itemId,
            category,
            assetKey: catalog?.assetKey ?? owned.assetKey ?? null,
            purchasedAt: owned.purchasedAt ?? null,
            purchasePrice: Number(owned.purchasePrice ?? 0),
            equipped: slot ? equipped[slot] === owned.itemId : false
        };
    });

    return { equipped, items };
}
