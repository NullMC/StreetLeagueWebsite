const allowedTags = new Set(["B", "STRONG", "I", "EM", "U", "S", "BR", "P", "UL", "OL", "LI", "A"]);

export function sanitizeRichTextHtml(html: string) {
  if (typeof document === "undefined") return html;

  const doc = new DOMParser().parseFromString(html || "", "text/html");
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);
  const elements: Element[] = [];
  let current = walker.nextNode();
  while (current) {
    elements.push(current as Element);
    current = walker.nextNode();
  }

  elements.forEach((element) => {
    if (!allowedTags.has(element.tagName)) {
      const parent = element.parentNode;
      if (!parent) return;
      while (element.firstChild) parent.insertBefore(element.firstChild, element);
      parent.removeChild(element);
      return;
    }

    Array.from(element.attributes).forEach((attribute) => {
      if (element.tagName !== "A" || !["href", "target", "rel"].includes(attribute.name)) {
        element.removeAttribute(attribute.name);
      }
    });

    if (element.tagName === "A") {
      const href = element.getAttribute("href") || "";
      if (!/^https?:\/\//i.test(href)) {
        element.removeAttribute("href");
      } else {
        element.setAttribute("target", "_blank");
        element.setAttribute("rel", "noopener noreferrer");
      }
    }
  });

  return doc.body.innerHTML;
}
