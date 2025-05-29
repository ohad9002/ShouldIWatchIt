const fetch = require('node-fetch');
const { calculateSimilarity } = require('../similarity');

const OMDB_API_KEY = process.env.OMDB_API_KEY; // Set this in your Render environment variables

async function fetchOMDb(title) {
  // 1. Search for possible matches
  const searchUrl = `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&s=${encodeURIComponent(title)}&type=movie`;
  const searchResp = await fetch(searchUrl);
  if (!searchResp.ok) throw new Error(`OMDb API error: ${searchResp.status}`);
  const searchData = await searchResp.json();

  if (!searchData.Search || !Array.isArray(searchData.Search) || searchData.Search.length === 0) {
    // fallback to direct title lookup (old behavior)
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

  // 2. Score all results
  let best = { similarity: -1 };
  for (const result of searchData.Search) {
    const sim = calculateSimilarity(result.Title, title);
    if (sim > best.similarity) best = { ...result, similarity: sim };
  }

  // 3. If no good match, fallback
  if (!best.imdbID || best.similarity < 0.5) {
    return { title: 'N/A', rating: 'N/A', image: 'N/A', url: 'N/A', genres: [] };
  }

  // 4. Fetch details for best match
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