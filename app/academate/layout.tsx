import type { ReactNode } from "react";
import { AcadMateWorkspace } from "@/components/AcadMateWorkspace";

/** Shared shell: Next.js keeps this client workspace mounted while its child
 * routes change, so sidebar/session state does not flash or reset. */
export default function AcadMateLayout({ children }: { children: ReactNode }) {
  return <AcadMateWorkspace>{children}</AcadMateWorkspace>;
}
