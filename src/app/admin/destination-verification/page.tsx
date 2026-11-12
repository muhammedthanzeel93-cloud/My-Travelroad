import type { Metadata } from "next";
import { DestinationVerificationClient } from "./destination-verification-client";

export const metadata: Metadata = {
  title: "Destination Verification",
  description:
    "Review queue UI structure displaying pending submissions, verified destinations, reviewer assignments, and non-persistent action placeholders.",
};

export default function AdminDestinationVerificationPage() {
  return <DestinationVerificationClient />;
}
