import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { IncidentReportForm } from "@/components/incident-report-form";
import { useState } from "react";

export default function IncidentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const [showReport, setShowReport] = useState(false);

  const incidentId = parseInt(id || "0");

  // Fetch current user
  const { data: currentUser } = trpc.users.getMe.useQuery();

  // Fetch incident details
  const { data, isLoading, refetch } = trpc.incidents.getDetails.useQuery({ id: incidentId });

  // Mutations
  const acceptMutation = trpc.incidents.accept.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const updateStatusMutation = trpc.incidents.updateStatus.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const closeMutation = trpc.incidents.close.useMutation({
    onSuccess: () => {
      router.back();
    },
  });

  if (isLoading || !data) {
    return (
      <ScreenContainer className="bg-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  const { incident, site, assignedUser, callAttempts, events } = data;

  const handleAccept = () => {
    acceptMutation.mutate({ incidentId });
  };

  const handleStatusUpdate = (status: "en_route" | "on_site" | "resolved") => {
    updateStatusMutation.mutate({ incidentId, status });
  };

  const handleClose = (outcome: "nuisance" | "device_issue" | "panel_trouble" | "unknown" | "other") => {
    closeMutation.mutate({
      incidentId,
      outcome,
      outcomeNotes: "",
      followUpRequired: false,
    });
  };

  // Show report form if toggled
  if (showReport) {
    return (
      <ScreenContainer edges={["top", "left", "right"]} className="bg-background">
        <View className="flex-1">
          {/* Header with back button */}
          <View className="p-4 border-b border-border">
            <TouchableOpacity
              className="flex-row items-center gap-2 active:opacity-70"
              onPress={() => setShowReport(false)}
            >
              <Text className="text-base text-primary">← Back to Incident</Text>
            </TouchableOpacity>
            <Text className="text-2xl font-bold text-foreground mt-2">Incident Report</Text>
          </View>
          <IncidentReportForm
            incidentId={incidentId}
            incidentNumber={incident.id}
            siteName={site?.name}
            onSaved={() => refetch()}
          />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["top", "left", "right"]} className="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 p-6 gap-6">
          {/* Header */}
          <View className="gap-2">
            <View className="flex-row items-center justify-between">
              <Text className="text-3xl font-bold text-foreground">Incident #{incident.id}</Text>
              <View
                className="px-4 py-2 rounded-full"
                style={{
                  backgroundColor:
                    incident.status === "open"
                      ? `${colors.error}20`
                      : incident.status === "resolved"
                      ? `${colors.success}20`
                      : `${colors.warning}20`,
                }}
              >
                <Text
                  className="text-sm font-semibold uppercase"
                  style={{
                    color:
                      incident.status === "open"
                        ? colors.error
                        : incident.status === "resolved"
                        ? colors.success
                        : colors.warning,
                  }}
                >
                  {incident.status.replace("_", " ")}
                </Text>
              </View>
            </View>
            <Text className="text-sm text-muted">
              Created: {new Date(incident.createdAt).toLocaleString()}
            </Text>
          </View>

          {/* Critical Alert */}
          {incident.critical && (
            <View className="bg-error/10 rounded-2xl p-6 border-2 border-error">
              <Text className="text-lg font-bold" style={{ color: colors.error }}>
                ⚠️ CRITICAL INCIDENT
              </Text>
              <Text className="text-sm mt-2" style={{ color: colors.error }}>
                This incident went unanswered through the entire escalation ladder
              </Text>
            </View>
          )}

          {/* Incident Details */}
          <View className="bg-surface rounded-2xl p-6 border border-border gap-4">
            <Text className="text-lg font-bold text-foreground">Details</Text>

            {incident.callerId && (
              <View>
                <Text className="text-sm text-muted mb-1">Caller ID</Text>
                <Text className="text-base text-foreground">{incident.callerId}</Text>
              </View>
            )}

            {site && (
              <View>
                <Text className="text-sm text-muted mb-1">Site</Text>
                <Text className="text-base font-semibold text-foreground">{site.name}</Text>
                <Text className="text-sm text-muted">{site.address}</Text>
              </View>
            )}

            {assignedUser && (
              <View>
                <Text className="text-sm text-muted mb-1">Assigned To</Text>
                <Text className="text-base text-foreground">{assignedUser.name}</Text>
              </View>
            )}

            <View>
              <Text className="text-sm text-muted mb-1">Time Period</Text>
              <Text className="text-base text-foreground">
                {incident.bhAh === "business_hours" ? "Business Hours" : "After Hours"}
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          {incident.status === "open" && !incident.assignedUserId && (
            <TouchableOpacity
              className="bg-primary rounded-2xl p-4 active:opacity-80"
              onPress={handleAccept}
              disabled={acceptMutation.isPending}
            >
              <Text className="text-center text-lg font-bold text-background">
                {acceptMutation.isPending ? "Accepting..." : "Accept Incident"}
              </Text>
            </TouchableOpacity>
          )}

          {incident.assignedUserId && incident.status === "open" && (
            <View className="gap-3">
              <TouchableOpacity
                className="bg-primary rounded-2xl p-4 active:opacity-80"
                onPress={() => handleStatusUpdate("en_route")}
                disabled={updateStatusMutation.isPending}
              >
                <Text className="text-center text-lg font-bold text-background">En Route</Text>
              </TouchableOpacity>
            </View>
          )}

          {incident.status === "en_route" && (
            <View className="gap-3">
              <TouchableOpacity
                className="bg-primary rounded-2xl p-4 active:opacity-80"
                onPress={() => handleStatusUpdate("on_site")}
                disabled={updateStatusMutation.isPending}
              >
                <Text className="text-center text-lg font-bold text-background">On Site</Text>
              </TouchableOpacity>
            </View>
          )}

          {incident.status === "on_site" && (
            <View className="gap-3">
              <Text className="text-lg font-bold text-foreground">Close Incident</Text>
              <TouchableOpacity
                className="bg-surface rounded-2xl p-4 border border-border active:opacity-70"
                onPress={() => handleClose("device_issue")}
                disabled={closeMutation.isPending}
              >
                <Text className="text-center text-base font-semibold text-foreground">
                  Device Issue
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="bg-surface rounded-2xl p-4 border border-border active:opacity-70"
                onPress={() => handleClose("panel_trouble")}
                disabled={closeMutation.isPending}
              >
                <Text className="text-center text-base font-semibold text-foreground">
                  Panel Trouble
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="bg-surface rounded-2xl p-4 border border-border active:opacity-70"
                onPress={() => handleClose("nuisance")}
                disabled={closeMutation.isPending}
              >
                <Text className="text-center text-base font-semibold text-foreground">
                  Nuisance Call
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="bg-surface rounded-2xl p-4 border border-border active:opacity-70"
                onPress={() => handleClose("other")}
                disabled={closeMutation.isPending}
              >
                <Text className="text-center text-base font-semibold text-foreground">Other</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Call Attempts */}
          {callAttempts.length > 0 && (
            <View className="gap-4">
              <Text className="text-lg font-bold text-foreground">Call Attempts</Text>
              {callAttempts.map((attempt) => (
                <View
                  key={attempt.id}
                  className="bg-surface rounded-2xl p-4 border border-border"
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-sm font-semibold text-foreground">
                      Step {attempt.step + 1}
                    </Text>
                    <Text className="text-xs text-muted">
                      {new Date(attempt.startedAt).toLocaleTimeString()}
                    </Text>
                  </View>
                  <Text className="text-sm text-muted">
                    Result: {attempt.result || "Pending"}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Report Button */}
          {(incident.assignedUserId || currentUser?.role === "admin" || currentUser?.role === "manager") && (
            <TouchableOpacity
              className="bg-surface rounded-2xl p-4 border-2 border-primary active:opacity-70"
              onPress={() => setShowReport(true)}
            >
              <Text className="text-center text-base font-bold text-primary">📋 View/Create Report</Text>
            </TouchableOpacity>
          )}

          {/* Timeline */}
          {events.length > 0 && (
            <View className="gap-4">
              <Text className="text-lg font-bold text-foreground">Timeline</Text>
              {events.map((event) => (
                <View key={event.id} className="flex-row gap-3">
                  <View className="w-3 h-3 rounded-full bg-primary mt-1" />
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-foreground">
                      {event.type.replace(/_/g, " ").toUpperCase()}
                    </Text>
                    <Text className="text-xs text-muted">
                      {new Date(event.at).toLocaleString()}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
