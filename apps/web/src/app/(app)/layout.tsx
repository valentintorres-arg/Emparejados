import { Navegacion } from "@/components/navegacion";

export default function LayoutDeLaApp({ children }: { children: React.ReactNode }) {
  return <Navegacion>{children}</Navegacion>;
}
