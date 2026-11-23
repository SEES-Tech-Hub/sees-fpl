import { redirect } from "next/navigation";

// Naming the team is now step 1 of the squad builder (one save for both).
// Kept so old links and bookmarks still work.
export default function JoinPage() {
  redirect("/fantasy/squad");
}
