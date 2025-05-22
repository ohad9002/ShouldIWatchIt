// utils/normalization.js

const genreMap = {
    "Action": "Action",
    "Adventure": "Adventure",
    "Animation": "Animation",
    "Biography": "Biography",
    "Comedy": "Comedy",
    "Crime": "Crime",
    "Documentary": "Documentary",
    "Drama": "Drama",
    "Family": "Family",
    "Fantasy": "Fantasy",
    "History": "History",
    "Horror": "Horror",
    "Kids": "Kids & Family",
    "Kids & Family": "Kids & Family",
    "LGBTQ+": "LGBTQ+",
    "Music": "Music",
    "Musical": "Musical",
    "Mystery": "Mystery & Thriller",
    "Mystery & Thriller": "Mystery & Thriller",
    "News": "News",
    "Reality": "Reality",
    "Romance": "Romance",
    "Sci-Fi": "Sci-Fi",
    "Short": "Short",
    "Soap": "Soap",
    "Special Interest": "Special Interest",
    "Sports": "Sports",
    "Stand-Up": "Stand-Up",
    "Talk Show": "Talk Show",
    "Thriller": "Mystery & Thriller",
    "Travel": "Travel",
    "Variety": "Variety",
    "War": "War",
    "Western": "Western",
    "Game Show": "Game Show",
    "Health & Wellness": "Health & Wellness",
    "Holiday": "Holiday",
    "Nature": "Nature",
    "House & Garden": "House & Garden",
    "Anime": "Anime",
    // Add more mappings as needed
};

const normalizeGenre = (genre) => {
    if (!genre) return '';
    // Remove Epic/Psychological, split on '&' or ',' and trim
    return genre
        .replace(/\b(Epic|Psychological)\b/gi, '')
        .split(/,|&/)
        .map(g => g.trim())
        .map(g => genreMap[g] || g)
        .filter(Boolean)
        .join(', ');
};

const normalizeOscarCategory = (category) => {
    if (!category) return '';
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

const normalizeText = (text) => {
    if (!text) return '';
    return text.toLowerCase()
               .replace(/[^a-z0-9\s]/g, '') // Remove all non-letter/number/space
               .trim();
};

module.exports = {
    normalizeGenre,
    normalizeOscarCategory,
    normalizeText
};
