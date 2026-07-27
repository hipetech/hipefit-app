import type { FC } from 'react';

export interface StatsRowProps {
  totalWorkouts: number;
  currentStreak: number;
  longestStreak: number;
  /** Fixed width of each of the three cards (equal thirds of the content row). */
  cardWidth: number;
}

export interface FeaturedRoutineCardProps {
  name: string;
  description?: string | null;
  exercisesLabel: string;
  durationLabel?: string;
  /** Full content width so the card spans the screen. */
  width: number;
}

export interface WorkoutRowProps {
  title: string;
  durationLabel: string;
  exercisesLabel: string;
  dateLabel: string;
  statusLabel: string;
  statusPrimary: boolean;
  /** Full content width so the row spans the screen. */
  width: number;
}

export interface MessageCardProps {
  message: string;
  alignment?: 'leading' | 'center';
  /** Full content width so the card spans the screen. */
  width: number;
}

export interface HomeSkeletonProps {
  /** Full content width. */
  contentWidth: number;
  /** Width of each stat card (equal thirds). */
  statCardWidth: number;
}

/**
 * Home-screen native building blocks. Host-less subtrees — compose each inside a
 * screen `Host`. SwiftUI on iOS (`native.ios.tsx`), plain-RN fallbacks on
 * Android (`native.android.tsx`).
 */
export declare const StatsRow: FC<StatsRowProps>;
export declare const FeaturedRoutineCard: FC<FeaturedRoutineCardProps>;
export declare const WorkoutRow: FC<WorkoutRowProps>;
export declare const MessageCard: FC<MessageCardProps>;
export declare const HomeSkeleton: FC<HomeSkeletonProps>;
