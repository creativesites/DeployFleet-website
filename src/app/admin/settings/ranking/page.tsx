import type { Metadata } from "next";
import PageHeader from "@/components/admin/PageHeader";
import RankingWeightsTab from "@/components/admin/RankingWeightsTab";

export const metadata: Metadata = { title: "Prospect Ranking" };

export default function AdminRankingPage() {
  return (
    <>
      <PageHeader
        title="Prospect Ranking"
        description="Tune how the Daily Prospect Engine orders Today's queue — the weight each signal carries in the score."
      />
      <RankingWeightsTab />
    </>
  );
}
