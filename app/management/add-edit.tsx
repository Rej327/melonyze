import { ModernHeader } from "@/components/ui/modern-header";
import { ModernModal } from "@/components/ui/modern-modal";
import { useAuth } from "@/context/auth";
import { useFarm } from "@/context/farm";
import { supabase } from "@/lib/supabase";
import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const VARIETIES = [
  "Sugar Baby",
  "Crimson Sweet",
  "Allsweet",
  "Jubilee",
  "Charleston Gray",
  "Black Diamond",
  "Icebox",
  "Seedless",
];

export default function AddEditWatermelon() {
  const {
    id,
    analysis_freq,
    analysis_status,
    analysis_amplitude,
    analysis_decay,
    analysis_confidence,
  } = useLocalSearchParams();
  const { user } = useAuth();
  const { activeFarm, myFarms, loading: farmLoading } = useFarm();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(!!id);
  const [label, setLabel] = useState("");
  const [variety, setVariety] = useState("");
  const [brix, setBrix] = useState("");
  const [description, setDescription] = useState("");
  const [batch, setBatch] = useState(
    "Batch-" +
      new Date().toLocaleString("default", { month: "short" }) +
      "-" +
      new Date().getDate(),
  );
  const [status, setStatus] = useState<"READY" | "NOT_READY">("NOT_READY");
  const [image, setImage] = useState<string | null>(null);
  const [varietyModalVisible, setVarietyModalVisible] = useState(false);

  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: "",
    message: "",
    type: "info" as any,
  });
  const [imgSourceModalVisible, setImgSourceModalVisible] = useState(false);
  const [currentGroupId, setCurrentGroupId] = useState<string | null>(null);

  // Analysis results (can be loaded from draft)
  const [analysisRes, setAnalysisRes] = useState<{
    freq?: string;
    status?: string;
    amplitude?: string;
    decay?: string;
    confidence?: string;
  }>({});

  const DRAFT_KEY = `watermelon_draft_${id || "new"}`;

  // Save draft on changes
  useEffect(() => {
    const saveDraft = async () => {
      try {
        const draft = {
          label,
          variety,
          brix,
          description,
          batch,
          status,
          image,
          currentGroupId,
          analysisRes, // Include analysis results in draft
        };
        await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch (e) {
        console.error("Failed to save draft", e);
      }
    };
    // Don't save empty state on initial mount to avoid overwriting recent scan results
    if (label || variety || image || analysisRes.freq) {
      saveDraft();
    }
  }, [
    label,
    variety,
    brix,
    description,
    batch,
    status,
    image,
    currentGroupId,
    analysisRes,
    DRAFT_KEY,
  ]);

  const clearDraft = async () => {
    try {
      await AsyncStorage.removeItem(DRAFT_KEY);
      // Reset state
      setLabel("");
      setVariety("");
      setBrix("");
      setDescription("");
      setBatch(
        "Batch-" +
          new Date().toLocaleString("default", { month: "short" }) +
          "-" +
          new Date().getDate(),
      );
      setStatus("NOT_READY");
      setImage(null);
      setAnalysisRes({});
      if (activeFarm) setCurrentGroupId(activeFarm.farm_group_id);

      showAlert("Success", "Form cleared", "success");
    } catch (e) {
      console.error("Failed to clear draft", e);
    }
  };

  useEffect(() => {
    if (activeFarm && !currentGroupId) {
      setCurrentGroupId(activeFarm.farm_group_id);
    }
  }, [activeFarm, currentGroupId]);

  // Main data loading logic
  const loadData = useCallback(async () => {
    // 1. If we have an ID, fetch from DB first (only once on first load or if ID changes)
    if (id && user && fetching) {
      try {
        const { data, error } = await supabase
          .from("watermelon_item_table")
          .select(
            `
            *,
            watermelon_sweetness_record_table (
              watermelon_sweetness_record_score,
              watermelon_sweetness_record_notes
            )
          `,
          )
          .eq("watermelon_item_id", id)
          .order("watermelon_sweetness_record_created_at", {
            foreignTable: "watermelon_sweetness_record_table",
            ascending: false,
          })
          .limit(1, { foreignTable: "watermelon_sweetness_record_table" })
          .single();

        if (error) throw error;
        if (data) {
          setLabel(data.watermelon_item_label);
          setVariety(data.watermelon_item_variety);
          const latestSweetness = data.watermelon_sweetness_record_table?.[0];
          setBrix(
            latestSweetness?.watermelon_sweetness_record_score?.toString() ||
              "",
          );
          setStatus(data.watermelon_item_harvest_status);
          setDescription(data.watermelon_item_description || "");
          setImage(data.watermelon_item_image_url);
          setCurrentGroupId(data.farm_group_id);
          if (data.watermelon_item_batch_number)
            setBatch(data.watermelon_item_batch_number);
        }
      } catch (error) {
        console.error("Error fetching watermelon:", error);
      } finally {
        setFetching(false);
      }
    }

    // 2. Check for draft and overwrite if it exists
    // This ensures that mid-edit changes (like those preserved during a scan)
    // take precedence over the saved DB version.
    try {
      const savedDraft = await AsyncStorage.getItem(DRAFT_KEY);
      if (savedDraft) {
        const draft = JSON.parse(savedDraft);
        if (draft.label !== undefined) setLabel(draft.label);
        if (draft.variety !== undefined) setVariety(draft.variety);
        if (draft.brix !== undefined) setBrix(draft.brix);
        if (draft.description !== undefined) setDescription(draft.description);
        if (draft.batch !== undefined) setBatch(draft.batch);
        if (draft.status !== undefined) setStatus(draft.status);
        if (draft.image !== undefined) setImage(draft.image);
        if (draft.currentGroupId !== undefined)
          setCurrentGroupId(draft.currentGroupId);

        if (draft.analysisRes) {
          setAnalysisRes(draft.analysisRes);
        } else if (draft.analysis_freq) {
          // Legacy support for older draft format
          setAnalysisRes({
            freq: draft.analysis_freq,
            status: draft.analysis_status,
            amplitude: draft.analysis_amplitude,
            decay: draft.analysis_decay,
            confidence: draft.analysis_confidence,
          });
        }
      }
    } catch (e) {
      console.error("Failed to load draft", e);
    }
  }, [id, user, DRAFT_KEY, fetching]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  // Still handle analysis results from query params (initial load only)
  useEffect(() => {
    if (analysis_freq && fetching) {
      setStatus(analysis_status === "Ripe" ? "READY" : "NOT_READY");
      setAnalysisRes({
        freq: analysis_freq as string,
        status: analysis_status as string,
        amplitude: analysis_amplitude as string,
        decay: analysis_decay as string,
        confidence: analysis_confidence as string,
      });
    }
  }, [
    analysis_freq,
    analysis_status,
    analysis_amplitude,
    analysis_decay,
    analysis_confidence,
    fetching,
  ]);

  const showAlert = (
    title: string,
    message: string,
    type: "info" | "success" | "error",
  ) => {
    setAlertConfig({ title, message, type });
    setAlertVisible(true);
  };

  const validate = () => {
    if (!label) return "Label is required";
    if (!variety) return "Variety is required";
    if (!currentGroupId) return "Farm group is required";
    return null;
  };

  const handleSave = async () => {
    const errorMsg = validate();
    if (errorMsg) {
      showAlert("Validation Error", errorMsg, "error");
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        watermelon_item_label: label,
        watermelon_item_variety: variety,
        watermelon_item_harvest_status: status,
        watermelon_item_description: description,
        farm_group_id: currentGroupId,
        watermelon_item_batch_number: batch,
        watermelon_item_image_url: image,
      };

      if (id) {
        const { error } = await supabase
          .from("watermelon_item_table")
          .update(payload)
          .eq("watermelon_item_id", id);
        if (error) throw error;

        // If brix was updated, add a new sweetness record
        if (brix) {
          await supabase.from("watermelon_sweetness_record_table").insert({
            watermelon_item_id: id,
            watermelon_sweetness_record_score: parseFloat(brix),
            watermelon_sweetness_record_notes: "Updated from edit screen",
          });
        }
      } else {
        // Use RPC to handle both item creation and potentially analysis details
        const { data: newItem, error } = await supabase.rpc(
          "create_watermelon_item",
          {
            p_farmer_id: user?.id,
            p_farm_group_id: currentGroupId,
            p_label: label,
            p_variety: variety,
            p_status: status,
            p_description: description,
            p_image_url: image,
            p_batch_number: batch,
            p_initial_brix: brix ? parseFloat(brix) : null,
          },
        );

        if (error) throw error;

        // If from analysis, also record the sound analysis
        if (analysisRes.freq) {
          await supabase.rpc("record_sound_analysis", {
            p_executing_user_id: user?.id,
            p_item_id: newItem, // RPC returns ID of new item
            p_frequency: parseFloat(analysisRes.freq as string),
            p_amplitude: parseFloat(analysisRes.amplitude as string),
            p_decay: parseFloat(analysisRes.decay as string),
            p_confidence: parseFloat(analysisRes.confidence as string),
            p_is_ripe: analysisRes.status === "Ripe",
          });
        }
      }

      showAlert(
        "Success",
        `Watermelon ${id ? "updated" : "created"} successfully!`,
        "success",
      );
      await AsyncStorage.removeItem(DRAFT_KEY);
      setTimeout(() => {
        router.back();
      }, 1500);
    } catch (error: any) {
      setAlertConfig({
        title: "Error",
        message: error.message,
        type: "error",
      });
      setAlertVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async (useCamera: boolean) => {
    setImgSourceModalVisible(false);
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 4],
      quality: 0.6,
    };

    let result;
    if (useCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") return;
      result = await ImagePicker.launchCameraAsync(options);
    } else {
      result = await ImagePicker.launchImageLibraryAsync(options);
    }

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  if (fetching || farmLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2D6A4F" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#2D6A4F" }}>
      <StatusBar style="light" />
      <ModernHeader
        title={id ? "Edit Watermelon" : "New Watermelon"}
        subtitle={activeFarm?.farm_group_name}
        onBack={id ? () => router.back() : () => router.replace("/")}
        rightActions={
          <TouchableOpacity onPress={clearDraft} style={styles.iconContainer}>
            <MaterialIcons name="delete-sweep" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        }
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[styles.container, { backgroundColor: "#F8FBF9" }]}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Image Picker */}
          <View style={styles.imageSection}>
            <TouchableOpacity
              style={styles.imagePlaceholder}
              onPress={() => setImgSourceModalVisible(true)}
            >
              {image ? (
                <Image source={{ uri: image }} style={styles.previewImage} />
              ) : (
                <View style={styles.emptyImage}>
                  <MaterialIcons name="add-a-photo" size={32} color="#A0A0A0" />
                  <Text style={styles.emptyImageText}>Add Photo</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Form Fields */}
          <View style={styles.form}>
            <Text style={styles.fieldLabel}>Label / Tag Number</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. WM-001"
              value={label}
              onChangeText={setLabel}
              placeholderTextColor="#A0A0A0"
            />

            <Text style={styles.fieldLabel}>Variety</Text>
            <TouchableOpacity
              style={styles.select}
              onPress={() => setVarietyModalVisible(true)}
            >
              <Text
                style={[styles.selectText, !variety && { color: "#A0A0A0" }]}
              >
                {variety || "Select Variety"}
              </Text>
              <MaterialIcons name="arrow-drop-down" size={24} color="#2D6A4F" />
            </TouchableOpacity>

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.fieldLabel}>Brix (°Bx)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 11.5"
                  keyboardType="numeric"
                  value={brix}
                  onChangeText={setBrix}
                  placeholderTextColor="#A0A0A0"
                />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.fieldLabel}>Batch</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Batch-1"
                  value={batch}
                  onChangeText={setBatch}
                  placeholderTextColor="#A0A0A0"
                />
              </View>
            </View>

            <Text style={styles.fieldLabel}>Acoustic Analysis</Text>
            {analysisRes.freq ? (
              <View style={styles.analysisContainer}>
                <View style={styles.analysisInfo}>
                  <MaterialIcons name="analytics" size={24} color="#2D6A4F" />
                  <View style={styles.analysisText}>
                    <Text style={styles.analysisMainText}>
                      {analysisRes.status === "Ripe"
                        ? "Ready for Harvest"
                        : "Still Ripening"}
                    </Text>
                    <Text style={styles.analysisSubText}>
                      {analysisRes.freq}Hz •{" "}
                      {Math.round(
                        parseFloat(analysisRes.confidence as string) * 100,
                      )}
                      % confidence
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.reanalyzeButton}
                  onPress={() =>
                    router.push(
                      `/analysis?from_form=true${id ? `&id=${id}` : ""}` as any,
                    )
                  }
                >
                  <Text style={styles.reanalyzeText}>Re-analyze</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.analyzeButton}
                onPress={() =>
                  router.push(
                    `/analysis?from_form=true${id ? `&id=${id}` : ""}` as any,
                  )
                }
              >
                <MaterialIcons name="mic" size={20} color="#2D6A4F" />
                <Text style={styles.analyzeButtonText}>
                  Start Acoustic Scan
                </Text>
              </TouchableOpacity>
            )}

            <Text style={styles.fieldLabel}>Status</Text>
            <View style={styles.statusToggle}>
              <TouchableOpacity
                style={[
                  styles.statusOption,
                  status === "NOT_READY" && styles.statusOptionActive,
                ]}
                onPress={() => setStatus("NOT_READY")}
              >
                <Text
                  style={[
                    styles.statusOptionText,
                    status === "NOT_READY" && styles.statusOptionTextActive,
                  ]}
                >
                  Unripe
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.statusOption,
                  status === "READY" && styles.statusOptionActive,
                ]}
                onPress={() => setStatus("READY")}
              >
                <Text
                  style={[
                    styles.statusOptionText,
                    status === "READY" && styles.statusOptionTextActive,
                  ]}
                >
                  Ripe
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Assign to Farm</Text>
            <View style={styles.farmList}>
              {myFarms.map((farm) => (
                <TouchableOpacity
                  key={farm.farm_group_id}
                  style={[
                    styles.farmBadge,
                    currentGroupId === farm.farm_group_id &&
                      styles.farmBadgeActive,
                  ]}
                  onPress={() => setCurrentGroupId(farm.farm_group_id)}
                >
                  <Text
                    style={[
                      styles.farmBadgeText,
                      currentGroupId === farm.farm_group_id &&
                        styles.farmBadgeTextActive,
                    ]}
                  >
                    {farm.farm_group_name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Additional Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Any details about location, soil, or observation..."
              multiline
              numberOfLines={4}
              value={description}
              onChangeText={setDescription}
              placeholderTextColor="#A0A0A0"
            />

            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSave}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.saveButtonText}>
                  {id ? "Update Details" : "Save Watermelon"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Variety Picker Modal */}
      <ModernModal
        visible={varietyModalVisible}
        onClose={() => setVarietyModalVisible(false)}
        title="Select Variety"
      >
        <View style={styles.varietyList}>
          {VARIETIES.map((v) => (
            <TouchableOpacity
              key={v}
              style={styles.varietyItem}
              onPress={() => {
                setVariety(v);
                setVarietyModalVisible(false);
              }}
            >
              <Text style={styles.varietyText}>{v}</Text>
              {variety === v && (
                <MaterialIcons name="check" size={20} color="#2D6A4F" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ModernModal>

      {/* Image Source Picker */}
      <ModernModal
        visible={imgSourceModalVisible}
        onClose={() => setImgSourceModalVisible(false)}
        title="Select Source"
      >
        <View style={styles.sourceOptions}>
          <TouchableOpacity
            style={styles.sourceButton}
            onPress={() => pickImage(true)}
          >
            <MaterialIcons name="camera-alt" size={32} color="#2D6A4F" />
            <Text style={styles.sourceText}>Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.sourceButton}
            onPress={() => pickImage(false)}
          >
            <MaterialIcons name="photo-library" size={32} color="#2D6A4F" />
            <Text style={styles.sourceText}>Gallery</Text>
          </TouchableOpacity>
        </View>
      </ModernModal>

      <ModernModal
        visible={alertVisible}
        onClose={() => setAlertVisible(false)}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onConfirm={() => setAlertVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#2D6A4F",
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 20, fontWeight: "700" },
  scroll: { paddingBottom: 40 },
  imageSection: { alignItems: "center", marginVertical: 20 },
  imagePlaceholder: {
    width: 160,
    height: 160,
    borderRadius: 20,
    backgroundColor: "#F0F0F0",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#E0E0E0",
    borderStyle: "dashed",
  },
  previewImage: { width: "100%", height: "100%" },
  emptyImage: { flex: 1, justifyContent: "center", alignItems: "center" },
  iconContainer: {
    width: 40,
    height: 40,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyImageText: {
    color: "#A0A0A0",
    marginTop: 8,
    fontSize: 13,
    fontWeight: "600",
  },
  form: { paddingHorizontal: 24 },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "400",
    color: "#495057",
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    color: "#000",
  },
  textArea: { height: 100, paddingTop: 12, textAlignVertical: "top" },
  select: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  selectText: { fontSize: 16, color: "#000" },
  row: { flexDirection: "row" },
  statusToggle: {
    flexDirection: "row",
    backgroundColor: "#F0F0F0",
    borderRadius: 10,
    padding: 4,
  },
  statusOption: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
  },
  statusOptionActive: { backgroundColor: "#FFFFFF", elevation: 2 },
  statusOptionText: { fontSize: 14, fontWeight: "600", color: "#A0A0A0" },
  statusOptionTextActive: { color: "#2D6A4F" },
  farmList: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  farmBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#F0F0F0",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  farmBadgeActive: { backgroundColor: "#2D6A4F", borderColor: "#2D6A4F" },
  farmBadgeText: { fontSize: 13, fontWeight: "600", color: "#666" },
  farmBadgeTextActive: { color: "#FFFFFF" },
  saveButton: {
    backgroundColor: "#2D6A4F",
    borderRadius: 16,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 32,
    elevation: 4,
    shadowColor: "#2D6A4F",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  saveButtonText: { color: "#FFFFFF", fontSize: 18, fontWeight: "700" },
  varietyList: { width: "100%" },
  varietyItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  varietyText: { fontSize: 16, color: "#1B4332" },
  sourceOptions: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-around",
    paddingVertical: 20,
  },
  sourceButton: { alignItems: "center", gap: 8 },
  sourceText: { fontSize: 14, fontWeight: "700", color: "#2D6A4F" },
  analysisContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  analysisInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  analysisText: {
    marginLeft: 12,
  },
  analysisMainText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1B4332",
  },
  analysisSubText: {
    fontSize: 13,
    color: "#6C757D",
    marginTop: 2,
  },
  reanalyzeButton: {
    backgroundColor: "#F0F0F0",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  reanalyzeText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#2D6A4F",
  },
  analyzeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E9F5EE",
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#2D6A4F",
    borderStyle: "dashed",
    gap: 8,
  },
  analyzeButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#2D6A4F",
  },
});
