import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useState } from 'react';
import Home from './pages/Home';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
import Preferences from './pages/Preferences';
import DeleteUser from './pages/DeleteUser.tsx';
import Navbar from './components/Navbar';

const App = () => {
  // State to trigger a reset for the Home page
  const [resetHomeTrigger, setResetHomeTrigger] = useState(false);

  // Function to reset the Home page
  const resetHome = () => {
    setResetHomeTrigger((prev) => !prev); // Toggle the trigger to reset Home
  };

  return (
    <Router>
      <Navbar clearState={resetHome} /> {/* Pass resetHome to Navbar */}
      <Routes>
        <Route path="/" element={<Home resetTrigger={resetHomeTrigger} />} /> {/* Pass resetTrigger to Home */}
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/preferences" element={<Preferences />} />
        <Route path="/delete-user" element={<DeleteUser />} />
      </Routes>
    </Router>
  );
};

export default App;
