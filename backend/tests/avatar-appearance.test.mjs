import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
    APPEARANCE_VALUES,
    BODY_TYPES,
    DEFAULT_APPEARANCE,
    EYE_COLOR_IDS,
    HAIR_COLOR_IDS,
    HAIR_IDS,
    normalizeAppearance,
    SKIN_COLOR_IDS
} from "../layers/api-shared/nodejs/appearance.mjs";
import { profilePutRequest } from "../functions/create-profile/logic.mjs";
import { ProfilePatchError, validateProfilePatch } from "../functions/update-me/logic.mjs";

test("appearance contract exposes the canonical body, hair, skin, hair-color, and eye allowlists", () => {
    assert.deepEqual(BODY_TYPES, ["BOY", "GIRL"]);
    assert.equal(HAIR_IDS.length, 10);
    assert.equal(SKIN_COLOR_IDS.length, 16);
    assert.equal(HAIR_COLOR_IDS.length, 20);
    assert.equal(EYE_COLOR_IDS.length, 12);
    assert.deepEqual(DEFAULT_APPEARANCE, {
        bodyType: "BOY",
        hairId: "avatar-v2/hair/windblown-layers",
        skinColorId: "skin_04",
        hairColorId: "brown",
        eyeColorId: "brown"
    });
});

test("legacy and malformed profiles normalize to safe appearance defaults", () => {
    assert.deepEqual(normalizeAppearance({}), DEFAULT_APPEARANCE);
    assert.deepEqual(normalizeAppearance({
        bodyType: { S: "GIRL" },
        hairId: { S: "paid/catalog/hair" },
        skinColorId: { S: "#ffffff" }
    }), {
        ...DEFAULT_APPEARANCE,
        bodyType: "GIRL"
    });
});

test("new profiles explicitly store every appearance default", () => {
    const item = profilePutRequest("Evrenthia-Dev", {
        request: { userAttributes: { sub: "appearance-user" } }
    }).Item;
    assert.deepEqual(normalizeAppearance(item), DEFAULT_APPEARANCE);
});

test("profile patch accepts every appearance field independently", () => {
    for (const [field, values] of Object.entries(APPEARANCE_VALUES)) {
        assert.deepEqual(validateProfilePatch({ [field]: values.at(-1) }, APPEARANCE_VALUES), {
            [field]: values.at(-1)
        });
    }
    assert.deepEqual(validateProfilePatch({ skinColorId: "skin_08", eyeColorId: "green" }, APPEARANCE_VALUES), {
        skinColorId: "skin_08",
        eyeColorId: "green"
    });
});

test("profile patch rejects arbitrary bodies, assets, and raw colors", () => {
    const invalid = [
        ["bodyType", "ROBOT", "INVALID_BODY_TYPE"],
        ["hairId", "avatar-v2/hair/paid-hair", "INVALID_HAIR_ID"],
        ["skinColorId", "#ffffff", "INVALID_SKIN_COLOR"],
        ["hairColorId", "rainbow", "INVALID_HAIR_COLOR"],
        ["eyeColorId", "laser", "INVALID_EYE_COLOR"]
    ];
    for (const [field, value, code] of invalid) {
        assert.throws(
            () => validateProfilePatch({ [field]: value }, APPEARANCE_VALUES),
            (error) => error instanceof ProfilePatchError && error.code === code
        );
    }
});

test("GET and PATCH handlers share canonical normalization without touching progression or equipment", () => {
    const getMe = readFileSync(new URL("../functions/get-me/index.mjs", import.meta.url), "utf8");
    const updateMe = readFileSync(new URL("../functions/update-me/index.mjs", import.meta.url), "utf8");
    assert.match(getMe, /normalizeAppearance\(profile\)/);
    assert.match(updateMe, /validateProfilePatch\(body, APPEARANCE_VALUES\)/);
    assert.match(updateMe, /normalizeAppearance\(result\.Attributes\)/);
    assert.doesNotMatch(updateMe, /INVENTORY|EQUIPMENT|coins\s*=|xp\s*=/);
    assert.match(updateMe, /requireActivePlayer/);
});
