
import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../firebase';
import { UserProfile } from '../types';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const isFirstCheck = React.useRef(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: User | null) => {
      if (firebaseUser) {
        const userProfile: UserProfile = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          isPro: false, // TODO: Fetch this from Firestore 'users' collection later
        };
        setUser(userProfile);
        setLoading(false);
        isFirstCheck.current = false;
      } else {
        setUser(null);
        // On first check, wait a bit before showing login screen
        // to prevent flash when persisted auth is being restored
        if (isFirstCheck.current) {
          setTimeout(() => {
            if (isFirstCheck.current) {
              setLoading(false);
              isFirstCheck.current = false;
            }
          }, 300);
        } else {
          setLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
