import { useState, useEffect } from 'react';
import { Platform } from 'react-native';

export default function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // This is a mock implementation
    // In a real app, you would use NetInfo from @react-native-community/netinfo
    
    const checkNetworkStatus = () => {
      // Simulate random network status for demo purposes
      const online = Math.random() > 0.2;
      setIsOnline(online);
    };
    
    // Initial check
    checkNetworkStatus();
    
    // Set up interval to periodically check network status
    const intervalId = setInterval(checkNetworkStatus, 30000);
    
    // Clean up interval on unmount
    return () => clearInterval(intervalId);
  }, []);

  return { isOnline };
}