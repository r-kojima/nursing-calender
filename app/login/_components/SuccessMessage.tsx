"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export function SuccessMessage() {
  const searchParams = useSearchParams();
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const successMessage = searchParams.get("success");
    if (successMessage) {
      setSuccess(successMessage);
    }
  }, [searchParams]);

  if (!success) {
    return null;
  }

  return <div className="text-success text-sm text-center">{success}</div>;
}
