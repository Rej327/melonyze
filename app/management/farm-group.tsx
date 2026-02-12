import { ModernHeader } from "@/components/ui/modern-header";
import { ModernModal } from "@/components/ui/modern-modal";
import { useAuth } from "@/context/auth";
import { useFarm } from "@/context/farm";
import { supabase } from "@/lib/supabase";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function FarmGroupScreen() {
  const { user } = useAuth();
  const { activeFarm, myFarms, refreshFarms, loading: farmLoading } = useFarm();

  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentGroup, setCurrentGroup] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

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
    setLoading(true);
    try {
      // 1. Determine which farm to show details for
      let activeId = selectedFarmId || activeFarm?.farm_group_id;
      if (!activeId && myFarms.length > 0) {
        activeId = myFarms[0].farm_group_id;
      }

      if (activeId) {
        setSelectedFarmId(activeId);
        // Get Group Details
        const { data: groupData } = await supabase
          .from("farm_group_table")
          .select("*")
          .eq("farm_group_id", activeId)
          .single();
        setCurrentGroup(groupData);

        // Get Members
        const { data: membersData } = await supabase
          .from("farm_membership_table")
          .select("*, farmer_account_table(*)")
          .eq("farm_group_id", activeId)
          .eq("farm_membership_status", "ACCEPTED");
        setMembers(membersData || []);

        // If owner, get pending requests
        if (groupData?.farm_owner_id === user.id) {
          const { data: requestsData } = await supabase
            .from("farm_membership_table")
            .select("*, farmer_account_table(*)")
            .eq("farm_group_id", activeId)
            .eq("farm_membership_status", "PENDING");
          setRequests(requestsData || []);
        } else {
          setRequests([]);
        }
      }
    } catch (error) {
      console.error("Error fetching farm group data:", error);
    } finally {
      setLoading(false);
    }
  }, [user, selectedFarmId, activeFarm, myFarms]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateFarm = async () => {
    if (!groupName) {
      showAlert("Error", "Please enter a farm name.", "error");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.rpc("create_farm_group", {
        p_owner_id: user?.id,
        p_name: groupName,
        p_description: groupDesc,
      });

      if (error) throw error;

      showAlert("Success", "Farm group created successfully!", "success");
      setIsCreating(false);
      setGroupName("");
      setGroupDesc("");
      await refreshFarms(); // Update global context
      fetchData();
    } catch (error: any) {
      showAlert("Error", error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const setDefaultFarm = async (farmId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc("set_default_farm", {
        p_farmer_id: user?.id,
        p_group_id: farmId,
      });

      if (error) throw error;

      await refreshFarms(); // Update global context
      showAlert("Success", "Default farm updated.", "success");
    } catch (error: any) {
      showAlert("Error", error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRequest = async (
    requestId: string,
    status: "ACCEPTED" | "REJECTED",
  ) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("farm_membership_table")
        .update({ farm_membership_status: status })
        .eq("farm_membership_id", requestId);

      if (error) throw error;
      fetchData();
    } catch (error: any) {
      showAlert("Error", error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const kickMember = async (memberUserId: string) => {
    showAlert(
      "Confirm Removal",
      "Are you sure you want to remove this member from the farm?",
      "warning",
      async () => {
        setModalVisible(false);
        setLoading(true);
        try {
          const { error } = await supabase
            .from("farm_membership_table")
            .delete()
            .eq("farm_group_id", selectedFarmId)
            .eq("farmer_account_id", memberUserId);

          if (error) throw error;
          fetchData();
        } catch (error: any) {
          showAlert("Error", error.message, "error");
        } finally {
          setLoading(false);
        }
      },
    );
  };

  if ((loading || farmLoading) && !isCreating) {
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
        title="Farm Management"
        subtitle={activeFarm?.farm_group_name || "Manage your groups"}
        onBack={() => router.back()}
      />
      <View style={[styles.container, { backgroundColor: "#F8FBF9" }]}>
        <ModernModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          title={modalConfig.title}
          message={modalConfig.message}
          type={modalConfig.type}
          onConfirm={modalConfig.onConfirm}
        />

        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: insets.bottom + 100 },
          ]}
        >
          {/* Farm List Chips */}
          <View style={styles.farmChips}>
            {myFarms.map((farm) => (
              <TouchableOpacity
                key={farm.farm_group_id}
                style={[
                  styles.farmChip,
                  selectedFarmId === farm.farm_group_id &&
                    styles.farmChipActive,
                ]}
                onPress={() => setSelectedFarmId(farm.farm_group_id)}
              >
                <Text
                  style={[
                    styles.farmChipText,
                    selectedFarmId === farm.farm_group_id &&
                      styles.farmChipTextActive,
                  ]}
                >
                  {farm.farm_group_name}
                </Text>
                {activeFarm?.farm_group_id === farm.farm_group_id && (
                  <MaterialIcons
                    name="star"
                    size={14}
                    color="#FFD700"
                    style={{ marginLeft: 4 }}
                  />
                )}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.addFarmChip}
              onPress={() => setIsCreating(true)}
            >
              <MaterialIcons name="add" size={20} color="#2D6A4F" />
            </TouchableOpacity>
          </View>

          {isCreating ? (
            <View style={styles.createForm}>
              <Text style={styles.sectionTitle}>Create New Farm</Text>
              <TextInput
                style={styles.input}
                placeholder="Farm Name"
                value={groupName}
                onChangeText={setGroupName}
              />
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Description (Optional)"
                multiline
                numberOfLines={3}
                value={groupDesc}
                onChangeText={setGroupDesc}
              />
              <View style={styles.formActions}>
                <TouchableOpacity
                  style={[styles.formButton, styles.cancelButton]}
                  onPress={() => setIsCreating(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.formButton, styles.saveButton]}
                  onPress={handleCreateFarm}
                >
                  <Text style={styles.saveButtonText}>Create Farm</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : currentGroup ? (
            <View style={styles.details}>
              <View style={styles.groupInfo}>
                <View style={styles.groupHeader}>
                  <View style={styles.iconBox}>
                    <MaterialIcons
                      name="agriculture"
                      size={32}
                      color="#FFFFFF"
                    />
                  </View>
                  <View style={styles.titleInfo}>
                    <Text style={styles.groupName}>
                      {currentGroup.farm_group_name}
                    </Text>
                    <Text style={styles.groupOwner}>
                      Owner:{" "}
                      {currentGroup.farm_owner_id === user?.id
                        ? "You"
                        : "Other"}
                    </Text>
                  </View>
                </View>

                <Text style={styles.groupDesc}>
                  {currentGroup.farm_group_description ||
                    "No description provided."}
                </Text>

                {activeFarm?.farm_group_id !== currentGroup.farm_group_id && (
                  <TouchableOpacity
                    style={styles.defaultButton}
                    onPress={() => setDefaultFarm(currentGroup.farm_group_id)}
                  >
                    <MaterialIcons
                      name="star-outline"
                      size={20}
                      color="#2D6A4F"
                    />
                    <Text style={styles.defaultButtonText}>
                      Set as Default Farm
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Pending Requests Section */}
              {currentGroup.farm_owner_id === user?.id &&
                requests.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>
                      Join Requests ({requests.length})
                    </Text>
                    {requests.map((req) => (
                      <View
                        key={req.farm_membership_id}
                        style={styles.requestCard}
                      >
                        <View style={styles.userInfo}>
                          <View style={styles.userAvatar}>
                            <Text style={styles.avatarText}>
                              {
                                req.farmer_account_table
                                  ?.farmer_account_first_name?.[0]
                              }
                            </Text>
                          </View>
                          <View>
                            <Text style={styles.userName}>
                              {
                                req.farmer_account_table
                                  ?.farmer_account_first_name
                              }{" "}
                              {
                                req.farmer_account_table
                                  ?.farmer_account_last_name
                              }
                            </Text>
                            <Text style={styles.userEmail}>
                              {req.farmer_account_table?.farmer_account_email}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.requestButtons}>
                          <TouchableOpacity
                            style={[styles.actionBtn, styles.rejectBtn]}
                            onPress={() =>
                              handleRequest(req.farm_membership_id, "REJECTED")
                            }
                          >
                            <MaterialIcons
                              name="close"
                              size={20}
                              color="#D90429"
                            />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.actionBtn, styles.acceptBtn]}
                            onPress={() =>
                              handleRequest(req.farm_membership_id, "ACCEPTED")
                            }
                          >
                            <MaterialIcons
                              name="check"
                              size={20}
                              color="#FFFFFF"
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

              {/* Members Section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  Farm Members ({members.length})
                </Text>
                {members.map((mem) => (
                  <View key={mem.farm_membership_id} style={styles.memberCard}>
                    <View style={styles.userInfo}>
                      <View style={styles.userAvatar}>
                        <Text style={styles.avatarText}>
                          {
                            mem.farmer_account_table
                              ?.farmer_account_first_name?.[0]
                          }
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.userName}>
                          {mem.farmer_account_table?.farmer_account_first_name}{" "}
                          {mem.farmer_account_table?.farmer_account_last_name}
                          {mem.farmer_account_id ===
                            currentGroup.farm_owner_id && " (Owner)"}
                        </Text>
                        <Text style={styles.userEmail}>
                          {mem.farmer_account_table?.farmer_account_email}
                        </Text>
                      </View>
                    </View>
                    {currentGroup.farm_owner_id === user?.id &&
                      mem.farmer_account_id !== user?.id && (
                        <TouchableOpacity
                          style={styles.kickBtn}
                          onPress={() => kickMember(mem.farmer_account_id)}
                        >
                          <MaterialIcons
                            name="person-remove"
                            size={20}
                            color="#D90429"
                          />
                        </TouchableOpacity>
                      )}
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.emptyDetails}>
              <MaterialIcons name="house" size={80} color="#E0E0E0" />
              <Text style={styles.emptyTitle}>No Farms Joined</Text>
              <Text style={styles.emptyDesc}>
                You haven&apos;t created or joined any farms yet. Start by
                creating your own or discovering available farms.
              </Text>
              <TouchableOpacity
                style={styles.discoverButton}
                onPress={() => router.push("/management/discover-farms")}
              >
                <MaterialIcons name="search" size={20} color="#FFF" />
                <Text style={styles.discoverButtonText}>Discover Farms</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.createShortcutButton}
                onPress={() => setIsCreating(true)}
              >
                <MaterialIcons name="add" size={20} color="#2D6A4F" />
                <Text style={styles.createShortcutText}>Create New Farm</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {!isCreating && (
          <View
            style={[
              styles.footer,
              { paddingBottom: Math.max(24, insets.bottom + 16) },
            ]}
          >
            <TouchableOpacity
              style={styles.discoverButtonOutlined}
              onPress={() => router.push("/management/discover-farms")}
            >
              <MaterialIcons name="search" size={20} color="#2D6A4F" />
              <Text style={styles.discoverText}>Find More Farms</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FBF9" },
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
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
    elevation: 2,
  },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#FFFFFF" },
  scroll: { paddingBottom: 100 },
  farmChips: {
    flexDirection: "row",
    paddingHorizontal: 24,
    paddingVertical: 12,
    flexWrap: "wrap",
    gap: 8,
  },
  farmChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  farmChipActive: { backgroundColor: "#2D6A4F", borderColor: "#2D6A4F" },
  farmChipText: { fontSize: 14, fontWeight: "600", color: "#1B4332" },
  farmChipTextActive: { color: "#FFF" },
  addFarmChip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#D8F3DC",
    justifyContent: "center",
    alignItems: "center",
  },
  createForm: { padding: 24 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1B4332",
    marginBottom: 16,
  },
  input: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    marginBottom: 16,
  },
  textArea: { height: 100, paddingTop: 12 },
  formActions: { flexDirection: "row", gap: 12 },
  formButton: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelButton: { backgroundColor: "#F0F0F0" },
  cancelButtonText: { fontWeight: "700", color: "#666" },
  saveButton: { backgroundColor: "#2D6A4F" },
  saveButtonText: { fontWeight: "700", color: "#FFF" },
  details: { padding: 24 },
  groupInfo: {
    backgroundColor: "#FFF",
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    elevation: 4,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 16,
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#2D6A4F",
    justifyContent: "center",
    alignItems: "center",
  },
  titleInfo: { flex: 1 },
  groupName: { fontSize: 22, fontWeight: "800", color: "#1B4332" },
  groupOwner: { fontSize: 13, color: "#74C69D", fontWeight: "600" },
  groupDesc: { fontSize: 15, color: "#666", lineHeight: 22 },
  defaultButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  defaultButtonText: { fontSize: 15, fontWeight: "700", color: "#2D6A4F" },
  section: { marginBottom: 32 },
  requestCard: {
    flexDirection: "row",
    backgroundColor: "#FFF",
    padding: 16,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  memberCard: {
    flexDirection: "row",
    backgroundColor: "#FFF",
    padding: 16,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  userInfo: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#95D5B2",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { fontSize: 18, fontWeight: "800", color: "#FFF" },
  userName: { fontSize: 16, fontWeight: "700", color: "#1B4332" },
  userEmail: { fontSize: 12, color: "#999" },
  requestButtons: { flexDirection: "row", gap: 8 },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  rejectBtn: { backgroundColor: "#FDE2E4" },
  acceptBtn: { backgroundColor: "#2D6A4F" },
  kickBtn: { padding: 8 },
  emptyDetails: { alignItems: "center", padding: 40, marginTop: 40 },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1B4332",
    marginTop: 20,
  },
  emptyDesc: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginTop: 12,
    lineHeight: 22,
  },
  discoverButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#2D6A4F",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 24,
    width: "100%",
  },
  discoverButtonText: { color: "#FFF", fontWeight: "700", fontSize: 16 },
  createShortcutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 12,
    width: "100%",
    borderWidth: 2,
    borderColor: "#2D6A4F",
  },
  createShortcutText: { color: "#2D6A4F", fontWeight: "700", fontSize: 16 },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    backgroundColor: "#F8FBF9",
  },
  discoverButtonOutlined: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 56,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#2D6A4F",
    backgroundColor: "#FFF",
  },
  discoverText: { fontSize: 16, fontWeight: "700", color: "#2D6A4F" },
  headerActionButton: {
    width: 40,
    height: 40,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
});
