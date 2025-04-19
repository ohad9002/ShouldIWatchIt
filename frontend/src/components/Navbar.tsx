import { Link, useNavigate } from "react-router-dom";
import useAuthStore from "../store/authStore.ts";
import useTheme from "../hooks/useTheme.ts";

const Navbar = ({ clearState }: { clearState: () => void }) => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleHomeClick = () => {
    clearState(); // Reset the Home page state
    navigate("/"); // Navigate to the Home page
  };

  return (
    <nav
      className="flex justify-between items-center p-4 shadow-md"
      style={{
        backgroundColor: "var(--bg-color)",
        color: "var(--text-color)",
      }}
    >
      <h1
        className="text-2xl font-bold"
        style={{ color: "var(--primary-color)" }}
      >
        ShouldIWatchIt
      </h1>
      <div className="flex items-center space-x-4">
        <button
          onClick={handleHomeClick}
          className="hover:opacity-80 transition"
          style={{ color: "var(--text-color)" }}
        >
          Home
        </button>
        {user ? (
          <>
            <Link
              to="/preferences"
              className="hover:opacity-80 transition"
              style={{ color: "var(--text-color)" }}
            >
              Preferences
            </Link>
            <span>Welcome, {user.username}</span>
            <Link
              to="/delete-user"
              className="hover:opacity-80 transition"
              style={{ color: "var(--primary-color)" }}
            >
              Delete Account
            </Link>
            <button
              onClick={handleLogout}
              className="px-3 py-1 rounded hover:opacity-80 transition"
              style={{
                backgroundColor: "var(--primary-color)",
                color: "var(--text-color)",
              }}
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link
              to="/signin"
              className="hover:opacity-80 transition"
              style={{ color: "var(--text-color)" }}
            >
              Sign In
            </Link>
            <Link
              to="/signup"
              className="px-3 py-1 rounded hover:opacity-80 transition"
              style={{
                backgroundColor: "var(--primary-color)",
                color: "var(--text-color)",
              }}
            >
              Sign Up
            </Link>
          </>
        )}
        <button
          onClick={toggleTheme}
          className="px-3 py-1 rounded hover:opacity-80 transition"
          style={{
            backgroundColor: "var(--secondary-color)",
            color: "var(--text-color)",
          }}
        >
          {theme === "light" ? "Dark Mode" : "Light Mode"}
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
