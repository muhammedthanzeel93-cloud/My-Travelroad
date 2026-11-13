/**
 * My Travelroad — Community Domain Models (FUTURE PHASE)
 *
 * CONCEPTUAL SPECIFICATION ONLY.
 * Do not implement community functionality in Stage A.
 *
 * Core Architecture Rule:
 * Community-submitted content (posts, comments, reviews) is UNTRUSTED user-generated content (UGC).
 * It MUST NEVER be treated as official or verified factual information without passing through
 * curator moderation and the formal DestinationVerification workflow.
 */

import type {
  AccountId,
  CommentId,
  CommunityPostId,
  DestinationId,
  FollowId,
  IsoDateTimeString,
  LikeId,
  MediaId,
  ReportId,
  ReviewId,
} from "./common.types";

/** Publication status of a community-submitted post. */
export type CommunityPostStatus =
  | "draft"
  | "published"
  | "flagged"
  | "hidden_by_moderator"
  | "archived";

/** Media item attached to a community trip update or post. */
export interface PostMedia {
  id: MediaId;
  postId: CommunityPostId;
  type: "image" | "video";
  url: string;
  thumbnailUrl?: string | null;
  caption?: string | null;
  displayOrder: number;
  moderationStatus: "approved" | "pending_scan" | "flagged";
}

/**
 * Community Post (Future Phase).
 * Traveler experience updates, trail reports, and trip photography.
 */
export interface CommunityPost {
  id: CommunityPostId;
  authorAccountId: AccountId;
  /** Optional destination tagged in the post. */
  taggedDestinationId?: DestinationId | null;
  title: string;
  body: string;
  media: PostMedia[];
  likeCount: number;
  commentCount: number;
  status: CommunityPostStatus;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
}

/**
 * Community Comment (Future Phase).
 * Supports threaded replies on community posts.
 */
export interface Comment {
  id: CommentId;
  postId: CommunityPostId;
  authorAccountId: AccountId;
  /** Parent comment ID if this is a reply to another comment (null for top-level). */
  parentCommentId?: CommentId | null;
  content: string;
  status: "published" | "flagged" | "removed";
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
}

/**
 * Social Like (Future Phase).
 * Composite uniqueness: `(accountId, targetType, targetId)`.
 */
export interface Like {
  id: LikeId;
  accountId: AccountId;
  targetType: "post" | "comment" | "review";
  targetId: string;
  createdAt: IsoDateTimeString;
}

/**
 * Traveler Follow Graph (Future Phase).
 * Composite uniqueness: `(followerAccountId, followingAccountId)`.
 */
export interface Follow {
  id: FollowId;
  followerAccountId: AccountId;
  followingAccountId: AccountId;
  createdAt: IsoDateTimeString;
}

/**
 * Visitor Destination Review (Future Phase).
 * User review and star rating. Decoupled from verified factual descriptions.
 */
export interface DestinationReview {
  id: ReviewId;
  destinationId: DestinationId;
  authorAccountId: AccountId;
  /** Rating score between 1 and 5. */
  rating: 1 | 2 | 3 | 4 | 5;
  title?: string | null;
  comment: string;
  visitDate?: string | null; // YYYY-MM approximation
  helpfulCount: number;
  status: "pending_moderation" | "published" | "flagged" | "rejected";
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
}

/**
 * Community User Flag / Report (Future Phase).
 * Flags inaccurate information, safety violations, inappropriate imagery, or spam.
 */
export interface UserReport {
  id: ReportId;
  reporterAccountId: AccountId;
  targetType: "destination" | "review" | "community_post" | "comment" | "user_profile";
  targetId: string;
  reasonCategory:
    | "inaccurate_information"
    | "safety_hazard"
    | "offensive_content"
    | "copyright_infringement"
    | "spam_or_solicitation"
    | "duplicate_listing";
  statement: string;
  severity: "low" | "medium" | "high";
  status: "pending" | "in_review" | "resolved" | "dismissed";
  assignedModeratorId?: AccountId | null;
  createdAt: IsoDateTimeString;
  resolvedAt?: IsoDateTimeString | null;
}
