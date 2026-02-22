import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { useAuthStore } from "@/store/auth.store";

const BIRTHDAY_DISMISSED_KEY = "birthday_alert_dismissed";

function getDismissedDate(): string | null {
  return sessionStorage.getItem(BIRTHDAY_DISMISSED_KEY);
}

function setDismissedDate() {
  sessionStorage.setItem(BIRTHDAY_DISMISSED_KEY, new Date().toDateString());
}

export function useBirthdayAlert() {
  const { isAuthenticated } = useAuthStore();
  const [show, setShow] = useState(false);

  const birthdaysQuery = useQuery({
    queryKey: ["customer", "birthdays"],
    queryFn: () => trpc.customer.getBirthdays.query(),
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 30, // 30 min cache
  });

  const customers = birthdaysQuery.data ?? [];

  useEffect(() => {
    if (customers.length > 0) {
      const dismissed = getDismissedDate();
      const today = new Date().toDateString();
      if (dismissed !== today) {
        setShow(true);
      }
    }
  }, [customers]);

  function dismiss() {
    setDismissedDate();
    setShow(false);
  }

  return { show, customers, dismiss };
}
