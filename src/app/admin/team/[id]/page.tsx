import type { Metadata } from "next";
import EmployeeDetail from "@/components/admin/EmployeeDetail";

export const metadata: Metadata = { title: "AI Employee" };

export default async function AdminEmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EmployeeDetail id={id} />;
}
