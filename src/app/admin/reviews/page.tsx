import type { Metadata } from "next";
import { ReviewsClient } from "./reviews-client";

export const metadata: Metadata = {
  title: "Review Management",
  description:
    "Browse visitor review statistics, destination ratings, review status filters, and moderation UI placeholders.",
};

export default function AdminReviewsPage() {
  return <ReviewsClient />;
}
