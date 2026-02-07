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
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SalesManagementScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sales, setSales] = useState<any[]>([]);
  const [summary, setSummary] = useState({ totalRevenue: 0, totalItems: 0 });

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      const { data: profileData } = await supabase
        .from("farmer_account_table")
        .select("current_farm_group_id")
        .eq("farmer_account_id", user.id)
        .single();

      if (profileData?.current_farm_group_id) {
        // Only fetch if they are the owner
        const { data: farmData } = await supabase
          .from("farm_group_table")
          .select("farm_owner_id")
          .eq("farm_group_id", profileData.current_farm_group_id)
          .single();

        if (farmData?.farm_owner_id === user.id) {
          const { data: salesData, error } = await supabase.rpc(
            "get_sales_history",
            {
              p_farm_group_id: profileData.current_farm_group_id,
            },
          );

          if (error) throw error;
          setSales(salesData || []);

          // Calculate summary
          const revenue = (salesData || []).reduce(
            (acc: number, curr: any) => acc + Number(curr.total_amount),
            0,
          );
          const items = (salesData || []).reduce(
            (acc: number, curr: any) => acc + curr.item_count,
            0,
          );
          setSummary({ totalRevenue: revenue, totalItems: items });
        } else {
          setSales([]);
        }
      } else {
        setSales([]);
      }
    } catch (error) {
      console.error("Error fetching sales history:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const renderSaleItem = ({ item }: { item: any }) => (
    <View style={styles.saleCard}>
      <View style={styles.saleIconContainer}>
        <MaterialIcons name="payments" size={24} color="#2D6A4F" />
      </View>
      <View style={styles.saleInfo}>
        <Text style={styles.saleTitle}>
          {item.item_count}{" "}
          {item.item_count === 1 ? "Watermelon" : "Watermelons"}
        </Text>
        <Text style={styles.saleSubtitle}>
          {item.first_item_label}{" "}
          {item.item_count > 1 ? `+ ${item.item_count - 1} more` : ""}
        </Text>
        <Text style={styles.saleMeta}>
          Sold by {item.sold_by_name} •{" "}
          {new Date(item.sold_at).toLocaleDateString()}
        </Text>
      </View>
      <View style={styles.saleAmountContainer}>
        <Text style={styles.currencySymbol}>₱</Text>
        <Text style={styles.saleAmount}>
          {Number(item.total_amount).toLocaleString()}
        </Text>
      </View>
    </View>
  );

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
          <Text style={styles.title}>Sales Management</Text>
        </View>

        <View style={styles.summaryContainer}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Revenue</Text>
            <Text style={styles.summaryValue}>
              ₱{summary.totalRevenue.toLocaleString()}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Items Sold</Text>
            <Text style={styles.summaryValue}>{summary.totalItems}</Text>
          </View>
        </View>

        <FlatList
          data={sales}
          renderItem={renderSaleItem}
          keyExtractor={(item) => item.sale_id}
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
              <MaterialIcons name="shopping-cart" size={80} color="#D8F3DC" />
              <Text style={styles.emptyTitle}>No Sales Yet</Text>
              <Text style={styles.emptyDesc}>
                Start selling your harvest to see your revenue tracking here.
              </Text>
            </View>
          }
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
  summaryContainer: {
    flexDirection: "row",
    paddingHorizontal: 24,
    gap: 16,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: "#FFF",
    padding: 20,
    borderRadius: 24,
    elevation: 2,
    shadowColor: "#2D6A4F",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: "#D8F3DC",
  },
  summaryLabel: {
    fontSize: 12,
    color: "#6C757D",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#2D6A4F",
    marginTop: 4,
  },
  listContent: { padding: 24 },
  saleCard: {
    backgroundColor: "#FFF",
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  saleIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F1F8F5",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  saleInfo: { flex: 1 },
  saleTitle: { fontSize: 16, fontWeight: "700", color: "#1B4332" },
  saleSubtitle: { fontSize: 13, color: "#6C757D", marginTop: 2 },
  saleMeta: { fontSize: 11, color: "#A0A0A0", marginTop: 4 },
  saleAmountContainer: { alignItems: "flex-end" },
  currencySymbol: { fontSize: 12, fontWeight: "700", color: "#2D6A4F" },
  saleAmount: { fontSize: 18, fontWeight: "800", color: "#2D6A4F" },
  emptyContainer: {
    alignItems: "center",
    marginTop: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1B4332",
    marginTop: 20,
  },
  emptyDesc: {
    fontSize: 14,
    color: "#6C757D",
    textAlign: "center",
    marginTop: 8,
  },
});
