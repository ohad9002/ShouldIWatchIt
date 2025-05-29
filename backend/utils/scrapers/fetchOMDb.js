const fetch = require('node-fetch');
const { calculateSimilarity, normalizeText } = require('../similarity');

const OMDB_API_KEY = process.env.OMDB_API_KEY; // Set this in your Render environment variables

async function fetchOMDb(title) {
  // Generate search variants
  const variants = [
    title,
    normalizeText(title),
    normalizeText(title).replace(/\b3\b/, 'iii'),
    normalizeText(title).replace(/\biii\b/, '3'),
    normalizeText(title).replace(/\bpart\b/, ''),
  ].filter((v, i, arr) => v && arr.indexOf(v) === i);

  let allResults = [];
  for (const variant of variants) {
    const searchUrl = `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&s=${encodeURIComponent(variant)}&type=movie`;
    const searchResp = await fetch(searchUrl);
    if (!searchResp.ok) continue;
    const searchData = await searchResp.json();
    if (searchData.Search && Array.isArray(searchData.Search)) {
      allResults.push(...searchData.Search);
    }
  }

  // Deduplicate results by imdbID
  const seen = new Set();
  allResults = allResults.filter(r => {
    if (!r.imdbID || seen.has(r.imdbID)) return false;
    seen.add(r.imdbID);
    return true;
  });

  // Score all results
  let best = { similarity: -1 };
  for (const result of allResults) {
    const sim = calculateSimilarity(result.Title, title);
    if (sim > best.similarity) best = { ...result, similarity: sim };
  }

  // If no good match, fallback to direct title lookup
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