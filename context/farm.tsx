import { supabase } from "@/lib/supabase";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useAuth } from "./auth";

interface Farm {
  farm_group_id: string;
  farm_group_name: string;
  farm_group_description: string;
  farm_owner_id: string;
}

interface FarmContextType {
  activeFarm: Farm | null;
  isOwner: boolean;
  myFarms: Farm[];
  loading: boolean;
  refreshFarms: () => Promise<void>;
}

const FarmContext = createContext<FarmContextType>({
  activeFarm: null,
  isOwner: false,
  myFarms: [],
  loading: true,
  refreshFarms: async () => {},
});

export const FarmProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [activeFarm, setActiveFarm] = useState<Farm | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [myFarms, setMyFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user) {
      setActiveFarm(null);
      setIsOwner(false);
      setMyFarms([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // 1. Get Profile with current_farm_group_id
      const { data: profileData } = await supabase
        .from("farmer_account_table")
        .select("current_farm_group_id")
        .eq("farmer_account_id", user.id)
        .single();

      // 2. Fetch all user memberships that are ACCEPTED
      const { data: memberships } = await supabase
        .from("farm_membership_table")
        .select("*, farm_group_table(*)")
        .eq("farmer_account_id", user.id)
        .eq("farm_membership_status", "ACCEPTED");

      const acceptedFarms = memberships?.map((m) => m.farm_group_table) || [];
      setMyFarms(acceptedFarms);

      // 3. Set active farm based on profile's current_farm_group_id
      const currentId = profileData?.current_farm_group_id;
      const active =
        acceptedFarms.find((f) => f.farm_group_id === currentId) || null;

      setActiveFarm(active);
      setIsOwner(active?.farm_owner_id === user.id);
    } catch (error) {
      console.error("Error in FarmProvider:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refreshFarms = async () => {
    await fetchData();
  };

  return (
    <FarmContext.Provider
      value={{ activeFarm, isOwner, myFarms, loading, refreshFarms }}
    >
      {children}
    </FarmContext.Provider>
  );
};

export const useFarm = () => {
  const context = useContext(FarmContext);
  if (context === undefined) {
    throw new Error("useFarm must be used within a FarmProvider");
  }
  return context;
};
