const UNIVERSITY_EMAIL_SUFFIX = "@msu.ac.th";

export function isAllowedUniversityEmail(
  email: string | null | undefined,
): boolean {
  const normalizedEmail = email?.trim().toLowerCase();

  return (
    normalizedEmail !== undefined &&
    normalizedEmail.length > UNIVERSITY_EMAIL_SUFFIX.length &&
    normalizedEmail.endsWith(UNIVERSITY_EMAIL_SUFFIX)
  );
}
