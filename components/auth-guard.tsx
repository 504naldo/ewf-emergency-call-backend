import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter, useSegments } from "expo-router";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/lib/auth-context";

/**
 * Auth Guard Component
 * 
 * Protects routes by checking if user is authenticated.
 * Redirects to login if not authenticated.
 * Redirects to home if authenticated and on login page.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const colors = useColors();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "login";

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to login if not authenticated
      console.log("[AuthGuard] Not authenticated, redirecting to login");
      router.replace("/login");
    } else if (isAuthenticated && inAuthGroup) {
      // Redirect to home if authenticated and on login page
      console.log("[AuthGuard] Authenticated, redirecting to home");
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
