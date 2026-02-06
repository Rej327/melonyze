import { ModernModal } from "@/components/ui/modern-modal";
import { useAuth } from "@/context/auth";

import { supabase } from "@/lib/supabase";
import { MaterialIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
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
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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
  const router = useRouter();
  const isDark = useColorScheme() === "dark";

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

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)");
    }
  };

  const fetchItem = useCallback(async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from("watermelon_item_table")
        .select("*")
        .eq("watermelon_item_id", id)
        .single();
      if (error) throw error;
      setLabel(data.watermelon_item_label || "");
      setVariety(data.watermelon_item_variety || "");
      setDescription(data.watermelon_item_description || "");
      setStatus(data.watermelon_item_harvest_status || "NOT_READY");

      const batchMatch =
        data.watermelon_item_description?.match(/\[Batch: (.*?)\]/);
      if (batchMatch) {
        setBatch(batchMatch[1]);
        setDescription(
          data.watermelon_item_description.replace(/\[Batch: .*?\]\n?/, ""),
        );
      }
      setImage(data.watermelon_item_image_url || null);
    } catch (error) {
      console.error(error);
      setAlertConfig({
        title: "Error",
        message: "Could not load item details",
        type: "error",
      });
      setAlertVisible(true);
    } finally {
      setFetching(false);
    }
  }, [id]);

  useEffect(() => {
    fetchItem();
  }, [fetchItem]);

  // Handle incoming analysis data
  // Handle incoming analysis data

  const paramsHandledRef = useRef(false);
  useEffect(() => {
    if (analysis_freq && analysis_status && !paramsHandledRef.current) {
      if (analysis_status === "Ripe" && !brix) {
        setBrix("12.5");
        setStatus("READY");
      } else if (analysis_status === "Unripe") {
        setStatus("NOT_READY");
      }
      paramsHandledRef.current = true;
    }
  }, [analysis_freq, analysis_status, analysis_amplitude, brix]);

  const takePhoto = async () => {
    setImgSourceModalVisible(false);
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      setAlertConfig({
        title: "Permission denied",
        message: "Camera access is required to take photos",
        type: "error",
      });
      setAlertVisible(true);
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"] as any,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const pickImage = async () => {
    setImgSourceModalVisible(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"] as any,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const handleImageSource = () => {
    setImgSourceModalVisible(true);
  };

  const handleSave = async () => {
    if (!label) {
      setAlertConfig({
        title: "Error",
        message: "Please provide a label/ID for this watermelon",
        type: "error",
      });
      setAlertVisible(true);
      return;
    }

    setLoading(true);
    try {
      let imageUrl = image;

      const itemData = {
        farmer_account_id: user?.id,
        watermelon_item_label: label,
        watermelon_item_variety: variety,
        watermelon_item_description: `[Batch: ${batch}]\n${description}`,
        watermelon_item_harvest_status: status,
        watermelon_item_image_url: imageUrl,
        watermelon_item_updated_at: new Date().toISOString(),
      };

      if (id) {
        const { error } = await supabase
          .from("watermelon_item_table")
          .update(itemData)
          .eq("watermelon_item_id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("watermelon_item_table")
          .insert([itemData]);
        if (error) throw error;
      }

      // If Brix was provided, record it
      if (brix && !isNaN(parseFloat(brix))) {
        let itemId = id as string;
        if (!id) {
          const { data } = await supabase
            .from("watermelon_item_table")
            .select("watermelon_item_id")
            .eq("watermelon_item_label", label)
            .order("watermelon_item_created_at", { ascending: false })
            .limit(1)
            .single();
          itemId = data?.watermelon_item_id;
        }

        if (itemId) {
          await supabase.from("watermelon_sweetness_record_table").insert([
            {
              watermelon_item_id: itemId,
              watermelon_sweetness_record_score: parseInt(brix),
            },
          ]);

          if (analysis_freq && analysis_amplitude) {
            await supabase.rpc("record_watermelon_sound_analysis", {
              p_watermelon_item_id: itemId,
              p_frequency: parseFloat(analysis_freq as string),
              p_amplitude: parseFloat(analysis_amplitude as string),
              p_decay_time: analysis_decay
                ? parseFloat(analysis_decay as string)
                : 0,
              p_confidence: analysis_confidence
                ? parseFloat(analysis_confidence as string)
                : 0,
            });
          }
        }
      } else if (analysis_freq && analysis_amplitude) {
        let itemId = id as string;
        if (!itemId) {
          const { data } = await supabase
            .from("watermelon_item_table")
            .select("watermelon_item_id")
            .eq("watermelon_item_label", label)
            .order("watermelon_item_created_at", { ascending: false })
            .limit(1)
            .single();
          itemId = data?.watermelon_item_id;
        }
        if (itemId) {
          await supabase.rpc("record_watermelon_sound_analysis", {
            p_watermelon_item_id: itemId,
            p_frequency: parseFloat(analysis_freq as string),
            p_amplitude: parseFloat(analysis_amplitude as string),
          });
        }
      }

      router.replace("/(tabs)");
    } catch (error: any) {
      setAlertConfig({ title: "Error", message: error.message, type: "error" });
      setAlertVisible(true);
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2D6A4F" />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#2D6A4F" }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[
          styles.container,
          { backgroundColor: isDark ? "#121212" : "#F8FBF9" },
        ]}
      >
        <ModernModal
          visible={alertVisible}
          onClose={() => setAlertVisible(false)}
          title={alertConfig.title}
          message={alertConfig.message}
          type={alertConfig.type}
        />

        <ModernModal
          visible={alertVisible}
          onClose={() => setAlertVisible(false)}
          title={alertConfig.title}
          message={alertConfig.message}
          type={alertConfig.type}
        />

        {/* Adding buttons for Gallery in a custom view over a ModernModal */}
        {imgSourceModalVisible && (
          <View style={styles.varietyOverlay}>
            <View style={styles.varietyContent}>
              <Text style={styles.varietyTitle}>Select Photo</Text>
              <TouchableOpacity style={styles.recordButton} onPress={takePhoto}>
                <MaterialIcons
                  name="camera"
                  size={20}
                  color="#FFF"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.recordButtonText}>Take Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.recordButton,
                  { marginTop: 12, backgroundColor: "#D8F3DC" },
                ]}
                onPress={pickImage}
              >
                <MaterialIcons
                  name="image"
                  size={20}
                  color="#2D6A4F"
                  style={{ marginRight: 8 }}
                />
                <Text style={[styles.recordButtonText, { color: "#2D6A4F" }]}>
                  Choose from Gallery
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.varietyClose}
                onPress={() => setImgSourceModalVisible(false)}
              >
                <Text style={styles.varietyCloseText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {varietyModalVisible && (
          <View style={styles.varietyOverlay}>
            <View style={styles.varietyContent}>
              <Text style={styles.varietyTitle}>Select Variety</Text>
              <ScrollView style={{ maxHeight: 300 }}>
                {VARIETIES.map((v) => (
                  <TouchableOpacity
                    key={v}
                    style={styles.varietyOption}
                    onPress={() => {
                      setVariety(v);
                      setVarietyModalVisible(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.varietyOptionText,
                        variety === v && styles.varietyOptionTextActive,
                      ]}
                    >
                      {v}
                    </Text>
                    {variety === v && (
                      <MaterialIcons name="check" size={20} color="#2D6A4F" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity
                style={styles.varietyClose}
                onPress={() => setVarietyModalVisible(false)}
              >
                <Text style={styles.varietyCloseText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Text style={styles.backButtonText}>Cancel</Text>
            </TouchableOpacity>

            <Text style={styles.title}>
              {id ? "Update Watermelon" : "Add New Watermelon"}
            </Text>
            <TouchableOpacity onPress={handleSave} disabled={loading}>
              {loading ? (
                <ActivityIndicator size="small" color="#2D6A4F" />
              ) : (
                <Text style={styles.saveText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.imagePicker}
            onPress={handleImageSource}
          >
            {image ? (
              <Image source={{ uri: image }} style={styles.previewImage} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <MaterialIcons name="camera-alt" size={40} color="#2D6A4F" />
                <Text style={styles.placeholderText}>Add Photo</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.form}>
            <Text style={styles.label}>Label / QR ID</Text>
            <TextInput
              style={styles.input}
              value={label}
              onChangeText={setLabel}
              placeholder="e.g. WM-2024-001"
              placeholderTextColor="#A0A0A0"
            />

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Batch / Harvest Group</Text>
                <TextInput
                  style={styles.input}
                  value={batch}
                  onChangeText={setBatch}
                  placeholder="e.g. Batch-Feb-26"
                  placeholderTextColor="#A0A0A0"
                />
              </View>
            </View>

            <Text style={styles.label}>Ripeness Status</Text>
            <View style={styles.statusToggleContainer}>
              <TouchableOpacity
                style={[
                  styles.statusOption,
                  status === "NOT_READY" && styles.statusOptionActiveNotReady,
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
                  status === "READY" && styles.statusOptionActiveReady,
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

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Variety</Text>
                <TouchableOpacity
                  style={styles.dropdown}
                  onPress={() => setVarietyModalVisible(true)}
                >
                  <Text
                    style={[
                      styles.dropdownText,
                      !variety && { color: "#A0A0A0" },
                    ]}
                  >
                    {variety || "Select Variety"}
                  </Text>
                  <MaterialIcons
                    name="arrow-drop-down"
                    size={24}
                    color="#2D6A4F"
                  />
                </TouchableOpacity>
              </View>
              <View style={{ width: 100, marginLeft: 16 }}>
                <Text style={styles.label}>Brix (°Bx)</Text>
                <TextInput
                  style={styles.input}
                  value={brix}
                  onChangeText={setBrix}
                  keyboardType="numeric"
                  placeholder="12.0"
                  placeholderTextColor="#A0A0A0"
                />
              </View>
            </View>

            <Text style={styles.label}>Notes / Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Condition, size, or specific plot notes..."
              placeholderTextColor="#A0A0A0"
              multiline
              numberOfLines={4}
            />

            {!id && (
              <TouchableOpacity
                style={styles.scanButton}
                onPress={() => router.push("/analysis" as any)}
              >
                <MaterialIcons
                  name="qr-code-scanner"
                  size={20}
                  color="#2D6A4F"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.scanButtonText}>Scan First Instead</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FBF9" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollContent: { paddingBottom: 40 },
  header: {
    paddingTop: 20,
    paddingHorizontal: 24,
    paddingBottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backButton: { paddingVertical: 4 },
  backButtonText: { color: "#D90429", fontSize: 16, fontWeight: "600" },
  title: { fontSize: 18, fontWeight: "700", color: "#1B4332" },
  saveText: { color: "#2D6A4F", fontSize: 16, fontWeight: "700" },
  imagePicker: {
    height: 200,
    marginHorizontal: 24,
    marginTop: 10,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D8F3DC",
    borderStyle: "dashed",
  },
  previewImage: { width: "100%", height: "100%" },
  imagePlaceholder: { alignItems: "center" },
  placeholderText: { color: "#2D6A4F", fontWeight: "600", marginTop: 8 },
  form: { padding: 24 },
  label: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
    marginLeft: 4,
    textTransform: "uppercase",
    color: "#495057",
  },
  input: {
    height: 56,
    borderRadius: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 24,
    backgroundColor: "#FFFFFF",
    color: "#000000",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  dropdown: {
    height: 56,
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 24,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  dropdownText: { fontSize: 16, color: "#000" },
  textArea: { height: 120, paddingTop: 16, textAlignVertical: "top" },
  row: { flexDirection: "row" },
  scanButton: {
    marginTop: 8,
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2D6A4F",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  scanButtonText: { color: "#2D6A4F", fontSize: 16, fontWeight: "700" },
  statusToggleContainer: {
    flexDirection: "row",
    backgroundColor: "#F0F0F0",
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  statusOption: {
    flex: 1,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
  },
  statusOptionActiveReady: { backgroundColor: "#2D6A4F" },
  statusOptionActiveNotReady: { backgroundColor: "#D90429" },
  statusOptionText: { fontSize: 14, fontWeight: "700", color: "#6C757D" },
  statusOptionTextActive: { color: "#FFFFFF" },
  varietyOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
    elevation: 9999,
    padding: 24,
  },
  varietyContent: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#FFF",
    borderRadius: 24,
    padding: 24,
    elevation: 10000,
  },
  varietyTitle: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 20,
    color: "#1B4332",
  },
  varietyOption: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  varietyOptionText: { fontSize: 16, color: "#495057" },
  varietyOptionTextActive: { color: "#2D6A4F", fontWeight: "700" },
  varietyClose: { marginTop: 20, alignItems: "center" },
  varietyCloseText: { color: "#6C757D", fontWeight: "600" },
  recordButton: {
    height: 52,
    backgroundColor: "#2D6A4F",
    borderRadius: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  recordButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
});
