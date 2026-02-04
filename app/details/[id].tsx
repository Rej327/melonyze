import { useColorScheme } from "@/hooks/use-color-scheme";
import { supabase } from "@/lib/supabase";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface WatermelonDetail {
  watermelon_item_id: string;
  watermelon_item_label: string;
  watermelon_item_variety: string;
  watermelon_item_description: string;
  watermelon_item_harvest_status: "READY" | "NOT_READY";
  watermelon_item_image_url: string;
  watermelon_item_created_at: string;
}

export default function WatermelonDetails() {
  const { id } = useLocalSearchParams();
  const [watermelon, setWatermelon] = useState<WatermelonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const fetchDetails = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("watermelon_item_table")
        .select("*")
        .eq("watermelon_item_id", id)
        .single();

      if (error) throw error;
      setWatermelon(data);
    } catch (error) {
      console.error("Error fetching details:", error);
      Alert.alert("Error", "Could not load watermelon details");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const handleDelete = async () => {
    Alert.alert(
      "Delete Entry",
      "Are you sure you want to delete this watermelon record?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase
              .from("watermelon_item_table")
              .delete()
              .eq("watermelon_item_id", id);

            if (error) {
              Alert.alert("Error", error.message);
            } else {
              router.replace("/(tabs)");
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View
        style={[
          styles.centered,
          { backgroundColor: isDark ? "#121212" : "#F8FBF9" },
        ]}
      >
        <ActivityIndicator size="large" color="#2D6A4F" />
      </View>
    );
  }

  if (!watermelon) return null;

  return (
    <ScrollView
      style={[
        styles.container,
        { backgroundColor: isDark ? "#121212" : "#F8FBF9" },
      ]}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text
          style={[
            styles.headerTitle,
            { color: isDark ? "#FFFFFF" : "#1B4332" },
          ]}
        >
          Watermelon Details
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.imageContainer}>
          <Image
            source={{
              uri:
                watermelon.watermelon_item_image_url ||
                "https://placehold.co/600x400?text=No+Image",
            }}
            style={styles.mainImage}
          />
          <View style={styles.idBadge}>
            <Text style={styles.idText}>
              ID: {watermelon.watermelon_item_label}
            </Text>
          </View>
        </View>

        <View style={styles.infoSection}>
          <View style={styles.titleRow}>
            <Text
              style={[
                styles.variety,
                { color: isDark ? "#FFFFFF" : "#1B4332" },
              ]}
            >
              {watermelon.watermelon_item_variety}
            </Text>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor:
                    watermelon.watermelon_item_harvest_status === "READY"
                      ? "#2D6A4F"
                      : "#D90429",
                },
              ]}
            />
          </View>
          <Text style={styles.batchInfo}>Batch: Harvest-Feb-26</Text>

          <View style={styles.statsGrid}>
            <View
              style={[
                styles.statBox,
                { backgroundColor: isDark ? "#1E1E1E" : "#FFFFFF" },
              ]}
            >
              <Text style={styles.statIcon}>💧</Text>
              <Text style={styles.statTitle}>BRIX LEVEL</Text>
              <Text style={[styles.statValue, { color: "#2D6A4F" }]}>
                12.5°
              </Text>
              <Text style={styles.statDesc}>Excellent Sweetness</Text>
            </View>
            <View
              style={[
                styles.statBox,
                { backgroundColor: isDark ? "#1E1E1E" : "#FFFFFF" },
              ]}
            >
              <Text style={styles.statIcon}>✅</Text>
              <Text style={styles.statTitle}>RIPENESS</Text>
              <Text
                style={[
                  styles.statValue,
                  {
                    color:
                      watermelon.watermelon_item_harvest_status === "READY"
                        ? "#2D6A4F"
                        : "#D90429",
                  },
                ]}
              >
                {watermelon.watermelon_item_harvest_status === "READY"
                  ? "Ripe"
                  : "Unripe"}
              </Text>
              <Text style={styles.statDesc}>
                {watermelon.watermelon_item_harvest_status === "READY"
                  ? "Ready to Ship"
                  : "Needs more time"}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.analysisCard,
              { backgroundColor: isDark ? "#1E1E1E" : "#FFFFFF" },
            ]}
          >
            <View style={styles.analysisHeader}>
              <Text
                style={[
                  styles.analysisTitle,
                  { color: isDark ? "#FFFFFF" : "#1B4332" },
                ]}
              >
                📊 Sound Analysis
              </Text>
              <View style={styles.densityBadge}>
                <Text style={styles.densityText}>High Density</Text>
              </View>
            </View>

            {/* Simulated Chart */}
            <View style={styles.chartContainer}>
              {[0.3, 0.4, 0.6, 0.8, 1, 0.9, 0.5, 0.4, 0.2, 0.1].map((h, i) => (
                <View
                  key={i}
                  style={[
                    styles.chartBar,
                    { height: h * 60, opacity: 0.3 + h * 0.7 },
                  ]}
                />
              ))}
            </View>
            <View style={styles.chartLabels}>
              <Text style={styles.chartLabelText}>100 Hz</Text>
              <Text style={styles.chartLabelText}>Peak: 440 Hz</Text>
              <Text style={styles.chartLabelText}>1.2k Hz</Text>
            </View>

            <Text style={styles.analysisNotes}>
              Acoustic response indicates a high sugar content and internal
              moisture consistency. Traditional &quot;thump&quot; test verified.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.editButton}
            onPress={() =>
              router.push({
                pathname: "/management/add-edit",
                params: { id: watermelon.watermelon_item_id },
              } as any)
            }
          >
            <Text style={styles.editButtonText}>Edit Details</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteButtonText}>Delete Entry</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
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
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  backButton: {
    paddingVertical: 8,
  },
  backButtonText: {
    color: "#2D6A4F",
    fontWeight: "600",
    fontSize: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  content: {
    paddingBottom: 40,
  },
  imageContainer: {
    marginHorizontal: 24,
    borderRadius: 24,
    overflow: "hidden",
    height: 300,
    position: "relative",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  mainImage: {
    width: "100%",
    height: "100%",
  },
  idBadge: {
    position: "absolute",
    top: 16,
    right: 16,
    backgroundColor: "#2D6A4F",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  idText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 12,
  },
  infoSection: {
    paddingHorizontal: 24,
    marginTop: 24,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  variety: {
    fontSize: 28,
    fontWeight: "800",
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  batchInfo: {
    fontSize: 14,
    color: "#6C757D",
    marginTop: 4,
    fontWeight: "500",
  },
  statsGrid: {
    flexDirection: "row",
    marginTop: 24,
    gap: 16,
  },
  statBox: {
    flex: 1,
    padding: 16,
    borderRadius: 20,
    alignItems: "flex-start",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  statIcon: {
    fontSize: 20,
    marginBottom: 8,
  },
  statTitle: {
    fontSize: 10,
    fontWeight: "800",
    color: "#A0A0A0",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 4,
  },
  statDesc: {
    fontSize: 10,
    color: "#6C757D",
  },
  analysisCard: {
    marginTop: 24,
    padding: 20,
    borderRadius: 24,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  analysisHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  analysisTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  densityBadge: {
    backgroundColor: "#D8F3DC",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  densityText: {
    color: "#2D6A4F",
    fontSize: 10,
    fontWeight: "800",
  },
  chartContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 80,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  chartBar: {
    width: "8%",
    backgroundColor: "#2D6A4F",
    borderRadius: 4,
  },
  chartLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    marginBottom: 20,
  },
  chartLabelText: {
    fontSize: 10,
    color: "#A0A0A0",
    fontWeight: "600",
  },
  analysisNotes: {
    fontSize: 13,
    lineHeight: 20,
    color: "#6C757D",
    fontWeight: "400",
  },
  editButton: {
    marginTop: 32,
    height: 56,
    backgroundColor: "#2D6A4F",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  editButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  deleteButton: {
    marginTop: 12,
    height: 56,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#FFD7D7",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  deleteButtonText: {
    color: "#D90429",
    fontSize: 16,
    fontWeight: "700",
  },
});
