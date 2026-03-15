/**
 * Normalize a domain/URL string to a valid URL
 * - Removes malformed protocols (e.g., "http:localhost" -> "localhost")
 * - Adds http:// if no protocol is present
 * 
 * @param domain - The domain or URL string to normalize
 * @returns A valid URL string
 */
export function normalizeUrl(domain: string): string {
  let url = domain.trim();
  
  // Normalize malformed protocols (e.g., "http:localhost" -> "localhost")
  url = url.replace(/^https?:(?!\/\/)/, "");
  
  // Add protocol if missing
  if (!url.includes("://")) {
    url = `http://${url}`;
  }
  
  return url;
}

/**
 * Safely open a URL in a new window
 * @param domain - The domain or URL string
 */
export function openDomainLink(domain: string): void {
  try {
    const url = normalizeUrl(domain);
    window.open(url, "_blank");
  } catch (error) {
    console.error("[openDomainLink] Error:", error);
  }
}
