"use client";

import { useRef, useState } from "react";
import { content } from "@/content/site";
import { useNavigation } from "@/lib/reel-store";
import { OverlayShell } from "./OverlayShell";

/** Overlay de contato: formulário estilo "agendar call" (placeholder, não envia). */
export function ContactOverlay({ onClose }: { onClose: () => void }) {
  const site = content[useNavigation((s) => s.locale)];
  const { contact, ui } = site;
  const [sent, setSent] = useState(false);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [summary, setSummary] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const base = "w-full rounded-lg border bg-white/[0.04] px-3.5 py-2.5 text-[14px] text-white placeholder:text-white/30 outline-none transition-colors";
  const ok = "border-white/15 focus:border-white/45";
  const bad = "border-[#ff6b6b]/70 bg-[#ff6b6b]/[0.06] focus:border-[#ff6b6b]";
  const clear = (name: string) => setErrors((p) => (p[name] ? { ...p, [name]: false } : p));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const f = formRef.current;
    if (!f) return;
    const errs: Record<string, boolean> = {};
    for (const field of contact.form.fields) {
      if (!field.required) continue;
      const el = f.elements.namedItem(field.name) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
      if (!el || !el.value.trim()) errs[field.name] = true;
    }
    if (Object.keys(errs).length) { setErrors(errs); setSummary(true); return; }
    setErrors({}); setSummary(false); setSent(true);
  }

  return (
    <OverlayShell onClose={onClose} labelledBy="contact-title" className="bg-black/95">
      <div className="overlay-scroll flex h-full w-full items-start justify-center px-5 py-16 sm:py-20">
        <div className="mx-auto w-full max-w-xl">
          <p className="text-center text-[11px] uppercase tracking-[0.3em] text-white/40">{ui.contactEyebrow}</p>
          <h2 id="contact-title" className="mt-3 text-center text-3xl font-light tracking-tight text-white sm:text-4xl">
            {contact.headline}
          </h2>
          {contact.sub && (
            <p className="mx-auto mt-3 max-w-md text-center text-[14px] leading-relaxed text-white/55">{contact.sub}</p>
          )}

          {sent ? (
            <div className="mt-8 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-8 text-center text-[15px] text-emerald-300">
              {contact.form.successMessage}
            </div>
          ) : (
            <form ref={formRef} onSubmit={submit} noValidate className="mt-8 grid grid-cols-1 gap-x-3 gap-y-4 sm:grid-cols-2 text-left">
              {contact.form.fields.map((field) => {
                const err = errors[field.name];
                const cls = `${base} ${err ? bad : ok}`;
                return (
                  <div key={field.name} className={field.half ? "sm:col-span-1" : "sm:col-span-2"}>
                    <label htmlFor={field.name} className="mb-1 block text-[11px] uppercase tracking-wide text-white/45">
                      {field.label}
                      {field.required && <span className="text-[#ff6b6b]"> *</span>}
                    </label>
                    {field.type === "textarea" ? (
                      <textarea id={field.name} name={field.name} placeholder={field.placeholder} rows={4}
                        onInput={() => clear(field.name)} className={`${cls} resize-none`} />
                    ) : field.type === "select" ? (
                      <select id={field.name} name={field.name} defaultValue=""
                        onChange={() => clear(field.name)} className={cls}>
                        <option value="" disabled>{ui.select}</option>
                        {field.options?.map((opt) => (
                          <option key={opt} value={opt} className="bg-neutral-900">{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input id={field.name} name={field.name} type={field.type} placeholder={field.placeholder}
                        onInput={() => clear(field.name)} className={cls} />
                    )}
                    {err && <p className="mt-1 text-[11.5px] text-[#ff6b6b]">{ui.requiredField}</p>}
                  </div>
                );
              })}

              {summary && Object.values(errors).some(Boolean) && (
                <p className="sm:col-span-2 text-[13px] font-medium text-[#ff6b6b]">{ui.completeAll}</p>
              )}

              <button type="submit"
                className="sm:col-span-2 mt-1 w-full rounded-full bg-white px-6 py-3.5 text-[14px] font-semibold text-black transition-colors hover:bg-white/85">
                {contact.form.submitLabel}
              </button>
              {contact.micro && (
                <p className="sm:col-span-2 flex items-center justify-center gap-1.5 text-center text-[11.5px] text-white/40">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {contact.micro}
                </p>
              )}
            </form>
          )}

          {/* contato direto + redes */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12.5px] text-white/45">
            <a href={`mailto:${contact.email}`} className="transition-colors hover:text-white">{contact.email}</a>
            <span className="text-white/20">·</span>
            <span>{contact.phone}</span>
            {contact.socials.map((s) => (
              <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" className="uppercase tracking-widest transition-colors hover:text-white">{s.label}</a>
            ))}
          </div>

          {site.footer?.length > 0 && (
            <div className="mt-8 border-t border-white/10 pt-5 space-y-1 text-center">
              {site.footer.map((line, i) => (
                <p key={i} className="text-[11px] leading-relaxed text-white/30">{line}</p>
              ))}
            </div>
          )}
        </div>
      </div>
    </OverlayShell>
  );
}
