import { useEffect, useState } from "react";
import { supabaseConfigured } from "../lib/supabase";
import { subscribeToCompetition } from "../lib/api";
export function DataGate() {
  const [online, setOnline] = useState(false);
  useEffect(() => {
    setOnline(supabaseConfigured);
    const unsub = subscribeToCompetition(() => setOnline(true));
    return unsub;
  }, []);
  return (
    <div className="data-chip">
      <span className={online ? "dot live-dot" : "dot"} />
      {online ? "DATABASE CONNECTED" : "DATABASE READY"}
    </div>
  );
}
