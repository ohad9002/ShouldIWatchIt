const fetch = require('node-fetch');
const { calculateSimilarity, normalizeText, generateTitleVariants } = require('../similarity');

const OMDB_API_KEY = process.env.OMDB_API_KEY;

async function fetchOMDb(title) {
  const variants = generateTitleVariants(title);

  let allResults = [];
  for (const variant of variants) {
    // Try search endpoint
    const searchUrl = `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&s=${encodeURIComponent(variant)}&type=movie`;
    const searchResp = await fetch(searchUrl);
    if (searchResp.ok) {
      const searchData = await searchResp.json();
      if (searchData.Search && Array.isArray(searchData.Search)) {
        allResults.push(...searchData.Search);
      }
    }
    // Try direct title lookup
    const directUrl = `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&t=${encodeURIComponent(variant)}`;
    const directResp = await fetch(directUrl);
    if (directResp.ok) {
      const data = await directResp.json();
      if (data.Response !== "False") {
        allResults.push({
          Title: data.Title,
          imdbID: data.imdbID,
          Poster: data.Poster,
          Year: data.Year,
        });
      }
    }
  }

  // Deduplicate by imdbID
  const seen = new Set();
  allResults = allResults.filter(r => {
    if (!r.imdbID || seen.has(r.imdbID)) return false;
    seen.add(r.imdbID);
    return true;
  });

  // Score all results using normalized titles
  let best = { similarity: -1 };
  for (const result of allResults) {
    const sim = calculateSimilarity(normalizeText(result.Title), normalizeText(title));
    if (sim > best.similarity) best = { ...result, similarity: sim };
  }

  // If no good match, fallback to original direct lookup
  if (!best.imdbID || best.similarity < 0.5) {
    const url = `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&t=${encodeURIComponent(title)}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`OMDb API error: ${resp.status}`);
    const data = await resp.json();
    if (data.Response === "False") {
      return { title: 'N/A', rating: 'N/A', image: 'N/A', url: 'N/A', genres: [] };
    }
    return {
      title: data.Title || 'N/A',
      rating: data.imdbRating || 'N/A',
      image: data.Poster && data.Poster !== "N/A" ? data.Poster : 'N/A',
      url: data.imdbID ? `https://www.imdb.com/title/${data.imdbID}/` : 'N/A',
      genres: data.Genre ? data.Genre.split(',').map(g => g.trim()) : []
    };
  }

  // Fetch details for best match
  const detailUrl = `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&i=${best.imdbID}`;
  const detailResp = await fetch(detailUrl);
  if (!detailResp.ok) throw new Error(`OMDb API error: ${detailResp.status}`);
  const data = await detailResp.json();
  if (data.Response === "False") {
    return { title: 'N/A', rating: 'N/A', image: 'N/A', url: 'N/A', genres: [] };
  }
  return {
    title: data.Title || 'N/A',
    rating: data.imdbRating || 'N/A',
    image: data.Poster && data.Poster !== "N/A" ? data.Poster : 'N/A',
    url: data.imdbID ? `https://www.imdb.com/title/${data.imdbID}/` : 'N/A',
    genres: data.Genre ? data.Genre.split(',').map(g => g.trim()) : []
  };
}

module.exports = { fetchOMDb };