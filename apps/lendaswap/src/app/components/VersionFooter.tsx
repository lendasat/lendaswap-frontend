import { useEffect, useState } from "react";
import { api, type Version } from "../api";

interface VersionInfo {
  frontend: {
    tag: string;
    commitHash: string;
  };
  backend: Version | null;
}

export function VersionFooter() {
  const [versionInfo, setVersionInfo] = useState<VersionInfo>({
    frontend: {
      tag: import.meta.env.VITE_APP_GIT_TAG || "unknown",
      commitHash: import.meta.env.VITE_APP_GIT_COMMIT_HASH || "unknown",
    },
    backend: null,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchBackendVersion() {
      try {
        const backendVersion = await api.getVersion();
        setVersionInfo((prev) => ({
          ...prev,
          backend: backendVersion,
        }));
      } catch (error) {
        console.error("Failed to fetch backend version:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchBackendVersion();
  }, []);

  const formatCommitHash = (hash: string) => {
    if (hash === "unknown" || !hash) return "unknown";
    return hash.substring(0, 7);
  };

  return (
    <div className="flex flex-col gap-2 text-xs text-muted-foreground">
      <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center">
        <span>
          Frontend: {versionInfo.frontend.tag} (
          {formatCommitHash(versionInfo.frontend.commitHash)})
        </span>
        {isLoading ? (
          <span>Backend: Loading...</span>
        ) : versionInfo.backend ? (
          <span>
            Backend: {versionInfo.backend.tag} (
            {formatCommitHash(versionInfo.backend.commit_hash)})
          </span>
        ) : (
          <span>Backend: unavailable</span>
        )}
      </div>
    </div>
  );
}
