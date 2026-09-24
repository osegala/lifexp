export function xpRequiredForNextLevel(level) {
    const currentLevel = Math.max(1, Math.trunc(Number(level) || 1));
    return Math.round(100 * (currentLevel ** 1.35));
}

export function levelInfo(totalXp) {
    const value = Number(totalXp);
    let xpIntoLevel = Number.isFinite(value) ? Math.max(0, value) : 0;
    let level = 1;

    while (xpIntoLevel >= xpRequiredForNextLevel(level)) {
        xpIntoLevel -= xpRequiredForNextLevel(level);
        level += 1;
    }

    const xpForNextLevel = xpRequiredForNextLevel(level);
    return {
        level,
        xpIntoLevel,
        xpForNextLevel,
        xpToNextLevel: xpForNextLevel - xpIntoLevel
    };
}

export function levelFromXp(totalXp) {
    return levelInfo(totalXp).level;
}
