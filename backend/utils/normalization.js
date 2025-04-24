// utils/normalization.js

const normalizeGenre = (genre) => {
    return genre
        .replace(/\b(Epic|Psychological)\b/gi, '')
        .replace('&', ',')
        .trim();
};

const normalizeOscarCategory = (category) => {
    const categoryMap = {
        "ACTOR": "Best Actor",
        "ACTOR IN A SUPPORTING ROLE": "Best Supporting Actor",
        "ACTRESS IN A LEADING ROLE": "Best Actress",
        "ACTRESS IN A SUPPORTING ROLE": "Best Supporting Actress",
        "COSTUME DESIGN": "Best Costume Design",
        "DIRECTING": "Best Director",
        "FILM EDITING": "Best Film Editing",
        "MUSIC (ORIGINAL DRAMATIC SCORE)": "Best Original Score",
        "MUSIC (ORIGINAL SONG)": "Best Original Song",
        "BEST PICTURE": "Best Picture",
        "SOUND": "Best Sound",
        "SOUND EDITING": "Best Sound",
        "SOUND MIXING": "Best Sound",
        "VISUAL EFFECTS": "Best Visual Effects",
        "ART DIRECTION": "Best Production Design",
        "PRODUCTION DESIGN": "Best Production Design",
        "CINEMATOGRAPHY": "Best Cinematography",
        "FOREIGN LANGUAGE FILM": "Best International Feature",
        "WRITING (SCREENPLAY--BASED ON MATERIAL FROM ANOTHER MEDIUM)": "Best Adapted Screenplay",
        "WRITING (ORIGINAL SCREENPLAY)": "Best Original Screenplay"
    };

    return categoryMap[category.toUpperCase()] || category;
};

module.exports = {
    normalizeGenre,
    normalizeOscarCategory
};
