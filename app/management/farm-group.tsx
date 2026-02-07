import { ModernModal } from "@/components/ui/modern-modal";
import { useAuth } from "@/context/auth";
import { supabase } from "@/lib/supabase";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
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
import { SafeAreaView } from "react-native-safe-area-context";

export default function FarmGroupScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentGroup, setCurrentGroup] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [profile, setProfile] = useState<any>(null);
  const [myFarms, setMyFarms] = useState<any[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);

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
      // 1. Get Profile with current_farm_group_id
      const { data: profileData } = await supabase
        .from("farmer_account_table")
        .select("*, current_farm_group_id")
        .eq("farmer_account_id", user.id)
        .single();

      setProfile(profileData);

      // 2. Fetch all user memberships
      const { data: memberships } = await supabase
        .from("farm_membership_table")
        .select("*, farm_group_table(*)")
        .eq("farmer_account_id", user.id);

      const accepted =
        memberships?.filter((m) => m.farm_membership_status === "ACCEPTED") ||
        [];
      const acceptedFarms = accepted.map((m) => m.farm_group_table);
      setMyFarms(acceptedFarms);

      // 3. Determine which farm to show details for
      let activeId = selectedFarmId || profileData?.current_farm_group_id;
      if (!activeId && acceptedFarms.length > 0) {
        activeId = acceptedFarms[0].farm_group_id;
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

        // Get Requests (if owner)
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
      } else {
        setCurrentGroup(null);
        setMembers([]);
        setRequests([]);
      }
    } catch (error) {
      console.error("Error fetching farm data:", error);
    } finally {
      setLoading(false);
    }
  }, [user, selectedFarmId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleManageRequest = async (membershipId: string, status: string) => {
    try {
      const { error } = await supabase.rpc("manage_farm_membership", {
        p_owner_id: user?.id,
        p_membership_id: membershipId,
        p_status: status,
      });
      if (error) throw error;
      fetchData();
    } catch (error: any) {
      showAlert("Error", error.message, "error");
    }
  };

  const handleKickMember = async (membershipId: string, memberName: string) => {
    showAlert(
      "Confirm Kick",
      `Are you sure you want to remove ${memberName} from the farm?`,
      "warning",
      async () => {
        setModalVisible(false);
        setLoading(true);
        try {
          const { error } = await supabase.rpc("delete_farm_membership", {
            p_executing_user_id: user?.id,
            p_membership_id: membershipId,
          });
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

  const handleCreateGroup = async () => {
    if (!groupName) {
      showAlert("Error", "Please enter a group name", "error");
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
      setIsCreating(false);

      // Auto-select the new farm
      const { data: newGroups } = await supabase
        .from("farm_group_table")
        .select("farm_group_id")
        .eq("farm_owner_id", user?.id)
        .order("farm_group_created_at", { ascending: false })
        .limit(1);
      if (newGroups && newGroups.length > 0) {
        setSelectedFarmId(newGroups[0].farm_group_id);
      }

      fetchData();
    } catch (error: any) {
      showAlert("Error", error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefault = async (groupId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc("set_default_farm", {
        p_farmer_id: user?.id,
        p_group_id: groupId,
      });
      if (error) throw error;
      showAlert("Success", "Default farm updated!", "success");
      fetchData();
    } catch (error: any) {
      showAlert("Error", error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
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
          <Text style={styles.title}>Farm Management</Text>
        </View>

        <ModernModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          title={modalConfig.title}
          message={modalConfig.message}
          type={modalConfig.type}
          confirmText={modalConfig.type === "warning" ? "Confirm" : "OK"}
          onConfirm={modalConfig.onConfirm}
        />

        <ModernModal
          visible={isCreating}
          onClose={() => setIsCreating(false)}
          title="Create New Farm Group"
          confirmText="Create Group"
          onConfirm={handleCreateGroup}
          type="info"
        >
          <View style={{ width: "100%", marginTop: 10 }}>
            <TextInput
              style={styles.input}
              placeholder="Farm Name"
              value={groupName}
              onChangeText={setGroupName}
              placeholderTextColor="#6C757D"
            />
            <TextInput
              style={[styles.input, { height: 100, textAlignVertical: "top" }]}
              placeholder="Description"
              multiline
              value={groupDesc}
              onChangeText={setGroupDesc}
              placeholderTextColor="#6C757D"
            />
          </View>
        </ModernModal>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Farm Selection Strip */}
          {myFarms.length > 0 && (
            <View style={styles.farmSelectorSection}>
              <Text style={styles.sectionSubtitle}>Select Working Farm</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.farmBadgeScroll}
              >
                {myFarms.map((f) => (
                  <TouchableOpacity
                    key={f.farm_group_id}
                    style={[
                      styles.farmBadge,
                      selectedFarmId === f.farm_group_id &&
                        styles.farmBadgeActive,
                      profile?.current_farm_group_id === f.farm_group_id &&
                        styles.farmBadgeDefault,
                    ]}
                    onPress={() => setSelectedFarmId(f.farm_group_id)}
                  >
                    <Text
                      style={[
                        styles.farmBadgeText,
                        selectedFarmId === f.farm_group_id &&
                          styles.farmBadgeTextActive,
                      ]}
                    >
                      {f.farm_group_name}
                    </Text>
                    {profile?.current_farm_group_id === f.farm_group_id && (
                      <MaterialIcons
                        name="star"
                        size={12}
                        color="#F59E0B"
                        style={{ marginLeft: 4 }}
                      />
                    )}
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={styles.addFarmBadge}
                  onPress={() => setIsCreating(true)}
                >
                  <MaterialIcons name="add" size={20} color="#2D6A4F" />
                </TouchableOpacity>
              </ScrollView>
            </View>
          )}

          {currentGroup ? (
            <View>
              <View style={styles.groupCard}>
                <View style={styles.groupHeader}>
                  <MaterialIcons name="agriculture" size={40} color="#2D6A4F" />
                  <View style={styles.groupInfo}>
                    <Text style={styles.groupName}>
                      {currentGroup.farm_group_name}
                    </Text>
                    <Text style={styles.groupDesc}>
                      {currentGroup.farm_group_description || "No description"}
                    </Text>
                  </View>
                </View>

                <View style={styles.groupFooter}>
                  <View style={styles.roleBadge}>
                    <Text style={styles.roleText}>
                      {currentGroup.farm_owner_id === user?.id
                        ? "FARM OWNER"
                        : "MEMBER"}
                    </Text>
                  </View>

                  {profile?.current_farm_group_id !==
                  currentGroup.farm_group_id ? (
                    <TouchableOpacity
                      style={styles.setDefaultSmallBtn}
                      onPress={() =>
                        handleSetDefault(currentGroup.farm_group_id)
                      }
                    >
                      <MaterialIcons
                        name="star-outline"
                        size={16}
                        color="#F59E0B"
                      />
                      <Text style={styles.setDefaultText}>Set as Default</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.defaultIndicator}>
                      <MaterialIcons name="star" size={16} color="#F59E0B" />
                      <Text style={styles.defaultIndicatorText}>
                        Default active farm
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {currentGroup.farm_owner_id === user?.id &&
                requests.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>
                      Join Requests ({requests.length})
                    </Text>
                    {requests.map((req) => (
                      <View
                        key={req.farm_membership_id}
                        style={styles.requestItem}
                      >
                        <View style={styles.requestMain}>
                          <Text style={styles.memberName}>
                            {req.farmer_account_table.farmer_account_first_name}{" "}
                            {req.farmer_account_table.farmer_account_last_name}
                          </Text>
                          <Text style={styles.memberEmail}>
                            {req.farmer_account_table.farmer_account_email}
                          </Text>
                        </View>
                        <View style={styles.actionButtons}>
                          <TouchableOpacity
                            style={[styles.actionBtn, styles.acceptBtn]}
                            onPress={() =>
                              handleManageRequest(
                                req.farm_membership_id,
                                "ACCEPTED",
                              )
                            }
                          >
                            <MaterialIcons
                              name="check"
                              size={20}
                              color="#FFF"
                            />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.actionBtn, styles.rejectBtn]}
                            onPress={() =>
                              handleManageRequest(
                                req.farm_membership_id,
                                "REJECTED",
                              )
                            }
                          >
                            <MaterialIcons
                              name="close"
                              size={20}
                              color="#FFF"
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Farm Members</Text>
                {members.map((member) => (
                  <View
                    key={member.farm_membership_id}
                    style={styles.memberItem}
                  >
                    <View style={styles.memberAvatar}>
                      <Text style={styles.avatarText}>
                        {
                          member.farmer_account_table
                            .farmer_account_first_name[0]
                        }
                      </Text>
                    </View>
                    <View style={styles.memberMain}>
                      <Text style={styles.memberName}>
                        {member.farmer_account_table.farmer_account_first_name}{" "}
                        {member.farmer_account_table.farmer_account_last_name}
                        {member.farmer_account_id ===
                          currentGroup.farm_owner_id && " (Owner)"}
                      </Text>
                      <Text style={styles.memberEmail}>
                        {member.farmer_account_table.farmer_account_email}
                      </Text>
                    </View>
                    {currentGroup.farm_owner_id === user?.id &&
                      member.farmer_account_id !== user?.id && (
                        <TouchableOpacity
                          style={styles.kickBtn}
                          onPress={() =>
                            handleKickMember(
                              member.farm_membership_id,
                              member.farmer_account_table
                                .farmer_account_first_name,
                            )
                          }
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
            <View style={styles.noGroupContainer}>
              <MaterialIcons name="group-add" size={80} color="#D8F3DC" />
              <Text style={styles.noGroupTitle}>No Farm Group Yet</Text>
              <Text style={styles.noGroupDesc}>
                Join an existing farm group to collaborate or create your own if
                you are a farm owner.
              </Text>

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => setIsCreating(true)}
              >
                <Text style={styles.primaryBtnText}>Create a Farm</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={styles.discoverCard}
            onPress={() => router.push("/management/discover-farms" as any)}
          >
            <View style={styles.discoverContent}>
              <View style={styles.discoverIconContainer}>
                <MaterialIcons name="explore" size={32} color="#2D6A4F" />
              </View>
              <View style={styles.discoverTextContainer}>
                <Text style={styles.discoverTitle}>Discover More Farms</Text>
                <Text style={styles.discoverDesc}>
                  Join other farm groups to collaborate and expand your network.
                </Text>
              </View>
              <MaterialIcons
                name="chevron-right"
                size={24}
                color="#2D6A4F"
                style={{ opacity: 0.5 }}
              />
            </View>
          </TouchableOpacity>
        </ScrollView>
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
  scrollContent: { padding: 24 },
  groupCard: {
    backgroundColor: "#FFF",
    padding: 20,
    borderRadius: 24,
    elevation: 4,
    shadowColor: "#2D6A4F",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    marginBottom: 24,
  },
  groupHeader: { flexDirection: "row", alignItems: "center", gap: 16 },
  groupInfo: { flex: 1 },
  groupName: { fontSize: 20, fontWeight: "800", color: "#1B4332" },
  groupDesc: { fontSize: 14, color: "#6C757D", marginTop: 4 },
  roleBadge: {
    marginTop: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#D8F3DC",
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  roleText: { fontSize: 10, fontWeight: "800", color: "#2D6A4F" },
  section: { marginTop: 24, alignSelf: "stretch" },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1B4332",
    marginBottom: 16,
  },
  memberItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFF",
    padding: 12,
    borderRadius: 16,
    marginBottom: 10,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#D8F3DC",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { fontWeight: "700", color: "#2D6A4F" },
  memberName: { fontSize: 16, fontWeight: "600", color: "#1B4332" },
  memberEmail: { fontSize: 12, color: "#6C757D" },
  requestItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFF",
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: "#2D6A4F",
  },
  actionButtons: { flexDirection: "row", gap: 8 },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  acceptBtn: { backgroundColor: "#2D6A4F" },
  rejectBtn: { backgroundColor: "#D90429" },
  noGroupContainer: {
    alignItems: "center",
    paddingVertical: 40,
    width: "100%",
  },
  noGroupTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1B4332",
    marginTop: 20,
  },
  noGroupDesc: {
    textAlign: "center",
    color: "#6C757D",
    marginTop: 10,
    marginBottom: 30,
  },
  primaryBtn: {
    backgroundColor: "#2D6A4F",
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 15,
  },
  primaryBtnText: { color: "#FFF", fontWeight: "700", fontSize: 16 },
  farmItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFF",
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
  },
  farmOwner: { fontSize: 12, color: "#74C69D" },
  farmMain: { flex: 1, marginRight: 12 },
  memberMain: { flex: 1 },
  requestMain: { flex: 1 },
  joinBtn: {
    backgroundColor: "#D8F3DC",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    alignItems: "center",
  },
  joinBtnDisabled: {
    backgroundColor: "#F0F0F0",
  },
  joinBtnText: { color: "#2D6A4F", fontWeight: "700" },
  joinBtnTextDisabled: {
    color: "#A0A0A0",
  },
  kickBtn: {
    padding: 8,
  },
  input: {
    backgroundColor: "#F8FBF9",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 12,
    padding: 15,
    marginBottom: 16,
  },
  emptyText: { color: "#6C757D", textAlign: "center", marginTop: 20 },
  farmName: { fontSize: 18, fontWeight: "700", color: "#1B4332" },
  farmSelectorSection: { marginBottom: 20 },
  sectionSubtitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6C757D",
    marginBottom: 12,
  },
  farmBadgeScroll: { flexDirection: "row" },
  farmBadge: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#FFF",
    marginRight: 10,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    flexDirection: "row",
    alignItems: "center",
  },
  farmBadgeActive: {
    backgroundColor: "#2D6A4F",
    borderColor: "#2D6A4F",
  },
  farmBadgeDefault: {
    borderColor: "#F59E0B",
    borderWidth: 1,
  },
  farmBadgeText: { color: "#495057", fontWeight: "600" },
  farmBadgeTextActive: { color: "#FFF" },
  addFarmBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#D8F3DC",
    justifyContent: "center",
    alignItems: "center",
  },
  groupFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    paddingTop: 16,
  },
  setDefaultSmallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFFBEB",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FEF3C7",
  },
  setDefaultText: { color: "#D97706", fontSize: 12, fontWeight: "700" },
  defaultIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  defaultIndicatorText: { color: "#F59E0B", fontSize: 12, fontWeight: "700" },
  joinedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#E9F5EE",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  discoverCard: {
    marginTop: 24,
    backgroundColor: "#FFF",
    borderRadius: 24,
    padding: 20,
    elevation: 4,
    shadowColor: "#2D6A4F",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: "#D8F3DC",
  },
  discoverContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  discoverIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: "#D8F3DC",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  discoverTextContainer: {
    flex: 1,
  },
  discoverTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1B4332",
    marginBottom: 4,
  },
  discoverDesc: {
    fontSize: 13,
    color: "#6C757D",
    lineHeight: 18,
  },
  joinedBadgeText: { color: "#2D6A4F", fontSize: 12, fontWeight: "700" },
});
