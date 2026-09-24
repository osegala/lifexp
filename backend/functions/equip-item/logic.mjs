export class EquipError extends Error {
    constructor(statusCode, code, message) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
    }
}

export function equipmentSlot(category) {
    return ({ tunic: "tunic", tunics: "tunic", pants: "pants", boot: "boots", boots: "boots",
        hat: "hat", hats: "hat", hair: "hair", hairstyle: "hair", hairstyles: "hair",
        pet: "pet", pets: "pet", aura: "aura", auras: "aura",
        background: "background", backgrounds: "background" })[category] ?? null;
}

export function planEquip(owned, catalog, equipment = {}) {
    if (!owned) throw new EquipError(403, "ITEM_NOT_OWNED", "You do not own this item.");
    if (!catalog) throw new EquipError(404, "ITEM_NOT_FOUND", "Cosmetic catalog item not found.");
    if (catalog.active === false) throw new EquipError(400, "ITEM_LOCKED", "This item is not currently available.");
    const slot = equipmentSlot(catalog.category);
    if (!slot) throw new EquipError(400, "VALIDATION_ERROR", "This cosmetic cannot be equipped.");
    return { slot, equipment: { ...equipment, [slot]: catalog.itemId } };
}
