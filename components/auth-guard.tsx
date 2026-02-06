import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter, useSegments } from "expo-router";
import { useColors } from "@/hooks/use-colors";
import { getAuthToken, fetchCurrentUser } from "@/lib/auth-helpers";

/**
 * Auth Guard Component
 * 
 * Protects routes by checking if user is authenticated.
 * Redirects to login if not authenticated.
 * Redirects to home if authenticated and on login page.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();
  const segments = useSegments();
  const colors = useColors();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await getAuthToken();
      
      if (token) {
        // Verify token is still valid
        const user = await fetchCurrentUser();
        setIsAuthenticated(!!user);
      } else {
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error("[AuthGuard] Error checking auth:", error);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "login";

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to login if not authenticated
      router.replace("/login");
    } else if (isAuthenticated && inAuthGroup) {
      // Redirect to home if authenticated and on login page
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, isLoading, segments, router]);

  // Show loading spinner while checking auth
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return <>{children}</>;
}
