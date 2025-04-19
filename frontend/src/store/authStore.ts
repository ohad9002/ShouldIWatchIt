import { create } from 'zustand';
import { jwtDecode } from 'jwt-decode'; // Use named import

export type User = {
  userId: string;
  token: string;
  username: string;
};

type AuthStore = {
  user: User | null;
  setUser: (token: string) => void;
  logout: () => void; // Add logout function
};

const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  setUser: (token) => {
    const decoded: { userId: string; username: string } = jwtDecode(token);
    set({
      user: {
        userId: decoded.userId,
        token,
        username: decoded.username,
      },
    });
  },
  logout: () => set({ user: null }), // Clear the user state
}));

export default useAuthStore;
