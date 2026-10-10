"use client";
import { useCallback, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";

export function useToast() {
  const [msg, setMsg] = useState("");
  const timer = useRef<number>();
  const notify = useCallback((m: string) => {
    setMsg(m);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(""), 3200);
  }, []);
  const toast = msg ? <div className="toast" role="status"><CheckCircle2 size={18}/>{msg}</div> : null;
  return { notify, toast };
}
