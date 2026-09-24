export class UnequipError extends Error {
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

export function planUnequip(catalog, itemId, equipment) {
    if (!catalog) throw new UnequipError(404, "ITEM_NOT_FOUND", "Cosmetic catalog item not found.");
    const slot = equipmentSlot(catalog.category);
    if (!slot) throw new UnequipError(400, "VALIDATION_ERROR", "This cosmetic cannot be unequipped.");
    if (equipment?.[slot] !== itemId) throw new UnequipError(409, "ITEM_NOT_EQUIPPED", "This item is not currently equipped.");
    return { slot, equipment: { ...equipment, [slot]: null } };
}
