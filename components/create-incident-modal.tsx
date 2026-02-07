import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Switch,
} from "react-native";
import { useState } from "react";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

type CreateIncidentModalProps = {
  visible: boolean;
  onClose: () => void;
  onSuccess: (incidentId: number) => void;
};

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
] as const;

const INCIDENT_TYPE_OPTIONS = [
  "Fire Alarm",
  "Security Alarm",
  "HVAC Issue",
  "Electrical Issue",
  "Plumbing Issue",
  "Access Control",
  "Other",
];

export function CreateIncidentModal({ visible, onClose, onSuccess }: CreateIncidentModalProps) {
  const colors = useColors();
  const [buildingId, setBuildingId] = useState("");
  const [site, setSite] = useState("");
  const [incidentType, setIncidentType] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [callerName, setCallerName] = useState("");
  const [callerPhone, setCallerPhone] = useState("");
  const [assignedTechId, setAssignedTechId] = useState("");
  const [triggerRouting, setTriggerRouting] = useState(false);
  const [showIncidentTypePicker, setShowIncidentTypePicker] = useState(false);

  const createMutation = trpc.incidents.createManual.useMutation();
  const { data: techs = [] } = trpc.users.getAllTechs.useQuery();

  const resetForm = () => {
    setBuildingId("");
    setSite("");
    setIncidentType("");
    setDescription("");
    setPriority("medium");
    setCallerName("");
    setCallerPhone("");
    setAssignedTechId("");
    setTriggerRouting(false);
  };

  const handleSubmit = async () => {
    // Validation
    if (!buildingId.trim()) {
      Alert.alert("Validation Error", "Building ID is required");
      return;
    }
    if (!site.trim()) {
      Alert.alert("Validation Error", "Site/Address is required");
      return;
    }
    if (!incidentType.trim()) {
      Alert.alert("Validation Error", "Incident Type is required");
      return;
    }
    if (!description.trim()) {
      Alert.alert("Validation Error", "Description is required");
      return;
    }

    try {
      const result = await createMutation.mutateAsync({
        buildingId: buildingId.trim(),
        site: site.trim(),
        incidentType: incidentType.trim(),
        description: description.trim(),
        priority,
        callerName: callerName.trim() || undefined,
        callerPhone: callerPhone.trim() || undefined,
        assignedTechId: assignedTechId ? parseInt(assignedTechId) : undefined,
        triggerRouting,
      });

      Alert.alert("Success", `Incident #${result.incidentId} created successfully`);
      resetForm();
      onSuccess(result.incidentId);
      onClose();
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to create incident");
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 justify-end">
        <View
          className="rounded-t-3xl p-6 max-h-[90%]"
          style={{ backgroundColor: colors.background }}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between mb-6">
            <Text className="text-2xl font-bold text-foreground">Create Incident</Text>
            <TouchableOpacity onPress={onClose} className="p-2 active:opacity-70">
              <Text className="text-lg font-semibold text-muted">Cancel</Text>
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
            <View className="gap-4">
              {/* Building ID */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Building ID <Text className="text-error">*</Text>
                </Text>
                <TextInput
                  className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                  placeholder="e.g., BLD-001"
                  placeholderTextColor={colors.muted}
                  value={buildingId}
                  onChangeText={setBuildingId}
                  autoCapitalize="characters"
                />
              </View>

              {/* Site/Address */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Site/Address <Text className="text-error">*</Text>
                </Text>
                <TextInput
                  className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                  placeholder="e.g., 123 Main St, Suite 100"
                  placeholderTextColor={colors.muted}
                  value={site}
                  onChangeText={setSite}
                  multiline
                  numberOfLines={2}
                />
              </View>

              {/* Incident Type */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Incident Type <Text className="text-error">*</Text>
                </Text>
                {showIncidentTypePicker ? (
                  <View className="gap-2">
                    {INCIDENT_TYPE_OPTIONS.map((type) => (
                      <TouchableOpacity
                        key={type}
                        className="bg-surface border border-border rounded-xl px-4 py-3 active:opacity-70"
                        style={{
                          borderColor: incidentType === type ? colors.primary : colors.border,
                        }}
                        onPress={() => {
                          setIncidentType(type);
                          setShowIncidentTypePicker(false);
                        }}
                      >
                        <Text className="text-foreground">{type}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <TouchableOpacity
                    className="bg-surface border border-border rounded-xl px-4 py-3 active:opacity-70"
                    onPress={() => setShowIncidentTypePicker(true)}
                  >
                    <Text className={incidentType ? "text-foreground" : "text-muted"}>
                      {incidentType || "Select incident type"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Description */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Description <Text className="text-error">*</Text>
                </Text>
                <TextInput
                  className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                  placeholder="Describe the incident..."
                  placeholderTextColor={colors.muted}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              {/* Priority */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Priority <Text className="text-error">*</Text>
                </Text>
                <View className="flex-row gap-2">
                  {PRIORITY_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      className="flex-1 rounded-xl px-3 py-3 active:opacity-70"
                      style={{
                        backgroundColor:
                          priority === option.value ? colors.primary : colors.surface,
                        borderWidth: 1,
                        borderColor: priority === option.value ? colors.primary : colors.border,
                      }}
                      onPress={() => setPriority(option.value)}
                    >
                      <Text
                        className="text-center text-sm font-semibold"
                        style={{
                          color: priority === option.value ? colors.background : colors.foreground,
                        }}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Caller Name (Optional) */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">Caller Name</Text>
                <TextInput
                  className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                  placeholder="Optional"
                  placeholderTextColor={colors.muted}
                  value={callerName}
                  onChangeText={setCallerName}
                />
              </View>

              {/* Caller Phone (Optional) */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">Caller Phone</Text>
                <TextInput
                  className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                  placeholder="Optional"
                  placeholderTextColor={colors.muted}
                  value={callerPhone}
                  onChangeText={setCallerPhone}
                  keyboardType="phone-pad"
                />
              </View>

              {/* Assigned Tech (Optional) */}
              <View>
                <Text className="text-sm font-semibold text-foreground mb-2">Assign to Tech</Text>
                <View className="bg-surface border border-border rounded-xl overflow-hidden">
                  <TouchableOpacity
                    className="px-4 py-3 active:opacity-70"
                    onPress={() => setAssignedTechId("")}
                  >
                    <Text className={!assignedTechId ? "text-foreground" : "text-muted"}>
                      {!assignedTechId ? "Unassigned" : "Select a tech"}
                    </Text>
                  </TouchableOpacity>
                  {techs.map((tech: any) => (
                    <TouchableOpacity
                      key={tech.id}
                      className="px-4 py-3 border-t border-border active:opacity-70"
                      style={{
                        backgroundColor:
                          assignedTechId === String(tech.id) ? colors.primary + "20" : "transparent",
                      }}
                      onPress={() => setAssignedTechId(String(tech.id))}
                    >
                      <Text className="text-foreground">
                        {tech.name} {tech.available ? "✓" : "(Unavailable)"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Trigger Routing Checkbox */}
              {!assignedTechId && (
                <View className="bg-surface border border-border rounded-xl p-4">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1 pr-4">
                      <Text className="text-sm font-semibold text-foreground mb-1">
                        Trigger on-call routing immediately
                      </Text>
                      <Text className="text-xs text-muted">
                        Start calling technicians according to the routing ladder
                      </Text>
                    </View>
                    <Switch
                      value={triggerRouting}
                      onValueChange={setTriggerRouting}
                      trackColor={{ false: colors.border, true: colors.primary }}
                      thumbColor={colors.background}
                    />
                  </View>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Submit Button */}
          <TouchableOpacity
            className="mt-6 rounded-xl py-4 active:opacity-70"
            style={{ backgroundColor: colors.primary }}
            onPress={handleSubmit}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text className="text-center font-bold text-lg" style={{ color: colors.background }}>
                Create Incident
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
