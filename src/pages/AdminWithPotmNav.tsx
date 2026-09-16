import { useEffect } from "react";
import Admin from "./Admin";

function injectPotmNavigation() {
  const nav = document.querySelector<HTMLElement>(".admin-sidebar nav");
  if (!nav || nav.querySelector("[data-admin-potm]") || window.location.pathname === "/admin/potm") return;

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "POTM";
  button.dataset.adminPotm = "true";
  button.addEventListener("click", () => {
    window.location.assign("/admin/potm");
  });

  const mvp = Array.from(nav.querySelectorAll("button")).find((item) => item.textContent?.trim() === "MVP");
  if (mvp?.nextSibling) nav.insertBefore(button, mvp.nextSibling);
  else nav.appendChild(button);
}

export default function AdminWithPotmNav() {
  useEffect(() => {
    let observer: MutationObserver | null = null;
    const timer = window.setTimeout(() => {
      injectPotmNavigation();
      observer = new MutationObserver(() => injectPotmNavigation());
      observer.observe(document.body, { childList: true, subtree: true });
    }, 0);

    return () => {
      window.clearTimeout(timer);
      observer?.disconnect();
      document.querySelector("[data-admin-potm]")?.remove();
    };
  }, []);

  return <Admin />;
}
