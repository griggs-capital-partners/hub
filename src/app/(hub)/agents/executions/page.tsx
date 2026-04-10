import { redirect } from "next/navigation";

// Execution board is now embedded in the main agents page
export default function AgentExecutionsPage() {
  redirect("/agents");
}
