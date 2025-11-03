import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { auth, db, handleFirebaseError } from '@/lib/firebase';
import { UserProfile } from '@/types/database';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, nombre: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('onAuthStateChanged, user uid:', user?.uid);
      setUser(user);
      if (user) {
        await fetchUserProfile(user.uid);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const fetchUserProfile = async (userId: string, retries = 3) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setProfile({
          id: userId,
          ...data,
          fecha_registro: data.fecha_registro?.toDate() || new Date(),
        } as UserProfile);
      } else {
        console.log('User profile document does not exist for userId:', userId);
      }
    } catch (error: any) {
      console.error('Error fetching profile:', error);

      if (error?.code === 'permission-denied' || error?.message?.includes('Missing or insufficient permissions')) {
        console.error('Firestore permission denied when fetching user profile. Revisa las reglas de seguridad en Firebase Console (Firestore) y que el usuario esté autenticado y tenga permisos para leer /users/' + userId);
      }

      // Consider a broader set of network-related error signals (Firestore or Auth network failures)
      const message = String(error?.message || '').toLowerCase();
      const code = String(error?.code || '').toLowerCase();
      const isNetworkError = code.includes('network') || message.includes('network') || message.includes('offline') || code === 'unavailable';

      // Retry on detected network errors
      if (retries > 0 && isNetworkError) {
        console.log(`Network error detected when fetching profile. Retrying... (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return fetchUserProfile(userId, retries - 1);
      }

      // If not retried or still failing, keep profile as null (offline) and allow app to operate in offline mode
      if (!isNetworkError) {
        // For non-network errors we may want to surface or log additional info; already logged above.
      }
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return { error: null };
    } catch (error) {
      return { error: handleFirebaseError(error) };
    }
  };

  const signUp = async (email: string, password: string, nombre: string) => {
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      
      // Update Firebase Auth profile
      await updateProfile(user, { displayName: nombre });

      // Create user profile in Firestore
      const userProfile: UserProfile = {
        id: user.uid,
        nombre,
        email,
        rol: 'usuario',
        puntos: 0,
        fecha_registro: new Date(),
      };

      await setDoc(doc(db, 'users', user.uid), {
        ...userProfile,
        fecha_registro: serverTimestamp(),
      });

      return { error: null };
    } catch (error) {
      return { error: handleFirebaseError(error) };
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  const updateUserProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return { error: 'No user logged in' };

    try {
      await updateDoc(doc(db, 'users', user.uid), updates);
      
      if (profile) {
        setProfile({ ...profile, ...updates });
      }
      
      return { error: null };
    } catch (error) {
      return { error: handleFirebaseError(error) };
    }
  };

  const value = {
    user,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
    updateProfile: updateUserProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};