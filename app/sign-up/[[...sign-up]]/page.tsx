"use client";
import { SignUp, useAuth } from "@clerk/nextjs";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, Suspense } from "react";

function SignUpContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();

  const sessionId = searchParams.get("session_id");
  const plan = searchParams.get("plan");

  // If already signed in and has a Stripe session, go to dashboard to link it
  useEffect(() => {
    if (isLoaded && isSignedIn && sessionId) {
      router.push(`/dashboard?session_id=${sessionId}`);
    }
  }, [isLoaded, isSignedIn, sessionId, router]);

  // Build redirect URL that preserves the Stripe session_id
  const redirectUrl = sessionId
    ? `/dashboard?session_id=${sessionId}`
    : "/dashboard";

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] p-6">
      <div className="w-full max-w-md">
        {plan && !isSignedIn && (
          <div className="text-center mb-6">
            <div className="text-sm text-emerald-400 font-semibold mb-1">Payment successful!</div>
            <div className="text-xs text-white/40">Create your account to get started.</div>
          </div>
        )}
        <SignUp forceRedirectUrl={redirectUrl} />
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <SignUpContent />
    </Suspense>
  );
}
