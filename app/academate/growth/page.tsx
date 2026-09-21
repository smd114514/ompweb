import { redirect } from "next/navigation";

/** Keep existing bookmarks working after growth records became independent memories. */
export default function AcadMateGrowthPage() {
  redirect("/academate/memory");
}
