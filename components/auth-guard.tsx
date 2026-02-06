import { View, ActivityIndicator } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/lib/auth-context";
import LoginScreen from "@/app/login";

/**
 * Auth Guard Component
 * 
 * Protects routes by checking if user is authenticated.
 * Renders login screen directly if not authenticated.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();
  const colors = useColors();

  // Show loading spinner while checking auth
  if (isLoading) {
    console.log("[AuthGuard] Loading auth state...");
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Render login screen directly if not authenticated
  if (!isAuthenticated) {
    console.log("[AuthGuard] Not authenticated, showing login screen");
    return <LoginScreen />;
  }

  // Authenticated - render protected content
  console.log("[AuthGuard] Authenticated, rendering app");
  return <>{children}</>;
}
