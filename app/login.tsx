import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, Alert, Image } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useState } from "react";
import { router } from "expo-router";
import { useAuth } from "@/lib/auth-context";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:3000";

export default function LoginScreen() {
  const colors = useColors();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter email and password");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Login failed");
      }

      // Store token and user via AuthContext
      await login(data.token, data.user);
      
      console.log("[Login] Login successful, auth state updated");
      // No need to navigate - AuthGuard will automatically render the app
    } catch (error: any) {
      console.error("[Login] Error:", error);
      Alert.alert("Login Failed", error.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="bg-background">
      <View className="flex-1 items-center justify-center p-6 gap-8">
        {/* Logo/Title */}
        <View className="items-center gap-4">
          <Image
            source={{ uri: "https://files.manuscdn.com/user_upload_by_module/session_file/113852657/pdzVPLVluGlTluky.png" }}
            style={{ width: 170, height: 170 }}
            resizeMode="contain"
          />
          <Text className="text-3xl font-bold text-foreground">Emergency Call Service</Text>
          <Text className="text-base text-muted text-center">
            Internal emergency call routing and incident management
          </Text>
        </View>

        {/* Login Form */}
        <View className="w-full max-w-sm gap-4">
          <TextInput
            className="bg-surface border border-border rounded-xl px-4 py-4 text-foreground text-base"
            placeholder="Email"
            placeholderTextColor={colors.muted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />
          
          <TextInput
            className="bg-surface border border-border rounded-xl px-4 py-4 text-foreground text-base"
            placeholder="Password"
            placeholderTextColor={colors.muted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />

          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            style={{
              backgroundColor: loading ? colors.border : colors.primary,
              paddingVertical: 16,
              borderRadius: 12,
            }}
          >
            {loading ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text className="text-background text-center font-semibold text-lg">Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Demo Credentials */}
        <View className="bg-surface border border-border rounded-xl p-4 w-full max-w-sm">
          <Text className="text-sm font-semibold text-foreground mb-2">Demo Credentials:</Text>
          <Text className="text-sm text-muted">Email: john.smith@ewf.com</Text>
          <Text className="text-sm text-muted">Password: password123</Text>
        </View>
      </View>
    </ScreenContainer>
  );
}
