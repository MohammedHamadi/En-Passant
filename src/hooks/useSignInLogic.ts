import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function useSignInLogic() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedPath = searchParams.get("redirect") || "/admin";
  const redirectPath = requestedPath.startsWith("/") && !requestedPath.startsWith("//") ? requestedPath : "/admin";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setMessage(payload.error || "Login failed.");
        return;
      }

      router.replace(redirectPath);
    } catch {
      setMessage("Unexpected error during login.");
    } finally {
      setLoading(false);
    }
  };

  return {
    email,
    setEmail,
    password,
    setPassword,
    loading,
    message,
    showPassword,
    setShowPassword,
    handleSignIn,
  };
}
