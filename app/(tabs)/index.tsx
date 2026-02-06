import { ScrollView, Text, View, TouchableOpacity, Switch, RefreshControl } from "react-native";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { router } from "expo-router";
import { useAuth } from "@/lib/auth-context";

export default function HomeScreen() {
  const colors = useColors();
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  // Fetch current user (only when authenticated)
  const { data: currentUser, error: userError, refetch: refetchUser } = trpc.users.getMe.useQuery(undefined, {
    enabled: !authLoading && isAuthenticated,
  });

  // Fetch user's incidents (only when authenticated)
  const { data: incidents = [], error: incidentsError, refetch: refetchIncidents } = trpc.incidents.getMyIncidents.useQuery(undefined, {
    enabled: !authLoading && isAuthenticated,
  });

  // Log errors to console and screen
  if (userError) {
    console.error("[Home] Error fetching user:", userError);
  }
  if (incidentsError) {
    console.error("[Home] Error fetching incidents:", incidentsError);
  }

  // Update availability mutation
  const updateAvailability = trpc.users.updateAvailability.useMutation({
    onSuccess: () => {
      refetchUser();
    },
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchUser(), refetchIncidents()]);
    setRefreshing(false);
  };

  const handleAvailabilityToggle = (value: boolean) => {
    updateAvailability.mutate({ available: value });
  };

  const openIncidents = incidents.filter(
    (i) => i.status === "open" || i.status === "en_route" || i.status === "on_site"
  );
  const resolvedIncidents = incidents.filter(
    (i) => i.status === "resolved" || i.status === "follow_up_required"
  );

  return (
    <ScreenContainer className="bg-background">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <View className="flex-1 p-6 gap-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">
              {currentUser?.name || "Welcome"}
            </Text>
            <Text className="text-base text-muted">
              {currentUser?.role === "tech" ? "Technician" : currentUser?.role?.toUpperCase()}
            </Text>
          </View>

          {/* Availability Toggle */}
          <View className="bg-surface rounded-2xl p-6 border border-border">
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-lg font-semibold text-foreground mb-1">Availability</Text>
                <Text className="text-sm text-muted">
                  {currentUser?.available ? "You are available for calls" : "You are unavailable"}
                </Text>
              </View>
              <Switch
                value={currentUser?.available || false}
                onValueChange={handleAvailabilityToggle}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.background}
              />
            </View>
          </View>

          {/* Error Display */}
          {(userError || incidentsError) && (
            <View className="bg-error/10 border border-error rounded-2xl p-4">
              <Text className="text-error font-semibold mb-2">⚠️ Error Loading Data</Text>
              {userError && (
                <Text className="text-error text-sm mb-1">User: {userError.message}</Text>
              )}
              {incidentsError && (
                <Text className="text-error text-sm">Incidents: {incidentsError.message}</Text>
              )}
            </View>
          )}

          {/* Active Incidents */}
          <View className="gap-4">
            <Text className="text-xl font-bold text-foreground">Active Incidents</Text>
            {openIncidents.length === 0 ? (
              <View className="bg-surface rounded-2xl p-6 border border-border">
                <Text className="text-center text-muted">No active incidents</Text>
              </View>
            ) : (
              openIncidents.map((incident) => (
                <TouchableOpacity
                  key={incident.id}
                  className="bg-surface rounded-2xl p-6 border border-border active:opacity-70"
                  onPress={() => router.push(`/incident/${incident.id}` as any)}
                >
                  <View className="flex-row items-center justify-between mb-3">
                    <View className="flex-row items-center gap-2">
                      <View
                        className="w-3 h-3 rounded-full"
                        style={{
                          backgroundColor:
                            incident.status === "open"
                              ? colors.error
                              : incident.status === "en_route"
                              ? colors.warning
                              : colors.primary,
                        }}
                      />
                      <Text className="text-sm font-semibold text-foreground uppercase">
                        {incident.status.replace("_", " ")}
                      </Text>
                    </View>
                    <Text className="text-xs text-muted">
                      {new Date(incident.createdAt).toLocaleTimeString()}
                    </Text>
                  </View>

                  <Text className="text-base font-semibold text-foreground mb-2">
                    Incident #{incident.id}
                  </Text>

                  {incident.callerId && (
                    <Text className="text-sm text-muted mb-1">Caller: {incident.callerId}</Text>
                  )}

                  {incident.critical && (
                    <View className="mt-2 bg-error/10 rounded-lg px-3 py-2">
                      <Text className="text-sm font-semibold" style={{ color: colors.error }}>
                        ⚠️ CRITICAL
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* Recent Resolved */}
          {resolvedIncidents.length > 0 && (
            <View className="gap-4">
              <Text className="text-xl font-bold text-foreground">Recently Resolved</Text>
              {resolvedIncidents.slice(0, 3).map((incident) => (
                <TouchableOpacity
                  key={incident.id}
                  className="bg-surface rounded-2xl p-6 border border-border active:opacity-70"
                  onPress={() => router.push(`/incident/${incident.id}` as any)}
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-base font-semibold text-foreground">
                      Incident #{incident.id}
                    </Text>
                    <View className="flex-row items-center gap-2">
                      <View className="w-3 h-3 rounded-full bg-success" />
                      <Text className="text-xs text-muted">Resolved</Text>
                    </View>
                  </View>
                  <Text className="text-sm text-muted">
                    {new Date(incident.resolvedAt!).toLocaleString()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
