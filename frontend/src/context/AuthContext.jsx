import { createContext, useEffect, useState } from 'react';
import authApi from '../api/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadUser() {
      const token = localStorage.getItem('token');
      if (!token) {
        if (isMounted) setLoading(false);
        return;
      }

      try {
        const currentUser = await authApi.getMe();
        if (isMounted) setUser(currentUser);
      } catch (err) {
        console.error('Failed to load authenticated user on init:', err);
        localStorage.removeItem('token');
        if (isMounted) setUser(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadUser();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (email, password) => {
    const data = await authApi.login(email, password);
    localStorage.setItem('token', data.access_token);
    const currentUser = await authApi.getMe();
    setUser(currentUser);
    return currentUser;
  };

  const register = async (name, email, password) => {
    await authApi.register(name, email, password);
    const data = await authApi.login(email, password);
    localStorage.setItem('token', data.access_token);
    const currentUser = await authApi.getMe();
    setUser(currentUser);
    return currentUser;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthContext;
