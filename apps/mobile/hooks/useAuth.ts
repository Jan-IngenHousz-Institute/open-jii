import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      setIsLoading(true);
      const token = await AsyncStorage.getItem('auth_token');
      
      if (token) {
        // In a real app, you would validate the token here
        // For now, just consider the user authenticated if a token exists
        setIsAuthenticated(true);
        
        // Mock user data - in a real app, you would fetch this from an API
        setUser({
          email: 'researcher@example.com',
          name: 'Alex Researcher',
          organization: 'Plant Science Institute',
        });
      } else {
        setIsAuthenticated(false);
        setUser(null);
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (token: string, userData?: any) => {
    try {
      await AsyncStorage.setItem('auth_token', token);
      setIsAuthenticated(true);
      setUser(userData || {});
      return true;
    } catch (error) {
      console.error('Error logging in:', error);
      return false;
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('auth_token');
      setIsAuthenticated(false);
      setUser(null);
      return true;
    } catch (error) {
      console.error('Error logging out:', error);
      return false;
    }
  };

  return {
    isAuthenticated,
    isLoading,
    user,
    login,
    logout,
    checkAuthStatus,
  };
}