import { useQuery } from "@tanstack/react-query";
import DownloadBinary from "./pages/DownloadBinary";
import Main from "./pages/Main";

/**
 * App entry
 *
 * Checks if there is a Celestia binary, and if not, downloads it.
 */
export default function App() {
  const exists = useQuery({
    queryKey: ["exists"],
    queryFn: async () => {
      return window.celestia.exists();
    },
  });

  return exists.isLoading ? null : exists.data ? <Main /> : <DownloadBinary />;
}
