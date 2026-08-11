import type { Metadata } from "next";
import ProspectDetail from "@/components/admin/ProspectDetail";

export const metadata: Metadata = { title: "Prospect" };

export default async function AdminProspectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProspectDetail id={id} />;
}
