"use client";

import Image from "next/image";

interface ConnectedAppsCardProps {
  clientName: string;
  image: string;
  domain: string;
  scopes: string[];
  createdAt?: string | null;
}

export function ConnectedAppsCard({
  clientName,
  image,
  domain,
  scopes,
  createdAt,
}: ConnectedAppsCardProps) {
  // Format the date
  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return "Unknown";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "Unknown";
    }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full h-full p-6 relative">
      {/* App Icon/Image - Top center */}
      <div className="relative w-32 h-32 mb-8 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
        <Image
          src={image}
          alt={clientName}
          width={128}
          height={128}
          className="w-full h-full object-cover"
          onError={(e) => {
            // Fallback for broken images
            const img = e.target as HTMLImageElement;
            img.src = "https://via.placeholder.com/200?text=OAuth+App";
          }}
        />
      </div>

      {/* Bottom left section */}
      <div className="absolute bottom-0 left-0 right-0 p-6 flex flex-col">
        {/* App Name - Bottom left */}
        <h3 className="text-lg font-semibold text-left mb-2 dark:text-white text-gray-900">
          {clientName}
        </h3>

        {/* Domain */}
        <p className="text-sm text-gray-600 dark:text-gray-400 text-left mb-3">
          <span className="font-medium">Domain:</span> {domain}
        </p>

        {/* Connected from date */}
        <p className="text-sm text-gray-600 dark:text-gray-400 text-left mb-4">
          <span className="font-medium">Connected from:</span> {formatDate(createdAt)}
        </p>

        {/* Scopes */}
        <div className="flex flex-wrap gap-2">
          {scopes.length > 0 ? (
            scopes.map((scope) => (
              <span
                key={scope}
                className="inline-block px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full"
              >
                {scope}
              </span>
            ))
          ) : (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              No scopes specified
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
