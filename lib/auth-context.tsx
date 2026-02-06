import React, { createContext, useContext, useState, useEffect } from "react";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

type User = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  role: "tech" | "admin" | "manager";
  phone: string | null;
  active: boolean;
  available: boolean;
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = "auth_token";
const USER_KEY = "user_info";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAuth();
  }, []);

  const loadAuth = async () => {
    try {
      console.log("[AuthContext] Loading auth state...");
      
      let storedToken: string | null = null;
      let storedUser: string | null = null;

      if (Platform.OS === "web") {
        storedToken = localStorage.getItem(TOKEN_KEY);
        storedUser = localStorage.getItem(USER_KEY);
      } else {
        try {
          storedToken = await SecureStore.getItemAsync(TOKEN_KEY);
          storedUser = await SecureStore.getItemAsync(USER_KEY);
        } catch (secureError) {
          console.warn("[AuthContext] SecureStore failed, falling back to AsyncStorage:", secureError);
          storedToken = await AsyncStorage.getItem(TOKEN_KEY);
          storedUser = await AsyncStorage.getItem(USER_KEY);
        }
      }

      if (storedToken && storedUser) {
        const parsedUser = JSON.parse(storedUser);
        console.log("[AuthContext] Restored auth:", { token: storedToken.substring(0, 20) + "...", user: parsedUser.email });
        setToken(storedToken);
        setUser(parsedUser);
      } else {
        console.log("[AuthContext] No stored auth found");
      }
    } catch (error) {
      console.error("[AuthContext] Error loading auth:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (newToken: string, newUser: User) => {
    try {
      console.log("[AuthContext] Logging in:", newUser.email);
      
      if (Platform.OS === "web") {
        localStorage.setItem(TOKEN_KEY, newToken);
        localStorage.setItem(USER_KEY, JSON.stringify(newUser));
      } else {
        try {
          await SecureStore.setItemAsync(TOKEN_KEY, newToken);
          await SecureStore.setItemAsync(USER_KEY, JSON.stringify(newUser));
        } catch (secureError) {
          console.warn("[AuthContext] SecureStore failed, falling back to AsyncStorage:", secureError);
          await AsyncStorage.setItem(TOKEN_KEY, newToken);
          await AsyncStorage.setItem(USER_KEY, JSON.stringify(newUser));
        }
      }

      setToken(newToken);
      setUser(newUser);
      console.log("[AuthContext] Login successful");
    } catch (error) {
      console.error("[AuthContext] Error during login:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      console.log("[AuthContext] Logging out...");
      
      if (Platform.OS === "web") {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      } else {
        try {
          await SecureStore.deleteItemAsync(TOKEN_KEY);
          await SecureStore.deleteItemAsync(USER_KEY);
        } catch (secureError) {
          console.warn("[AuthContext] SecureStore failed, falling back to AsyncStorage:", secureError);
          await AsyncStorage.removeItem(TOKEN_KEY);
          await AsyncStorage.removeItem(USER_KEY);
        }
      }

      setToken(null);
      setUser(null);
      console.log("[AuthContext] Logout successful");
    } catch (error) {
      console.error("[AuthContext] Error during logout:", error);
    }
  };

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isAuthenticated: !!token && !!user,
    login,
    logout,
    setUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
