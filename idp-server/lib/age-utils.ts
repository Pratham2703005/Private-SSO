/**
 * Calculates the age from a birthdate string (YYYY-MM-DD or ISO format)
 * @param birthdate - Date string in format YYYY-MM-DD or ISO format
 * @returns Age in years, or null if invalid date
 */
export function calculateAge(birthdate: string | null): number | null {
  if (!birthdate) return null;

  try {
    const birthDate = new Date(birthdate);
    if (isNaN(birthDate.getTime())) return null;

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDifference = today.getMonth() - birthDate.getMonth();

    // If birthday hasn't occurred this year, subtract 1 from age
    if (
      monthDifference < 0 ||
      (monthDifference === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    return age >= 0 ? age : null;
  } catch {
    return null;
  }
}

/**
 * Formats a birthdate and includes age information
 * @param birthdate - Date string in format YYYY-MM-DD or ISO format
 * @param includeAge - Whether to include age in parentheses
 * @returns Formatted string like "March 27, 2005 (20 years old)"
 */
export function formatBirthdateWithAge(
  birthdate: string | null,
  includeAge: boolean = true
): string {
  if (!birthdate) return "Not set";

  try {
    const date = new Date(birthdate);
    if (isNaN(date.getTime())) return birthdate;

    const formatted = new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(date);

    if (!includeAge) return formatted;

    const age = calculateAge(birthdate);
    if (age === null) return formatted;

    const ageText = age === 1 ? "1 year old" : `${age} years old`;
    return `${formatted} (${ageText})`;
  } catch {
    return birthdate;
  }
}
