import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Switch } from "react-native";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";

export default function TechniciansScreen() {
  const colors = useColors();
  const [refreshing, setRefreshing] = useState(false);

  // Fetch current user
  const { data: currentUser } = trpc.users.getMe.useQuery();

  // Fetch all techs
  const { data: techs = [], refetch } = trpc.users.getAllTechs.useQuery();

  // Toggle availability mutation
  const toggleAvailabilityMutation = trpc.users.toggleAvailability.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleToggleAvailability = (userId: number, currentAvailability: boolean) => {
    toggleAvailabilityMutation.mutate({
      userId,
      available: !currentAvailability,
    });
  };

  // Check if user is admin or manager
  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "manager";

  if (!isAdmin) {
    return (
      <ScreenContainer className="bg-background">
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-xl font-bold text-foreground mb-2">Access Denied</Text>
          <Text className="text-center text-muted">
            This section is only available to administrators and managers.
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="bg-background">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <View className="flex-1 p-6 gap-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">Technicians</Text>
            <Text className="text-base text-muted">Manage technician availability</Text>
          </View>

          {/* Stats */}
          <View className="flex-row gap-3">
            <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
              <Text className="text-2xl font-bold text-foreground">{techs.length}</Text>
              <Text className="text-sm text-muted">Total</Text>
            </View>
            <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
              <Text className="text-2xl font-bold text-success">
                {techs.filter((t: any) => t.available).length}
              </Text>
              <Text className="text-sm text-muted">Available</Text>
            </View>
            <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
              <Text className="text-2xl font-bold text-error">
                {techs.filter((t: any) => !t.available).length}
              </Text>
              <Text className="text-sm text-muted">Unavailable</Text>
            </View>
          </View>

          {/* Technicians List */}
          <View className="gap-4">
            <Text className="text-lg font-bold text-foreground">All Technicians</Text>
            {techs.map((tech: any) => (
              <View
                key={tech.id}
                className="bg-surface rounded-2xl p-4 border border-border"
              >
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-1">
                    <Text className="text-lg font-semibold text-foreground">{tech.name}</Text>
                    <Text className="text-sm text-muted">{tech.email}</Text>
                    {tech.phone && (
                      <Text className="text-sm text-muted mt-1">{tech.phone}</Text>
                    )}
                  </View>
                  <View
                    className="px-3 py-1 rounded-full"
                    style={{
                      backgroundColor: tech.available
                        ? `${colors.success}20`
                        : `${colors.error}20`,
                    }}
                  >
                    <Text
                      className="text-xs font-semibold"
                      style={{
                        color: tech.available ? colors.success : colors.error,
                      }}
                    >
                      {tech.available ? "Available" : "Unavailable"}
                    </Text>
                  </View>
                </View>

                {/* Availability Toggle */}
                <View className="flex-row items-center justify-between pt-3 border-t border-border">
                  <Text className="text-sm text-foreground">Availability</Text>
                  <Switch
                    value={tech.available}
                    onValueChange={() => handleToggleAvailability(tech.id, tech.available)}
                    trackColor={{ false: colors.border, true: colors.success }}
                    thumbColor={tech.available ? colors.background : colors.muted}
                    disabled={toggleAvailabilityMutation.isPending}
                  />
                </View>

                {/* Active Status */}
                {!tech.active && (
                  <View className="mt-3 pt-3 border-t border-border">
                    <Text className="text-xs text-error">⚠️ Account inactive</Text>
                  </View>
                )}
              </View>
            ))}

            {techs.length === 0 && (
              <View className="bg-surface rounded-2xl p-6 border border-border items-center">
                <Text className="text-muted">No technicians found</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
