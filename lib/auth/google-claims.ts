export type GoogleIdentity = {
  email: string;
  name: string;
  hd: "msu.ac.th";
  emailPrefix: string;
};

function claimRecord(input: unknown) {
  if (!input || typeof input !== "object") {
    throw new Error("AUTH_CLAIMS_INVALID");
  }
  return input as Record<string, unknown>;
}

export function validateGoogleClaims(input: unknown): GoogleIdentity {
  const claims = claimRecord(input);

  if (claims.email_verified !== true) {
    throw new Error("AUTH_EMAIL_NOT_VERIFIED");
  }

  if (typeof claims.email !== "string") {
    throw new Error("AUTH_EMAIL_INVALID");
  }

  const email = claims.email.trim().toLowerCase();
  const match = /^([^@\s]+)@msu\.ac\.th$/.exec(email);
  if (!match) {
    throw new Error("AUTH_EMAIL_INVALID");
  }

  if (claims.hd !== "msu.ac.th") {
    throw new Error("AUTH_DOMAIN_NOT_ALLOWED");
  }

  const name =
    typeof claims.name === "string" && claims.name.trim()
      ? claims.name.trim()
      : [claims.given_name, claims.family_name]
          .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
          .join(" ") || match[1];

  return {
    email,
    name,
    hd: "msu.ac.th",
    emailPrefix: match[1].toLowerCase(),
  };
}
