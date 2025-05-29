const fetch = require('node-fetch');

const OMDB_API_KEY = process.env.OMDB_API_KEY; // Set this in your Render environment variables

async function fetchOMDb(title) {
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

module.exports = { fetchOMDb };