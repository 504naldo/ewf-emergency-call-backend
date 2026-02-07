import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Share,
} from "react-native";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

interface ReportData {
  site?: string;
  address?: string;
  issueType?: string;
  description?: string;
  actionsTaken?: string;
  partsUsed?: string;
  photos?: string[];
  status?: "resolved" | "temporary" | "follow_up";
  followUpNotes?: string;
  arrivalTime?: string;
  departTime?: string;
  billableHours?: number;
  techSignature?: string;
  customerSignature?: string;
}

interface IncidentReportFormProps {
  incidentId: number;
  incidentNumber?: number;
  siteName?: string;
  onSaved?: () => void;
}

export function IncidentReportForm({ incidentId, incidentNumber, siteName, onSaved }: IncidentReportFormProps) {
  const colors = useColors();
  const [formData, setFormData] = useState<ReportData>({
    status: "resolved",
  });
  const [isSaving, setIsSaving] = useState(false);

  // Fetch existing report
  const { data: existingReport, isLoading, refetch } = trpc.reports.getByIncident.useQuery({
    incidentId,
  });

  // Mutations
  const upsertDraftMutation = trpc.reports.upsertDraft.useMutation({
    onSuccess: () => {
      refetch();
      onSaved?.();
      Alert.alert("Success", "Draft saved successfully");
    },
    onError: (error) => {
      Alert.alert("Error", error.message);
    },
  });

  const submitMutation = trpc.reports.submit.useMutation({
    onSuccess: () => {
      refetch();
      onSaved?.();
      Alert.alert("Success", "Report submitted successfully");
    },
    onError: (error) => {
      Alert.alert("Error", error.message);
    },
  });

  // Load existing report data
  useEffect(() => {
    if (existingReport?.jsonData) {
      setFormData(existingReport.jsonData);
    }
  }, [existingReport]);

  const isSubmitted = existingReport?.status === "submitted";
  const isReadOnly = isSubmitted;

  const handleSaveDraft = () => {
    setIsSaving(true);
    upsertDraftMutation.mutate({
      incidentId,
      data: formData,
    });
    setIsSaving(false);
  };

  const handleSubmit = () => {
    // Validate required fields
    if (!formData.description || !formData.actionsTaken) {
      Alert.alert("Validation Error", "Description and Actions Taken are required");
      return;
    }

    Alert.alert(
      "Confirm Submission",
      "Once submitted, the report cannot be edited. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Submit",
          style: "default",
          onPress: () => {
            setIsSaving(true);
            submitMutation.mutate({
              incidentId,
              data: formData,
            });
            setIsSaving(false);
          },
        },
      ]
    );
  };

  const handleShareSummary = async () => {
    const summary = generateReportSummary();
    try {
      await Share.share({
        message: summary,
        title: `Incident Report #${incidentNumber || incidentId}`,
      });
    } catch (error) {
      console.error("Error sharing report:", error);
    }
  };

  const generateReportSummary = (): string => {
    const lines: string[] = [];
    lines.push(`INCIDENT REPORT #${incidentNumber || incidentId}`);
    lines.push(`=`.repeat(50));
    lines.push("");

    if (siteName || formData.site) {
      lines.push(`Site: ${siteName || formData.site}`);
    }
    if (formData.address) {
      lines.push(`Address: ${formData.address}`);
    }
    if (formData.issueType) {
      lines.push(`Issue Type: ${formData.issueType}`);
    }
    lines.push("");

    if (formData.description) {
      lines.push("DESCRIPTION:");
      lines.push(formData.description);
      lines.push("");
    }

    if (formData.actionsTaken) {
      lines.push("ACTIONS TAKEN:");
      lines.push(formData.actionsTaken);
      lines.push("");
    }

    if (formData.partsUsed) {
      lines.push("PARTS USED:");
      lines.push(formData.partsUsed);
      lines.push("");
    }

    if (formData.arrivalTime) {
      lines.push(`Arrival Time: ${new Date(formData.arrivalTime).toLocaleString()}`);
    }
    if (formData.departTime) {
      lines.push(`Depart Time: ${new Date(formData.departTime).toLocaleString()}`);
    }
    if (formData.billableHours !== undefined) {
      lines.push(`Billable Hours: ${formData.billableHours.toFixed(2)} hours`);
    }
    lines.push("");

    if (formData.status) {
      const statusText =
        formData.status === "resolved"
          ? "Resolved"
          : formData.status === "temporary"
          ? "Temporary Fix"
          : "Follow-up Required";
      lines.push(`Status: ${statusText}`);
    }

    if (formData.followUpNotes) {
      lines.push("");
      lines.push("FOLLOW-UP NOTES:");
      lines.push(formData.followUpNotes);
    }

    if (existingReport?.status === "submitted" && existingReport.updatedAt) {
      lines.push("");
      lines.push(`Submitted: ${new Date(existingReport.updatedAt).toLocaleString()}`);
    }

    return lines.join("\n");
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center p-6">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <View className="flex-1 p-6 gap-4">
        {/* Status Badge */}
        {isSubmitted && (
          <View className="bg-success/10 rounded-2xl p-4 border border-success">
            <Text className="text-sm font-bold" style={{ color: colors.success }}>
              ✓ Report Submitted
            </Text>
            <Text className="text-xs text-muted mt-1">
              Submitted on {new Date(existingReport.updatedAt).toLocaleString()}
            </Text>
          </View>
        )}

        {/* Site/Address */}
        <View className="gap-2">
          <Text className="text-sm font-semibold text-foreground">Site/Address</Text>
          <TextInput
            className={cn(
              "bg-surface rounded-xl p-4 text-base text-foreground border border-border",
              isReadOnly && "opacity-60"
            )}
            placeholder="Enter site or address"
            placeholderTextColor={colors.muted}
            value={formData.site || ""}
            onChangeText={(text) => setFormData({ ...formData, site: text })}
            editable={!isReadOnly}
          />
        </View>

        {/* Issue Type */}
        <View className="gap-2">
          <Text className="text-sm font-semibold text-foreground">Issue Type</Text>
          <TextInput
            className={cn(
              "bg-surface rounded-xl p-4 text-base text-foreground border border-border",
              isReadOnly && "opacity-60"
            )}
            placeholder="e.g., Fire alarm, Panel trouble"
            placeholderTextColor={colors.muted}
            value={formData.issueType || ""}
            onChangeText={(text) => setFormData({ ...formData, issueType: text })}
            editable={!isReadOnly}
          />
        </View>

        {/* Description */}
        <View className="gap-2">
          <Text className="text-sm font-semibold text-foreground">
            Description <Text className="text-error">*</Text>
          </Text>
          <TextInput
            className={cn(
              "bg-surface rounded-xl p-4 text-base text-foreground border border-border",
              isReadOnly && "opacity-60"
            )}
            placeholder="Describe the issue"
            placeholderTextColor={colors.muted}
            value={formData.description || ""}
            onChangeText={(text) => setFormData({ ...formData, description: text })}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            editable={!isReadOnly}
          />
        </View>

        {/* Actions Taken */}
        <View className="gap-2">
          <Text className="text-sm font-semibold text-foreground">
            Actions Taken <Text className="text-error">*</Text>
          </Text>
          <TextInput
            className={cn(
              "bg-surface rounded-xl p-4 text-base text-foreground border border-border",
              isReadOnly && "opacity-60"
            )}
            placeholder="Describe actions taken to resolve the issue"
            placeholderTextColor={colors.muted}
            value={formData.actionsTaken || ""}
            onChangeText={(text) => setFormData({ ...formData, actionsTaken: text })}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            editable={!isReadOnly}
          />
        </View>

        {/* Arrival Time */}
        <View className="gap-2">
          <Text className="text-sm font-semibold text-foreground">Arrival Time</Text>
          <TouchableOpacity
            className={cn(
              "bg-surface rounded-xl p-4 border border-border",
              isReadOnly && "opacity-60"
            )}
            onPress={() => {
              if (!isReadOnly) {
                const now = new Date();
                setFormData({ ...formData, arrivalTime: now.toISOString() });
              }
            }}
            disabled={isReadOnly}
          >
            <Text className="text-base text-foreground">
              {formData.arrivalTime
                ? new Date(formData.arrivalTime).toLocaleString()
                : "Tap to set arrival time"}
            </Text>
          </TouchableOpacity>
          {formData.arrivalTime && !isReadOnly && (
            <TouchableOpacity
              className="self-end"
              onPress={() => setFormData({ ...formData, arrivalTime: undefined, billableHours: undefined })}
            >
              <Text className="text-sm text-error">Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Depart Time */}
        <View className="gap-2">
          <Text className="text-sm font-semibold text-foreground">Depart Time</Text>
          <TouchableOpacity
            className={cn(
              "bg-surface rounded-xl p-4 border border-border",
              isReadOnly && "opacity-60"
            )}
            onPress={() => {
              if (!isReadOnly) {
                const now = new Date();
                setFormData({ ...formData, departTime: now.toISOString() });
                // Auto-calculate billable hours if arrival time is set
                if (formData.arrivalTime) {
                  const arrival = new Date(formData.arrivalTime);
                  const depart = now;
                  const hours = (depart.getTime() - arrival.getTime()) / (1000 * 60 * 60);
                  setFormData((prev) => ({
                    ...prev,
                    departTime: now.toISOString(),
                    billableHours: Math.round(hours * 100) / 100,
                  }));
                }
              }
            }}
            disabled={isReadOnly}
          >
            <Text className="text-base text-foreground">
              {formData.departTime
                ? new Date(formData.departTime).toLocaleString()
                : "Tap to set depart time"}
            </Text>
          </TouchableOpacity>
          {formData.departTime && !isReadOnly && (
            <TouchableOpacity
              className="self-end"
              onPress={() => setFormData({ ...formData, departTime: undefined, billableHours: undefined })}
            >
              <Text className="text-sm text-error">Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Billable Hours */}
        {formData.billableHours !== undefined && (
          <View className="bg-primary/10 rounded-xl p-4 border border-primary">
            <Text className="text-sm font-semibold text-foreground mb-1">Billable Hours</Text>
            <Text className="text-2xl font-bold text-primary">
              {formData.billableHours.toFixed(2)} hours
            </Text>
          </View>
        )}

        {/* Parts Used */}
        <View className="gap-2">
          <Text className="text-sm font-semibold text-foreground">Parts Used (Optional)</Text>
          <TextInput
            className={cn(
              "bg-surface rounded-xl p-4 text-base text-foreground border border-border",
              isReadOnly && "opacity-60"
            )}
            placeholder="List any parts used"
            placeholderTextColor={colors.muted}
            value={formData.partsUsed || ""}
            onChangeText={(text) => setFormData({ ...formData, partsUsed: text })}
            multiline
            numberOfLines={2}
            textAlignVertical="top"
            editable={!isReadOnly}
          />
        </View>

        {/* Status */}
        <View className="gap-2">
          <Text className="text-sm font-semibold text-foreground">Status</Text>
          <View className="flex-row gap-2">
            {(["resolved", "temporary", "follow_up"] as const).map((status) => (
              <TouchableOpacity
                key={status}
                className={cn(
                  "flex-1 rounded-xl p-3 border",
                  formData.status === status
                    ? "bg-primary/10 border-primary"
                    : "bg-surface border-border"
                )}
                onPress={() => !isReadOnly && setFormData({ ...formData, status })}
                disabled={isReadOnly}
              >
                <Text
                  className={cn(
                    "text-center text-sm font-semibold",
                    formData.status === status ? "text-primary" : "text-foreground"
                  )}
                >
                  {status === "resolved"
                    ? "Resolved"
                    : status === "temporary"
                    ? "Temporary"
                    : "Follow-up"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Follow-up Notes */}
        {formData.status === "follow_up" && (
          <View className="gap-2">
            <Text className="text-sm font-semibold text-foreground">Follow-up Notes</Text>
            <TextInput
              className={cn(
                "bg-surface rounded-xl p-4 text-base text-foreground border border-border",
                isReadOnly && "opacity-60"
              )}
              placeholder="Describe what follow-up is needed"
              placeholderTextColor={colors.muted}
              value={formData.followUpNotes || ""}
              onChangeText={(text) => setFormData({ ...formData, followUpNotes: text })}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              editable={!isReadOnly}
            />
          </View>
        )}

        {/* Action Buttons */}
        {!isReadOnly && (
          <View className="gap-3 mt-4">
            <TouchableOpacity
              className="bg-surface rounded-2xl p-4 border border-border active:opacity-70"
              onPress={handleSaveDraft}
              disabled={isSaving || upsertDraftMutation.isPending}
            >
              <Text className="text-center text-base font-semibold text-foreground">
                {isSaving || upsertDraftMutation.isPending ? "Saving..." : "Save Draft"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="bg-primary rounded-2xl p-4 active:opacity-80"
              onPress={handleSubmit}
              disabled={isSaving || submitMutation.isPending}
            >
              <Text className="text-center text-base font-bold text-background">
                {isSaving || submitMutation.isPending ? "Submitting..." : "Submit Report"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Share Summary Button */}
        {(isSubmitted || formData.description) && (
          <TouchableOpacity
            className="bg-surface rounded-2xl p-4 border border-border active:opacity-70 mt-4"
            onPress={handleShareSummary}
          >
            <Text className="text-center text-base font-semibold text-foreground">
              📤 Share Summary
            </Text>
          </TouchableOpacity>
        )}

        {/* Submitted Note */}
        {isSubmitted && (
          <View className="bg-muted/10 rounded-xl p-4 mt-2">
            <Text className="text-sm text-muted text-center">
              This report has been submitted and cannot be edited.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
