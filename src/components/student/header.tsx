"use client";

import React, { useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { LogOut, Utensils, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface StudentHeaderProps {
  user?: {
    id?: string;
    name?: string | null;
    username?: string | null;
    role?: string | null;
    studentCode?: string | null;
  };
}

export function StudentHeader({ user }: StudentHeaderProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleSignOut = async () => {
    setIsLoggingOut(true);
    try {
      await signOut({ callbackUrl: "/student-login" });
    } catch (error) {
      console.error("Sign out error:", error);
      setIsLoggingOut(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-xs">
      <div className="container mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Left: Brand */}
        <Link
          href="/student"
          className="flex items-center gap-2.5 font-bold tracking-tight text-foreground transition-opacity hover:opacity-90"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm shrink-0">
            <Utensils className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm sm:text-lg font-bold leading-tight tracking-tight">
              Trường THPT Ten Lơ Man
            </span>
            <span className="text-[10px] sm:text-[11px] font-medium text-muted-foreground">
              Cổng Học Sinh & Phụ Huynh
            </span>
          </div>
        </Link>

        {/* Right: Sign Out Button */}
        <div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            disabled={isLoggingOut}
            className="flex items-center gap-1.5 border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors text-xs font-medium cursor-pointer h-9 px-3"
          >
            {isLoggingOut ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">Đăng xuất</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
