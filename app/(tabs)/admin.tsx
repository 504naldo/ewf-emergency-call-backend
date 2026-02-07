import { ScrollView, Text, View, TouchableOpacity, RefreshControl, ActivityIndicator } from "react-native";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { CreateIncidentModal } from "@/components/create-incident-modal";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { router } from "expo-router";

export default function AdminBoardScreen() {
  const colors = useColors();
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Fetch current user
  const { data: currentUser, error: userError } = trpc.users.getMe.useQuery();

  // Fetch all open incidents
  const { data: openIncidents = [], error: openError, refetch: refetchOpen } = trpc.incidents.getAllOpen.useQuery();

  // Fetch unclaimed incidents
  const { data: unclaimedIncidents = [], error: unclaimedError, refetch: refetchUnclaimed } = trpc.incidents.getUnclaimed.useQuery();

  // Fetch all techs
  const { data: techs = [], error: techsError, refetch: refetchTechs } = trpc.users.getAllTechs.useQuery();

  // Log errors to console
  if (userError) console.error("[Admin] Error fetching user:", userError);
  if (openError) console.error("[Admin] Error fetching open incidents:", openError);
  if (unclaimedError) console.error("[Admin] Error fetching unclaimed incidents:", unclaimedError);
  if (techsError) console.error("[Admin] Error fetching techs:", techsError);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchOpen(), refetchUnclaimed(), refetchTechs()]);
    setRefreshing(false);
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

  const calculateSLA = (createdAt: Date) => {
    const now = new Date();
    const elapsed = Math.floor((now.getTime() - new Date(createdAt).getTime()) / 1000 / 60);
    return elapsed;
  };

  const getSLAColor = (minutes: number) => {
    if (minutes < 5) return colors.success;
    if (minutes < 15) return colors.warning;
    return colors.error;
  };

  return (
    <ScreenContainer className="bg-background">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <View className="flex-1 p-6 gap-6">
          {/* Header */}
          <View className="gap-2">
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-3xl font-bold text-foreground">Admin Board</Text>
                <Text className="text-base text-muted">Real-time incident monitoring</Text>
              </View>
              <TouchableOpacity
                className="rounded-xl px-4 py-3 active:opacity-70"
                style={{ backgroundColor: colors.primary }}
                onPress={() => setShowCreateModal(true)}
              >
                <Text className="font-bold" style={{ color: colors.background }}>
                  + Create
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Error Display */}
          {(userError || openError || unclaimedError || techsError) && (
            <View className="bg-error/10 border border-error rounded-2xl p-4">
              <Text className="text-error font-semibold mb-2">⚠️ Error Loading Data</Text>
              {userError && <Text className="text-error text-sm mb-1">User: {userError.message}</Text>}
              {openError && <Text className="text-error text-sm mb-1">Open Incidents: {openError.message}</Text>}
              {unclaimedError && <Text className="text-error text-sm mb-1">Unclaimed: {unclaimedError.message}</Text>}
              {techsError && <Text className="text-error text-sm">Techs: {techsError.message}</Text>}
            </View>
          )}

          {/* Stats */}
          <View className="flex-row gap-3">
            <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
              <Text className="text-2xl font-bold text-foreground">{openIncidents.length}</Text>
              <Text className="text-sm text-muted">Open</Text>
            </View>
            <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
              <Text className="text-2xl font-bold text-error">{unclaimedIncidents.length}</Text>
              <Text className="text-sm text-muted">Unclaimed</Text>
            </View>
            <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
              <Text className="text-2xl font-bold text-success">
                {techs.filter((t: any) => t.available).length}
              </Text>
              <Text className="text-sm text-muted">Available</Text>
            </View>
          </View>

          {/* Unclaimed Incidents (Priority) */}
          {unclaimedIncidents.length > 0 && (
            <View className="gap-4">
              <View className="flex-row items-center justify-between">
                <Text className="text-xl font-bold text-foreground">Unclaimed Incidents</Text>
                <View className="bg-error/10 px-3 py-1 rounded-full">
                  <Text className="text-sm font-bold" style={{ color: colors.error }}>
                    URGENT
                  </Text>
                </View>
              </View>
              {unclaimedIncidents.map((incident) => {
                const slaMinutes = calculateSLA(incident.createdAt);
                const slaColor = getSLAColor(slaMinutes);
                return (
                  <TouchableOpacity
                    key={incident.id}
                    className="bg-surface rounded-2xl p-6 border-2 active:opacity-70"
                    style={{ borderColor: colors.error }}
                    onPress={() => router.push(`/incident/${incident.id}` as any)}
                  >
                    <View className="flex-row items-center justify-between mb-3">
                      <Text className="text-lg font-bold text-foreground">
                        Incident #{incident.id}
                      </Text>
                      <View
                        className="px-3 py-1 rounded-full"
                        style={{ backgroundColor: `${slaColor}20` }}
                      >
                        <Text className="text-sm font-bold" style={{ color: slaColor }}>
                          {slaMinutes}m
                        </Text>
                      </View>
                    </View>

                    {incident.callerId && (
                      <Text className="text-sm text-muted mb-1">Caller: {incident.callerId}</Text>
                    )}

                    <Text className="text-xs text-muted">
                      {new Date(incident.createdAt).toLocaleString()}
                    </Text>

                    {incident.critical && (
                      <View className="mt-3 bg-error/10 rounded-lg px-3 py-2">
                        <Text className="text-sm font-semibold" style={{ color: colors.error }}>
                          ⚠️ CRITICAL - Unanswered
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* All Open Incidents */}
          <View className="gap-4">
            <Text className="text-xl font-bold text-foreground">All Open Incidents</Text>
            {openIncidents.length === 0 ? (
              <View className="bg-surface rounded-2xl p-6 border border-border">
                <Text className="text-center text-muted">No open incidents</Text>
              </View>
            ) : (
              openIncidents.map((incident) => {
                const slaMinutes = calculateSLA(incident.createdAt);
                const slaColor = getSLAColor(slaMinutes);
                return (
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
                        <Text className="text-base font-semibold text-foreground">
                          Incident #{incident.id}
                        </Text>
                      </View>
                      <View
                        className="px-3 py-1 rounded-full"
                        style={{ backgroundColor: `${slaColor}20` }}
                      >
                        <Text className="text-sm font-bold" style={{ color: slaColor }}>
                          {slaMinutes}m
                        </Text>
                      </View>
                    </View>

                    <Text className="text-sm text-muted mb-1">
                      Status: {incident.status.replace("_", " ").toUpperCase()}
                    </Text>

                    {incident.callerId && (
                      <Text className="text-sm text-muted mb-1">Caller: {incident.callerId}</Text>
                    )}

                    {incident.assignedUserId && (
                      <Text className="text-sm text-muted mb-1">
                        Assigned: User #{incident.assignedUserId}
                      </Text>
                    )}

                    <Text className="text-xs text-muted">
                      {new Date(incident.createdAt).toLocaleString()}
                    </Text>
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          {/* Tech Availability */}
          <View className="gap-4">
            <Text className="text-xl font-bold text-foreground">Tech Availability</Text>
            {techs.map((tech: any) => (
              <View
                key={tech.id}
                className="bg-surface rounded-2xl p-4 border border-border flex-row items-center justify-between"
              >
                <View className="flex-1">
                  <Text className="text-base font-semibold text-foreground">{tech.name}</Text>
                  <Text className="text-sm text-muted">{tech.phone}</Text>
                </View>
                <View
                  className="px-3 py-1 rounded-full"
                  style={{
                    backgroundColor: tech.available ? `${colors.success}20` : `${colors.error}20`,
                  }}
                >
                  <Text
                    className="text-sm font-semibold"
                    style={{ color: tech.available ? colors.success : colors.error }}
                  >
                    {tech.available ? "Available" : "Unavailable"}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Create Incident Modal */}
      <CreateIncidentModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={(incidentId) => {
          handleRefresh();
          router.push(`/incident/${incidentId}` as any);
        }}
      />
    </ScreenContainer>
  );
}
