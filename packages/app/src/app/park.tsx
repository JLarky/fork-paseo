import { useLocalSearchParams } from "expo-router";
import { ParkPage, type ParkPageParams } from "@/park-page";

export default function ParkRoute() {
  const params = useLocalSearchParams() as ParkPageParams;
  return <ParkPage params={params} />;
}
