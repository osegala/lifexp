import test from "node:test";
import assert from "node:assert/strict";
import { buildShopItems } from "../functions/get-shop/logic.mjs";
import { planPurchase, PurchaseError } from "../functions/purchase-item/logic.mjs";
import { cosmeticOffer } from "../layers/progression-shared/nodejs/building-effects.mjs";
import { planEquip, EquipError } from "../functions/equip-item/logic.mjs";
import { planUnequip, UnequipError } from "../functions/unequip-item/logic.mjs";
import { validateProfilePatch, ProfilePatchError } from "../functions/update-me/logic.mjs";

const catalogItem = {
    itemId: "moon-hat",
    name: "Moon Hat",
    category: "hats",
    price: 25,
    requiredLevel: 1,
    active: true
};

test("shop reports catalog-derived lock, affordability, and ownership states", () => {
    const catalog = [
        { ...catalogItem, requiredLevel: 3 },
        { ...catalogItem, itemId: "costly", price: 100 },
        { ...catalogItem, itemId: "owned" }
    ];
    const items = buildShopItems(catalog, new Set(["owned"]), new Set(), 40, 1);
    assert.deepEqual(items.map((item) => item.status), ["LOCKED", "NOT_ENOUGH_COINS", "OWNED"]);
});

test("locked item cannot be purchased", () => {
    assert.throws(
        () => planPurchase({ ...catalogItem, requiredLevel: 3 }, { xp: 0, coins: 100 }),
        (error) => error instanceof PurchaseError && error.statusCode === 403
    );
});

test("insufficient coins cannot purchase", () => {
    assert.throws(
        () => planPurchase(catalogItem, { xp: 0, coins: 24 }),
        (error) => error instanceof PurchaseError && error.statusCode === 400
    );
});

test("owned item cannot be purchased twice", () => {
    assert.throws(
        () => planPurchase(catalogItem, { xp: 0, coins: 100 }, { owned: true }),
        (error) => error instanceof PurchaseError && error.statusCode === 409
    );
});

test("purchase always uses the server catalog price", () => {
    const clientBody = { itemId: "moon-hat", price: 1, effectivePrice: 0, discountPercent: 100 };
    const offer = cosmeticOffer(catalogItem, { shopDiscountPercent: 10 });
    const plan = planPurchase(catalogItem, { xp: 0, coins: 100 }, { offer });
    assert.equal(clientBody.price, 1);
    assert.equal(plan.catalogPrice, 25);
    assert.equal(plan.price, 22);
    assert.equal(plan.remainingCoins, 78);
});

test("purchase uses the server-resolved effective level requirement", () => {
    const levelFiveItem = { ...catalogItem, requiredLevel: 5 };
    const offer = cosmeticOffer(levelFiveItem, { cosmeticLevelRequirementReduction: 1 });
    const plan = planPurchase(levelFiveItem, { xp: 450, coins: 100 }, { offer });

    assert.equal(plan.playerLevel, 4);
    assert.equal(plan.requiredLevel, 5);
    assert.equal(plan.effectiveRequiredLevel, 4);
});

test("unowned item cannot be equipped", () => {
    assert.throws(
        () => planEquip(false, catalogItem),
        (error) => error instanceof EquipError && error.statusCode === 403
    );
});

test("owned item equips to the category-controlled slot", () => {
    const plan = planEquip(true, catalogItem, { hat: null });
    assert.equal(plan.slot, "hat");
    assert.equal(plan.equipment.hat, "moon-hat");
});

test("unequip removes the item from its category-controlled slot", () => {
    const plan = planUnequip(catalogItem, "moon-hat", { hat: "moon-hat", boots: "boots-1" });
    assert.equal(plan.slot, "hat");
    assert.equal(plan.equipment.hat, null);
    assert.equal(plan.equipment.boots, "boots-1");
    assert.throws(
        () => planUnequip(catalogItem, "moon-hat", { hat: "other-hat" }),
        (error) => error instanceof UnequipError && error.statusCode === 409
    );
});

test("profile patch blocks progression and server-managed fields", () => {
    for (const field of ["xp", "coins", "worldPoints", "tasksCompleted", "level", "progression", "createdAt", "updatedAt", "lastTaskCompletedAt"]) {
        assert.throws(
            () => validateProfilePatch({ [field]: 999 }),
            (error) => error instanceof ProfilePatchError &&
                error.code === "VALIDATION_ERROR" &&
                error.message === `Field cannot be updated: ${field}.`
        );
    }
});

test("profile patch accepts editable fields and rejects invalid time zones", () => {
    assert.deepEqual(validateProfilePatch({ displayName: "  Nova  ", timeZone: "America/New_York" }), {
        displayName: "Nova",
        timeZone: "America/New_York"
    });
    assert.throws(
        () => validateProfilePatch({ timeZone: "Moon/Tranquility" }),
        (error) => error instanceof ProfilePatchError && error.code === "INVALID_TIME_ZONE"
    );
});
