import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { API_BASE_URL } from "../assets/api";

const DeleteUser = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout); // Access the logout function

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/delete`, {
        username,
        password,
      });

      if (response.status === 200) {
        setSuccess('Account deleted successfully.');
        logout(); // Log the user out
        setTimeout(() => navigate('/'), 2000); // Redirect to home page after 2 seconds
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response && err.response.data.message) {
        setError(err.response.data.message);
      } else {
        setError('An error occurred. Please try again.');
      }
    }
  };

  return (
    <div className="bg-gradient-to-b from-gray-900 to-gray-800 min-h-screen flex items-center justify-center">
      <form onSubmit={handleDelete} className="bg-black bg-opacity-75 p-8 rounded shadow-md text-white w-80">
        <h2 className="text-2xl font-bold mb-4">Delete Account</h2>
        {error && <p className="text-red-500 mb-4">{error}</p>}
        {success && <p className="text-green-500 mb-4">{success}</p>}
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          className="w-full p-2 mb-4 rounded bg-gray-800 text-white border border-gray-600 focus:outline-none focus:border-red-500"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full p-2 mb-4 rounded bg-gray-800 text-white border border-gray-600 focus:outline-none focus:border-red-500"
        />
        <button
          type="submit"
          className="w-full bg-red-500 text-white py-2 rounded hover:bg-red-700 transition"
        >
          Delete Account
        </button>
      </form>
    </div>
  );
};

export default DeleteUser;