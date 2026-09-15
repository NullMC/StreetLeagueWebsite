import { useEffect, useRef } from "react";
import { sanitizeRichTextHtml } from "../lib/richText";

function exec(command: string, value?: string) {
  document.execCommand(command, false, value);
}

export function RichTextEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editorRef.current) return;
    const current = sanitizeRichTextHtml(editorRef.current.innerHTML);
    const next = sanitizeRichTextHtml(value || "");
    if (current !== next) editorRef.current.innerHTML = next;
  }, [value]);

  const handleInput = () => {
    if (!editorRef.current) return;
    onChange(sanitizeRichTextHtml(editorRef.current.innerHTML));
  };

  const run = (command: string, commandValue?: string) => {
    editorRef.current?.focus();
    exec(command, commandValue);
    handleInput();
  };

  return (
    <div className="rich-text-editor">
      <div className="rich-text-editor__toolbar" aria-label="Formattazione testo">
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => run("bold")} aria-label="Grassetto"><strong>B</strong></button>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => run("italic")} aria-label="Corsivo"><em>I</em></button>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => run("underline")} aria-label="Sottolineato"><u>U</u></button>
        <span className="rich-text-editor__divider" aria-hidden="true" />
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => run("insertUnorderedList")} aria-label="Elenco puntato">•</button>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => run("insertOrderedList")} aria-label="Elenco numerato">1.</button>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => run("removeFormat")} aria-label="Rimuovi formattazione">Tx</button>
      </div>
      <div
        ref={editorRef}
        className="rich-text-editor__content"
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-label="Descrizione"
        data-placeholder="Scrivi la descrizione…"
        onInput={handleInput}
        suppressContentEditableWarning
      />
    </div>
  );
}
