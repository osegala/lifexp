export function xpRequiredForNextLevel(level) {
    return 100 + ((level - 1) * 50);
}

export function levelInfo(totalXp) {
    let level = 1;
    let xpIntoLevel = Number(totalXp) || 0;

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
