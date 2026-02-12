import { ModernHeader } from "@/components/ui/modern-header";
import { useAuth } from "@/context/auth";
import { useFarm } from "@/context/farm";
import { supabase } from "@/lib/supabase";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function SalesManagementScreen() {
  const { user } = useAuth();
  const { activeFarm, isOwner, loading: farmLoading } = useFarm();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sales, setSales] = useState<any[]>([]);
  const [summary, setSummary] = useState({ totalRevenue: 0, totalItems: 0 });

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      if (activeFarm && isOwner) {
        const { data: salesData, error } = await supabase.rpc(
          "get_sales_history",
          {
            p_farm_group_id: activeFarm.farm_group_id,
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
        setSummary({ totalRevenue: 0, totalItems: 0 });
      }
    } catch (error) {
      console.error("Error fetching sales history:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, activeFarm, isOwner]);

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
          {new Date(item.sold_at).toLocaleDateString()} at{" "}
          {new Date(item.sold_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>
      <View style={styles.saleAmount}>
        <Text style={styles.saleAmountText}>
          ₱{item.total_amount.toLocaleString()}
        </Text>
      </View>
    </View>
  );

  if ((loading || farmLoading) && !refreshing) {
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
        title="Sales History"
        subtitle={activeFarm?.farm_group_name || "View history"}
        onBack={() => router.back()}
      />
      <View style={[styles.container, { backgroundColor: "#F8FBF9" }]}>
        <View style={styles.content}>
          {activeFarm && isOwner && (
            <View style={styles.summaryGrid}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Total Revenue</Text>
                <Text style={styles.summaryValue}>
                  ₱{summary.totalRevenue.toLocaleString()}
                </Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Total Sold</Text>
                <Text style={styles.summaryValue}>{summary.totalItems}</Text>
              </View>
            </View>
          )}

          <FlatList
            data={sales}
            renderItem={renderSaleItem}
            keyExtractor={(item) => item.sale_id || Math.random().toString()}
            contentContainerStyle={[
              styles.list,
              { paddingBottom: insets.bottom + 40 },
            ]}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={["#2D6A4F"]}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <MaterialIcons
                  name={!activeFarm ? "house" : "receipt-long"}
                  size={80}
                  color={!activeFarm ? "#E0E0E0" : "#D8F3DC"}
                />
                <Text style={styles.emptyTitle}>
                  {!activeFarm ? "No Farm Selected" : "No Sales Records"}
                </Text>
                <Text style={styles.emptyDesc}>
                  {!activeFarm
                    ? "Please select a farm in Farm Management to view sales."
                    : "No sales records found for this farm yet."}
                </Text>
              </View>
            }
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 16,
    backgroundColor: "#F8FBF9",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FBF9",
  },
  content: {
    flex: 1,
  },
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
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  summaryGrid: {
    flexDirection: "row",
    paddingHorizontal: 24,
    gap: 16,
    marginBottom: 24,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: "#2D6A4F",
    borderRadius: 20,
    padding: 16,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: "#D8F3DC",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
    marginTop: 4,
  },
  list: {
    padding: 24,
    paddingTop: 0,
  },
  saleCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  saleIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#E8F5E9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  saleInfo: {
    flex: 1,
  },
  saleTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1B4332",
  },
  saleSubtitle: {
    fontSize: 12,
    color: "#999",
    marginTop: 2,
  },
  saleAmount: {
    alignItems: "flex-end",
  },
  saleAmountText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#2D6A4F",
  },
  emptyContainer: {
    alignItems: "center",
    padding: 40,
    marginTop: 60,
  },
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
    marginTop: 8,
    lineHeight: 20,
  },
});
