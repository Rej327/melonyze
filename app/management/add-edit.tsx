import { useAuth } from "@/context/auth";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { supabase } from "@/lib/supabase";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

export default function AddEditWatermelon() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

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
      // Extract batch from description or use default if not found
      // For now, let's assume we might store it at the start like [Batch: ...]
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
      Alert.alert("Error", "Could not load item details");
    } finally {
      setFetching(false);
    }
  }, [id]);

  useEffect(() => {
    fetchItem();
  }, [fetchItem]);

  // Handle incoming analysis data
  const { analysis_freq, analysis_status, analysis_amplitude } =
    useLocalSearchParams();

  const paramsHandledRef = useRef(false);
  useEffect(() => {
    if (analysis_freq && analysis_status && !paramsHandledRef.current) {
      const report = `[Acoustic Analysis] Status: ${analysis_status}, Frequency: ${analysis_freq}Hz, Amplitude: ${analysis_amplitude}`;
      setDescription((prev) => (prev ? `${prev}\n\n${report}` : report));

      if (analysis_status === "READY" && !brix) {
        setBrix("12.5");
        setStatus("READY");
      } else if (analysis_status === "NOT_READY") {
        setStatus("NOT_READY");
      }
      paramsHandledRef.current = true;
    }
  }, [analysis_freq, analysis_status, analysis_amplitude, brix]);

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission denied",
        "Camera access is required to take photos",
      );
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
    Alert.alert("Select Photo", "Choose a source for your watermelon image", [
      { text: "Take Photo", onPress: takePhoto },
      { text: "Choose from Gallery", onPress: pickImage },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleSave = async () => {
    if (!label) {
      Alert.alert("Error", "Please provide a label/ID for this watermelon");
      return;
    }

    setLoading(true);
    try {
      let imageUrl = image;

      // Handle image upload if it's a local URI
      if (image && image.startsWith("file://")) {
        // For web/expo-go, this part can be tricky.
        // Assuming we have base64 from picking if we need it,
        // but here we'll just use a mock upload path or attempt it.
        // For the sake of the demo, we'll use the local URI or a placeholder
        // In a real implementation:
        // const { data, error } = await supabase.storage.from('watermelons').upload(fileName, decode(base64Data), { contentType: 'image/jpeg' });
        // imageUrl = supabase.storage.from('watermelons').getPublicUrl(fileName).data.publicUrl;
      }

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
        // Find the item ID if it was a new insert
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

          // If we have analysis data, persist it via RPC
          if (analysis_freq && analysis_amplitude) {
            await supabase.rpc("record_watermelon_sound_analysis", {
              p_watermelon_item_id: itemId,
              p_frequency: parseFloat(analysis_freq as string),
              p_amplitude: parseFloat(analysis_amplitude as string),
            });
          }
        }
      } else if (analysis_freq && analysis_amplitude) {
        // Even if no Brix, try to find item and record analysis
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
      Alert.alert("Error", error.message);
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
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[
        styles.container,
        { backgroundColor: isDark ? "#121212" : "#F8FBF9" },
      ]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>Cancel</Text>
          </TouchableOpacity>
          <Text
            style={[styles.title, { color: isDark ? "#FFFFFF" : "#1B4332" }]}
          >
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
              <Text style={styles.placeholderIcon}>📸</Text>
              <Text style={styles.placeholderText}>Add Photo</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.form}>
          <Text
            style={[styles.label, { color: isDark ? "#A0A0A0" : "#495057" }]}
          >
            Label / QR ID
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: isDark ? "#1E1E1E" : "#FFFFFF",
                color: isDark ? "#FFFFFF" : "#000000",
              },
            ]}
            value={label}
            onChangeText={setLabel}
            placeholder="e.g. WM-2024-001"
            placeholderTextColor="#A0A0A0"
          />

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.label,
                  { color: isDark ? "#A0A0A0" : "#495057" },
                ]}
              >
                Batch / Harvest Group
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: isDark ? "#1E1E1E" : "#FFFFFF",
                    color: isDark ? "#FFFFFF" : "#000000",
                  },
                ]}
                value={batch}
                onChangeText={setBatch}
                placeholder="e.g. Batch-Feb-26"
                placeholderTextColor="#A0A0A0"
              />
            </View>
          </View>

          <Text
            style={[styles.label, { color: isDark ? "#A0A0A0" : "#495057" }]}
          >
            Ripeness Status
          </Text>
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
              <Text
                style={[
                  styles.label,
                  { color: isDark ? "#A0A0A0" : "#495057" },
                ]}
              >
                Variety
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: isDark ? "#1E1E1E" : "#FFFFFF",
                    color: isDark ? "#FFFFFF" : "#000000",
                  },
                ]}
                value={variety}
                onChangeText={setVariety}
                placeholder="e.g. Sugar Baby"
                placeholderTextColor="#A0A0A0"
              />
            </View>
            <View style={{ width: 100, marginLeft: 16 }}>
              <Text
                style={[
                  styles.label,
                  { color: isDark ? "#A0A0A0" : "#495057" },
                ]}
              >
                Brix (°Bx)
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: isDark ? "#1E1E1E" : "#FFFFFF",
                    color: isDark ? "#FFFFFF" : "#000000",
                  },
                ]}
                value={brix}
                onChangeText={setBrix}
                keyboardType="numeric"
                placeholder="12.0"
                placeholderTextColor="#A0A0A0"
              />
            </View>
          </View>

          <Text
            style={[styles.label, { color: isDark ? "#A0A0A0" : "#495057" }]}
          >
            Notes / Description
          </Text>
          <TextInput
            style={[
              styles.input,
              styles.textArea,
              {
                backgroundColor: isDark ? "#1E1E1E" : "#FFFFFF",
                color: isDark ? "#FFFFFF" : "#000000",
              },
            ]}
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
              <Text style={styles.scanButtonText}>Scan First Instead</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backButton: {
    paddingVertical: 4,
  },
  backButtonText: {
    color: "#D90429",
    fontSize: 16,
    fontWeight: "600",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
  },
  saveText: {
    color: "#2D6A4F",
    fontSize: 16,
    fontWeight: "700",
  },
  imagePicker: {
    height: 200,
    marginHorizontal: 24,
    marginTop: 10,
    borderRadius: 20,
    backgroundColor: "#E9F5EE",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D8F3DC",
    borderStyle: "dashed",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    alignItems: "center",
  },
  placeholderIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  placeholderText: {
    color: "#2D6A4F",
    fontWeight: "600",
  },
  form: {
    padding: 24,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
    marginLeft: 4,
    textTransform: "uppercase",
  },
  input: {
    height: 56,
    borderRadius: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 24,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  textArea: {
    height: 120,
    paddingTop: 16,
    textAlignVertical: "top",
  },
  row: {
    flexDirection: "row",
  },
  scanButton: {
    marginTop: 8,
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2D6A4F",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  scanButtonText: {
    color: "#2D6A4F",
    fontSize: 16,
    fontWeight: "700",
  },
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
  statusOptionActiveReady: {
    backgroundColor: "#2D6A4F",
  },
  statusOptionActiveNotReady: {
    backgroundColor: "#D90429",
  },
  statusOptionText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6C757D",
  },
  statusOptionTextActive: {
    color: "#FFFFFF",
  },
});
