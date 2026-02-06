import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:3000";

export async function getAuthToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    return localStorage.getItem("auth_token");
  } else {
    return await SecureStore.getItemAsync("auth_token");
  }
}

export async function setAuthToken(token: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.setItem("auth_token", token);
  } else {
    await SecureStore.setItemAsync("auth_token", token);
  }
}

export async function removeAuthToken(): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user_info");
  } else {
    await SecureStore.deleteItemAsync("auth_token");
    await SecureStore.deleteItemAsync("user_info");
  }
}

export async function fetchCurrentUser() {
  const token = await getAuthToken();
  
  if (!token) {
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      // Token is invalid, clear it
      await removeAuthToken();
      return null;
    }

    const user = await response.json();
    
    // Cache user info
    if (Platform.OS === "web") {
      localStorage.setItem("user_info", JSON.stringify(user));
    } else {
      await SecureStore.setItemAsync("user_info", JSON.stringify(user));
    }
    
    return user;
  } catch (error) {
    console.error("[Auth] fetchCurrentUser error:", error);
    return null;
  }
}

export async function getCachedUser() {
  if (Platform.OS === "web") {
    const userStr = localStorage.getItem("user_info");
    return userStr ? JSON.parse(userStr) : null;
  } else {
    const userStr = await SecureStore.getItemAsync("user_info");
    return userStr ? JSON.parse(userStr) : null;
  }
}
