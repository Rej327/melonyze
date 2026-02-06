import { ModernModal } from "@/components/ui/modern-modal";
import { useAuth } from "@/context/auth";
import { supabase } from "@/lib/supabase";
import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface FarmerAnalytics {
  total_items: number;
  ready_items: number;
  avg_sweetness: number;
}

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<any>(null);

  const [analytics, setAnalytics] = useState<FarmerAnalytics | null>(null);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [signOutVisible, setSignOutVisible] = useState(false);
  const router = useRouter();
  const isDark = false;

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from("farmer_account_table")
        .select("*")
        .eq("farmer_account_id", user.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Fetch analytics
      const { data: analyticsData, error: analyticsError } = await supabase.rpc(
        "get_farmer_analytics",
        {
          p_farmer_id: user.id,
        },
      );

      if (analyticsError) throw analyticsError;
      setAnalytics(analyticsData[0]);
    } catch (error) {
      console.error("Error fetching profile/analytics:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSignOut = () => {
    setSignOutVisible(true);
  };

  const confirmSignOut = async () => {
    await signOut();
    router.replace("/(auth)/login" as any);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"] as any,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].uri) {
      setUploading(true);
      try {
        const { error } = await supabase
          .from("farmer_account_table")
          .update({
            farmer_account_profile_image_url: result.assets[0].uri,
            farmer_account_updated_at: new Date().toISOString(),
          })
          .eq("farmer_account_id", user?.id);

        if (error) throw error;
        setProfile((prev: any) => ({
          ...prev,
          farmer_account_profile_image_url: result.assets[0].uri,
        }));
      } catch (error) {
        console.error("Error uploading image:", error);
      } finally {
        setUploading(false);
      }
    }
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

  return (
    <ScrollView
      style={[
        styles.container,
        { backgroundColor: isDark ? "#121212" : "#F8FBF9" },
      ]}
    >
      <ModernModal
        visible={signOutVisible}
        onClose={() => setSignOutVisible(false)}
        title="Sign Out"
        message="Are you sure you want to sign out of your account?"
        type="warning"
        confirmText="Sign Out"
        onConfirm={confirmSignOut}
      />

      <View style={styles.header}>
        <View style={styles.profileHeader}>
          <TouchableOpacity onPress={pickImage} disabled={uploading}>
            <View style={styles.imageContainer}>
              <Image
                source={{
                  uri:
                    profile?.farmer_account_profile_image_url ||
                    "https://placehold.co/200x200?text=Profile",
                }}
                style={styles.profileImage}
              />
              <View style={styles.editBadge}>
                {uploading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <MaterialIcons name="edit" size={14} color="#FFF" />
                )}
              </View>
            </View>
          </TouchableOpacity>
          <View style={styles.profileInfo}>
            <Text style={styles.name}>
              {profile?.farmer_account_first_name}{" "}
              {profile?.farmer_account_last_name}
            </Text>
            <Text style={styles.email}>{profile?.farmer_account_email}</Text>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <Text
          style={[
            styles.sectionTitle,
            { color: isDark ? "#FFFFFF" : "#1B4332" },
          ]}
        >
          Harvest Analytics
        </Text>

        <View style={styles.analyticsGrid}>
          <View style={[styles.analyticsCard, { backgroundColor: "#D8F3DC" }]}>
            <MaterialIcons name="inventory" size={24} color="#1B4332" />
            <Text style={styles.analyticsValue}>
              {analytics?.total_items || 0}
            </Text>
            <Text style={styles.analyticsLabel}>Total Items</Text>
          </View>
          <View style={[styles.analyticsCard, { backgroundColor: "#B7E4C7" }]}>
            <MaterialIcons name="check-circle" size={24} color="#1B4332" />
            <Text style={styles.analyticsValue}>
              {analytics?.ready_items || 0}
            </Text>
            <Text style={styles.analyticsLabel}>Ready to Harvest</Text>
          </View>
          <View style={[styles.analyticsCard, { backgroundColor: "#95D5B2" }]}>
            <MaterialIcons name="wb-sunny" size={24} color="#1B4332" />
            <Text style={styles.analyticsValue}>
              {analytics?.avg_sweetness?.toFixed(1) || "0.0"}
            </Text>
            <Text style={styles.analyticsLabel}>Avg Sweetness (°Bx)</Text>
          </View>
        </View>

        <View style={styles.menuSection}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push("/management/settings" as any)}
          >
            <View style={styles.menuMain}>
              <MaterialIcons name="settings" size={20} color="#2D6A4F" />
              <Text style={styles.menuText}>Farm Settings</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color="#A0A0A0" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, styles.logoutItem]}
            onPress={handleSignOut}
          >
            <View style={styles.menuMain}>
              <MaterialIcons name="logout" size={20} color="#D90429" />
              <Text style={styles.logoutText}>Sign Out</Text>
            </View>
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
    paddingTop: 80,
    paddingHorizontal: 24,
    paddingBottom: 40,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    backgroundColor: "#2D6A4F",
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  imageContainer: {
    position: "relative",
  },
  editBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#2D6A4F",
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  profileInfo: {
    marginLeft: 16,
  },
  name: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  email: {
    fontSize: 14,
    color: "#D8F3DC",
    marginTop: 2,
  },
  content: {
    padding: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 20,
  },
  analyticsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  analyticsCard: {
    flex: 1,
    padding: 16,
    borderRadius: 20,
    alignItems: "center",
  },
  analyticsValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1B4332",
    marginTop: 8,
  },
  analyticsLabel: {
    fontSize: 10,
    color: "#2D6A4F",
    textAlign: "center",
    marginTop: 4,
    fontWeight: "600",
  },
  menuSection: {
    marginTop: 40,
    gap: 12,
  },
  menuItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 18,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  menuMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  menuText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1B4332",
  },
  logoutItem: {
    marginTop: 20,
    borderColor: "#FFD7D7",
    borderWidth: 1,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#D90429",
  },
});
