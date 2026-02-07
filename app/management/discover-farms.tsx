import { ModernModal } from "@/components/ui/modern-modal";
import { useAuth } from "@/context/auth";
import { supabase } from "@/lib/supabase";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function DiscoverFarmsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [allFarms, setAllFarms] = useState<any[]>([]);
  const [filteredFarms, setFilteredFarms] = useState<any[]>([]);
  const [userMemberships, setUserMemberships] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [modalConfig, setModalConfig] = useState<any>({
    title: "",
    message: "",
    type: "info",
    onConfirm: () => {},
  });

  const showAlert = (
    title: string,
    message: string,
    type: "success" | "warning" | "error" | "info" = "info",
    onConfirm?: () => void,
  ) => {
    setModalConfig({
      title,
      message,
      type,
      onConfirm: onConfirm || (() => setModalVisible(false)),
    });
    setModalVisible(true);
  };

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      // 1. Fetch user memberships to check status
      const { data: memberships } = await supabase
        .from("farm_membership_table")
        .select("*")
        .eq("farmer_account_id", user.id);
      setUserMemberships(memberships || []);

      // 2. Fetch all available farms
      const { data: farmsData } = await supabase
        .from("farm_group_table")
        .select(
          "*, farmer_account_table(farmer_account_first_name, farmer_account_last_name)",
        )
        .is("farm_group_deleted_at", null);

      setAllFarms(farmsData || []);
      setFilteredFarms(farmsData || []);
    } catch (error) {
      console.error("Error fetching farm data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (search.trim() === "") {
      setFilteredFarms(allFarms);
    } else {
      const filtered = allFarms.filter(
        (f) =>
          f.farm_group_name?.toLowerCase().includes(search.toLowerCase()) ||
          f.farm_group_description
            ?.toLowerCase()
            .includes(search.toLowerCase()),
      );
      setFilteredFarms(filtered);
    }
  }, [search, allFarms]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleJoinFarm = async (groupId: string) => {
    try {
      const { error } = await supabase.rpc("join_farm_group", {
        p_farmer_id: user?.id,
        p_group_id: groupId,
      });
      if (error) throw error;
      showAlert("Success", "Join request sent!", "success");
      fetchData();
    } catch (error: any) {
      showAlert("Error", error.message, "error");
    }
  };

  const renderFarmItem = ({ item }: { item: any }) => {
    const myMembership = userMemberships.find(
      (m) => m.farm_group_id === item.farm_group_id,
    );
    const isPending = myMembership?.farm_membership_status === "PENDING";
    const isRejected = myMembership?.farm_membership_status === "REJECTED";
    const isAccepted = myMembership?.farm_membership_status === "ACCEPTED";

    return (
      <View style={styles.farmItem}>
        <View style={styles.farmMain}>
          <Text style={styles.farmName}>{item.farm_group_name}</Text>
          <Text style={styles.farmOwner}>
            Owner: {item.farmer_account_table.farmer_account_first_name}{" "}
            {item.farmer_account_table.farmer_account_last_name}
          </Text>
          {item.farm_group_description ? (
            <Text style={styles.farmDesc} numberOfLines={2}>
              {item.farm_group_description}
            </Text>
          ) : null}
        </View>

        <View style={styles.actionContainer}>
          {isAccepted ? (
            <View style={styles.joinedBadge}>
              <MaterialIcons name="check-circle" size={24} color="#2D6A4F" />
              <Text style={styles.joinedText}>Joined</Text>
            </View>
          ) : isPending ? (
            <View style={styles.pendingBadge}>
              <MaterialIcons name="hourglass-empty" size={20} color="#F59E0B" />
              <Text style={styles.pendingText}>Pending</Text>
            </View>
          ) : isRejected ? (
            <View style={styles.rejectedBadge}>
              <MaterialIcons name="error-outline" size={20} color="#D90429" />
              <Text style={styles.rejectedText}>Rejected</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.joinBtn}
              onPress={() => handleJoinFarm(item.farm_group_id)}
            >
              <Text style={styles.joinBtnText}>Join</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2D6A4F" />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#2D6A4F" }}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <MaterialIcons name="arrow-back" size={24} color="#2D6A4F" />
          </TouchableOpacity>
          <Text style={styles.title}>Discover Farms</Text>
        </View>

        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <MaterialIcons name="search" size={20} color="#6C757D" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or description..."
              value={search}
              onChangeText={setSearch}
              placeholderTextColor="#A0A0A0"
            />
          </View>
        </View>

        <FlatList
          data={filteredFarms}
          renderItem={renderFarmItem}
          keyExtractor={(item) => item.farm_group_id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#2D6A4F"]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="search-off" size={64} color="#D8F3DC" />
              <Text style={styles.emptyText}>No farms found.</Text>
            </View>
          }
        />

        <ModernModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          title={modalConfig.title}
          message={modalConfig.message}
          type={modalConfig.type}
          confirmText="OK"
          onConfirm={modalConfig.onConfirm}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FBF9" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    padding: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#D8F3DC",
    justifyContent: "center",
    alignItems: "center",
  },
  title: { fontSize: 24, fontWeight: "800", color: "#1B4332" },
  searchContainer: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 52,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: "#1B4332",
  },
  listContent: {
    padding: 24,
    paddingTop: 0,
  },
  farmItem: {
    backgroundColor: "#FFF",
    padding: 20,
    borderRadius: 24,
    marginBottom: 16,
    elevation: 2,
    shadowColor: "#2D6A4F",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  farmMain: { flex: 1, marginRight: 16 },
  farmName: { fontSize: 18, fontWeight: "700", color: "#1B4332" },
  farmOwner: { fontSize: 12, color: "#74C69D", marginTop: 2 },
  farmDesc: { fontSize: 13, color: "#6C757D", marginTop: 8, lineHeight: 18 },
  actionContainer: { alignItems: "center", minWidth: 80 },
  joinBtn: {
    backgroundColor: "#2D6A4F",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  joinBtnText: { color: "#FFF", fontWeight: "700", fontSize: 14 },
  joinedBadge: { alignItems: "center", gap: 4 },
  joinedText: { fontSize: 12, fontWeight: "700", color: "#2D6A4F" },
  pendingBadge: { alignItems: "center", gap: 4 },
  pendingText: { fontSize: 12, fontWeight: "700", color: "#F59E0B" },
  rejectedBadge: { alignItems: "center", gap: 4 },
  rejectedText: { fontSize: 12, fontWeight: "700", color: "#D90429" },
  emptyContainer: {
    alignItems: "center",
    marginTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: "#6C757D",
    marginTop: 16,
    fontWeight: "600",
  },
});
