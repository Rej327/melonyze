import { ModernModal } from "@/components/ui/modern-modal";
import { useAuth } from "@/context/auth";
import { useFarm } from "@/context/farm";
import { supabase } from "@/lib/supabase";
import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface FarmerAnalytics {
  total_items: number;
  ready_items: number;
  avg_sweetness: number;
}

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { activeFarm, isOwner, refreshFarms, loading: farmLoading } = useFarm();
  const [profile, setProfile] = useState<any>(null);

  const [analytics, setAnalytics] = useState<FarmerAnalytics | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [signOutVisible, setSignOutVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      // Fetch profile (still need this for email/name)
      const { data: profileData, error: profileError } = await supabase
        .from("farmer_account_table")
        .select("*")
        .eq("farmer_account_id", user.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Fetch analytics (prefer group-based if in a group)
      if (activeFarm) {
        const { data: analyticsData, error: analyticsError } =
          await supabase.rpc("get_group_analytics", {
            p_group_id: activeFarm.farm_group_id,
          });
        if (analyticsError) throw analyticsError;
        setAnalytics(analyticsData[0]);
      } else {
        // No group, no analytics
        setAnalytics({
          total_items: 0,
          ready_items: 0,
          avg_sweetness: 0,
        } as any);
      }
    } catch (error) {
      console.error("Error fetching profile/analytics:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, activeFarm]);

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

  if (loading || farmLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: "#F8FBF9" }]}>
        <ActivityIndicator size="large" color="#2D6A4F" />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#F8FBF9" }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await Promise.all([fetchData(), refreshFarms()]);
          }}
          colors={["#2D6A4F"]}
        />
      }
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

      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
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
            {activeFarm ? (
              <View style={styles.activeFarmBadge}>
                <MaterialIcons name="agriculture" size={12} color="#D8F3DC" />
                <Text style={styles.activeFarmText}>
                  {activeFarm.farm_group_name}
                </Text>
              </View>
            ) : (
              <View
                style={[styles.activeFarmBadge, { backgroundColor: "#D90429" }]}
              >
                <MaterialIcons name="warning" size={12} color="#FFF" />
                <Text style={[styles.activeFarmText, { color: "#FFF" }]}>
                  No Active Farm
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionTitle}>
          {activeFarm
            ? `${activeFarm.farm_group_name} Analytics`
            : "Harvest Analytics"}
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
            onPress={() => router.push("/management/farm-group" as any)}
          >
            <View style={styles.menuMain}>
              <MaterialIcons name="group" size={20} color="#2D6A4F" />
              <Text style={styles.menuText}>Farm Management</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color="#A0A0A0" />
          </TouchableOpacity>

          {isOwner && (
            <>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() =>
                  router.push("/management/item-management" as any)
                }
              >
                <View style={styles.menuMain}>
                  <MaterialIcons name="assignment" size={20} color="#2D6A4F" />
                  <Text style={styles.menuText}>Item Management</Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color="#A0A0A0" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() =>
                  router.push("/management/sales-management" as any)
                }
              >
                <View style={styles.menuMain}>
                  <MaterialIcons name="payments" size={20} color="#2D6A4F" />
                  <Text style={styles.menuText}>Sales Management</Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color="#A0A0A0" />
              </TouchableOpacity>
            </>
          )}

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
    backgroundColor: "#2D6A4F",
    paddingBottom: 32,
    paddingHorizontal: 24,
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
    opacity: 0.9,
  },
  activeFarmBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 8,
    alignSelf: "flex-start",
    gap: 4,
  },
  activeFarmText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#D8F3DC",
    textTransform: "uppercase",
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
