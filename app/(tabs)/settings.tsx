import { ScrollView, Text, View, TouchableOpacity, Switch, TextInput, Alert } from "react-native";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { router } from "expo-router";
import { useAuth } from "@/lib/auth-context";

export default function SettingsScreen() {
  const colors = useColors();
  const { user: currentUser, token, isAuthenticated, logout } = useAuth();
  const utils = trpc.useUtils();

  const handleLogout = async () => {
    await logout();
    utils.invalidate(); // Clear tRPC cache
    router.replace("/login");
  };



  // Fetch configuration
  const { data: businessHours, refetch: refetchBH } = trpc.config.getBusinessHours.useQuery();
  const { data: ringDuration, refetch: refetchRD } = trpc.config.getRingDuration.useQuery();
  const { data: bhLadder, refetch: refetchBHL } = trpc.config.getBusinessHoursLadder.useQuery();
  const { data: ahLadder, refetch: refetchAHL } = trpc.config.getAfterHoursLadder.useQuery();

  // Mutations
  const updateBHMutation = trpc.config.updateBusinessHours.useMutation({
    onSuccess: () => {
      refetchBH();
    },
  });

  const updateRDMutation = trpc.config.updateRingDuration.useMutation({
    onSuccess: () => {
      refetchRD();
    },
  });

  // Local state for editing
  const [editingRingDuration, setEditingRingDuration] = useState(false);
  const [ringDurationValue, setRingDurationValue] = useState("");

  // Check if user is admin
  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "manager";

  if (!isAdmin) {
    return (
      <ScreenContainer className="bg-background">
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-xl font-bold text-foreground mb-2">Access Denied</Text>
          <Text className="text-center text-muted">
            This section is only available to administrators.
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  const handleSaveRingDuration = () => {
    const seconds = parseInt(ringDurationValue);
    if (seconds >= 10 && seconds <= 60) {
      updateRDMutation.mutate({ seconds });
      setEditingRingDuration(false);
    }
  };

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <ScreenContainer className="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 p-6 gap-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">Settings</Text>
            <Text className="text-base text-muted">System configuration and account</Text>
          </View>

          {/* User Info */}
          {currentUser && (
            <View className="bg-surface rounded-2xl p-6 border border-border gap-3">
              <Text className="text-lg font-bold text-foreground">Account Information</Text>
              <View className="gap-2">
                <View>
                  <Text className="text-sm text-muted">Name</Text>
                  <Text className="text-base text-foreground font-semibold">{currentUser.name}</Text>
                </View>
                <View>
                  <Text className="text-sm text-muted">Email</Text>
                  <Text className="text-base text-foreground">{currentUser.email}</Text>
                </View>
                <View>
                  <Text className="text-sm text-muted">Role</Text>
                  <View className="flex-row items-center gap-2">
                    <View
                      className="px-3 py-1 rounded-full"
                      style={{ backgroundColor: `${colors.primary}20` }}
                    >
                      <Text
                        className="text-sm font-semibold uppercase"
                        style={{ color: colors.primary }}
                      >
                        {currentUser.role}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Auth Debug Info */}
          <View className="bg-surface rounded-2xl p-6 border border-border gap-3">
            <Text className="text-lg font-bold text-foreground">Auth Debug</Text>
            <View className="gap-2">
              <View className="flex-row justify-between">
                <Text className="text-sm text-muted">Authenticated</Text>
                <Text className="text-sm font-semibold text-foreground">
                  {isAuthenticated ? "✅ Yes" : "❌ No"}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-sm text-muted">Token Present</Text>
                <Text className="text-sm font-semibold text-foreground">
                  {token ? "✅ Yes" : "❌ No"}
                </Text>
              </View>
              {token && (
                <View>
                  <Text className="text-sm text-muted">Token (first 30 chars)</Text>
                  <Text className="text-xs font-mono text-foreground">
                    {token.substring(0, 30)}...
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Business Hours */}
          <View className="bg-surface rounded-2xl p-6 border border-border gap-4">
            <Text className="text-lg font-bold text-foreground">Business Hours</Text>
            
            {businessHours && (
              <>
                <View>
                  <Text className="text-sm text-muted mb-2">Active Days</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {dayNames.map((day, index) => (
                      <View
                        key={index}
                        className="px-3 py-2 rounded-lg"
                        style={{
                          backgroundColor: businessHours.days.includes(index)
                            ? `${colors.primary}20`
                            : `${colors.border}20`,
                        }}
                      >
                        <Text
                          className="text-sm font-semibold"
                          style={{
                            color: businessHours.days.includes(index)
                              ? colors.primary
                              : colors.muted,
                          }}
                        >
                          {day}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>

                <View>
                  <Text className="text-sm text-muted mb-2">Hours</Text>
                  <Text className="text-base text-foreground">
                    {String(businessHours.startHour).padStart(2, "0")}:
                    {String(businessHours.startMinute).padStart(2, "0")} -{" "}
                    {String(businessHours.endHour).padStart(2, "0")}:
                    {String(businessHours.endMinute).padStart(2, "0")}
                  </Text>
                </View>

                <View>
                  <Text className="text-sm text-muted mb-2">Timezone</Text>
                  <Text className="text-base text-foreground">{businessHours.timezone}</Text>
                </View>
              </>
            )}
          </View>

          {/* Ring Duration */}
          <View className="bg-surface rounded-2xl p-6 border border-border gap-4">
            <Text className="text-lg font-bold text-foreground">Ring Duration</Text>
            
            {ringDuration && (
              <>
                {!editingRingDuration ? (
                  <View className="flex-row items-center justify-between">
                    <View>
                      <Text className="text-sm text-muted mb-1">Seconds per step</Text>
                      <Text className="text-2xl font-bold text-foreground">
                        {ringDuration.seconds}s
                      </Text>
                    </View>
                    <TouchableOpacity
                      className="bg-primary px-4 py-2 rounded-lg active:opacity-80"
                      onPress={() => {
                        setRingDurationValue(String(ringDuration.seconds));
                        setEditingRingDuration(true);
                      }}
                    >
                      <Text className="text-sm font-semibold text-background">Edit</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View className="gap-3">
                    <TextInput
                      className="bg-background border border-border rounded-lg px-4 py-3 text-foreground"
                      value={ringDurationValue}
                      onChangeText={setRingDurationValue}
                      keyboardType="number-pad"
                      placeholder="10-60 seconds"
                      placeholderTextColor={colors.muted}
                    />
                    <View className="flex-row gap-3">
                      <TouchableOpacity
                        className="flex-1 bg-primary rounded-lg py-3 active:opacity-80"
                        onPress={handleSaveRingDuration}
                        disabled={updateRDMutation.isPending}
                      >
                        <Text className="text-center text-sm font-semibold text-background">
                          {updateRDMutation.isPending ? "Saving..." : "Save"}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        className="flex-1 bg-surface border border-border rounded-lg py-3 active:opacity-70"
                        onPress={() => setEditingRingDuration(false)}
                      >
                        <Text className="text-center text-sm font-semibold text-foreground">
                          Cancel
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </>
            )}
          </View>

          {/* Business Hours Ladder */}
          <View className="bg-surface rounded-2xl p-6 border border-border gap-4">
            <Text className="text-lg font-bold text-foreground">Business Hours Ladder</Text>
            
            {bhLadder && (
              <View className="gap-2">
                {bhLadder.steps.map((step: string, index: number) => (
                  <View
                    key={index}
                    className="flex-row items-center gap-3 bg-background rounded-lg p-4 border border-border"
                  >
                    <View
                      className="w-8 h-8 rounded-full items-center justify-center"
                      style={{ backgroundColor: `${colors.primary}20` }}
                    >
                      <Text className="text-sm font-bold" style={{ color: colors.primary }}>
                        {index + 1}
                      </Text>
                    </View>
                    <Text className="flex-1 text-base text-foreground">
                      {step.replace(/_/g, " ").toUpperCase()}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* After Hours Ladder */}
          <View className="bg-surface rounded-2xl p-6 border border-border gap-4">
            <Text className="text-lg font-bold text-foreground">After Hours Ladder</Text>
            
            {ahLadder && (
              <View className="gap-2">
                {ahLadder.steps.map((step: string, index: number) => (
                  <View
                    key={index}
                    className="flex-row items-center gap-3 bg-background rounded-lg p-4 border border-border"
                  >
                    <View
                      className="w-8 h-8 rounded-full items-center justify-center"
                      style={{ backgroundColor: `${colors.warning}20` }}
                    >
                      <Text className="text-sm font-bold" style={{ color: colors.warning }}>
                        {index + 1}
                      </Text>
                    </View>
                    <Text className="flex-1 text-base text-foreground">
                      {step.replace(/_/g, " ").toUpperCase()}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Logout Section */}
          <View className="gap-4">
            <Text className="text-xl font-bold text-foreground">Account</Text>
            <TouchableOpacity
              onPress={() => {
                Alert.alert(
                  "Logout",
                  "Are you sure you want to logout?",
                  [
                    { text: "Cancel", style: "cancel" },
                  {
                    text: "Logout",
                    style: "destructive",
                    onPress: handleLogout,
                  },
                  ],
                );
              }}
              className="bg-error/10 border border-error rounded-2xl p-6"
            >
              <Text className="text-error font-semibold text-center text-lg">Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
