"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";

interface ConnectedApp {
  id: string;
  client_id: string;
  client_name: string;
  image: string;
  domain: string;
  scopes: string[];
  is_active: boolean;
  created_at: string | null;
}

interface InfiniteMenuItem {
  image: string;
  title: string;
  description: string;
  link?: string;
  provider?: string;
  domain?: string;
  email?: string;
  userId?: string;
  connected?: boolean;
  createdAt?: string | null;
}

// Generate SVG placeholder with app initial
function generateSvgPlaceholder(appName: string): string {
  const initial = appName.charAt(0).toUpperCase();
  const colors = [
    "#3B82F6", // blue
    "#10B981", // green
    "#F59E0B", // amber
    "#EF4444", // red
    "#8B5CF6", // purple
    "#06B6D4", // cyan
  ];
  const hashCode = appName
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const color = colors[hashCode % colors.length];

  const svg = `<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
    <rect width="200" height="200" fill="${color}"/>
    <text x="100" y="100" font-size="80" font-weight="bold" fill="white" text-anchor="middle" dy="0.3em">${initial}</text>
  </svg>`;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

// Dynamically import InfiniteMenu to avoid SSR issues
const InfiniteMenu = dynamic(
  () => import("@/components/InfiniteMenu"),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center w-full h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading apps...</p>
        </div>
      </div>
    ),
  }
) as React.ComponentType<{
  items: InfiniteMenuItem[];
  activeItem: InfiniteMenuItem | null;
  isMoving: boolean;
  scale: number;
  onItemChange: (index: number) => void;
  onMovementChange: (isMoving: boolean) => void;
  onItemClick: (item: InfiniteMenuItem) => void;
  onConnectClick: (item: InfiniteMenuItem) => void;
}>;

export function ConnectedAppsList() {
  const [apps, setApps] = useState<ConnectedApp[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<InfiniteMenuItem | null>(null);
  const [isMoving, setIsMoving] = useState(false);

  useEffect(() => {
    async function fetchConnectedApps() {
      try {
        setIsLoading(true);
        const response = await fetch("/api/auth/connected-apps");

        if (!response.ok) {
          throw new Error(`Failed to fetch connected apps: ${response.statusText}`);
        }

        const data = await response.json();
        if (data.success && data.apps) {
          setApps(data.apps);
        }
      } catch (err) {
        console.error("[ConnectedAppsList] Error fetching apps:", err);
        setError(err instanceof Error ? err.message : "Failed to load connected apps");
      } finally {
        setIsLoading(false);
      }
    }

    fetchConnectedApps();
  }, []);

  // Transform apps into InfiniteMenu format with actual images
  // Only include non-confidential data (exclude client_secret, etc.)
  const menuItems: InfiniteMenuItem[] = useMemo(
    () =>
      apps.map((app) => ({
        image: app.image || generateSvgPlaceholder(app.client_name),
        title: app.client_name,
        description: app.domain || "OAuth Application",
        provider: app.client_name,
        domain: app.domain,
        connected: app.is_active,
        createdAt: app.created_at,
        link: app.domain ? `https://${app.domain}` : undefined,
      })),
    [apps]
  );
  const handleItemChange = useCallback((index: number) => {
    if (menuItems[index]) {
      setActiveItem(menuItems[index]);
    }
  }, [menuItems]);

  const handleMovementChange = useCallback((isMoving: boolean) => {
    setIsMoving(isMoving);
  }, []);

  const handleItemClick = useCallback((item: InfiniteMenuItem) => {
    if (item.link) {
      if (item.link.startsWith("http")) {
        window.open(item.link, "_blank");
      } else {
        console.log("Route:", item.link);
      }
    }
  }, []);

  const handleConnectClick = useCallback((item: InfiniteMenuItem) => {
    const app = apps.find((a) => a.client_name === item.title);
    if (app) {
      console.log("Connect clicked for app:", app.client_id);
      // Add your connect logic here (redirect to OAuth flow, etc.)
    }
  }, [apps]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center w-full h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading OAuth apps...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
        <h3 className="text-red-800 dark:text-red-200 font-semibold mb-2">
          Error Loading Apps
        </h3>
        <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
      </div>
    );
  }

  if (apps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-96 text-center px-6">
        <div className="text-6xl mb-4">🔐</div>
        <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
          No Connected Applications
        </h3>
        <p className="text-gray-600 dark:text-gray-400 max-w-md">
          You don&apos;t have any OAuth applications connected yet. When you authorize third-party applications to access your account, they will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
      <div className="w-full h-full">
        <InfiniteMenu
          items={menuItems}
          activeItem={activeItem}
          isMoving={isMoving}
          scale={1.0}
          onItemChange={handleItemChange}
          onMovementChange={handleMovementChange}
          onItemClick={handleItemClick}
          onConnectClick={handleConnectClick}
        />
      </div>
    </div>
  );
}
