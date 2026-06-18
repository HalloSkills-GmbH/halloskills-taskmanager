"use client";

import { useRef, useTransition } from "react";
import { addTodo, toggleTodo, deleteTodo } from "./todo-actions";

type Todo = { id: string; text: string; done: boolean };

export function PersonalTodos({ initialTodos }: { initialTodos: Todo[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  const handleAdd = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const text = (fd.get("text") as string) ?? "";
    if (!text.trim()) return;
    formRef.current?.reset();
    startTransition(() => addTodo(text));
  };

  return (
    <section className="rounded-2xl border border-app-border bg-app-card p-6 shadow-card">
      <h2 className="text-base font-bold text-app-ink">To-dos</h2>

      {/* Input */}
      <form ref={formRef} onSubmit={handleAdd} className="mt-4 flex gap-2">
        <input
          name="text"
          type="text"
          placeholder="Neues To-do…"
          autoComplete="off"
          className="hs-input flex-1 !h-8 !text-[13px] !py-1"
        />
        <button
          type="submit"
          disabled={pending}
          className="flex h-8 items-center gap-1 rounded-lg bg-app-brand px-3 text-[12px] font-bold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
          Hinzufügen
        </button>
      </form>

      {/* List */}
      {initialTodos.length === 0 ? (
        <p className="mt-4 text-sm text-app-muted">Noch keine To-dos.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {initialTodos.map((todo) => (
            <li key={todo.id} className="group flex items-center gap-3 rounded-xl border border-app-border px-3 py-2.5">
              <button
                type="button"
                onClick={() => startTransition(() => toggleTodo(todo.id, !todo.done))}
                className={[
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition",
                  todo.done
                    ? "border-[#15803d] bg-[#15803d]"
                    : "border-[var(--border)] bg-white hover:border-app-brand",
                ].join(" ")}
                aria-label={todo.done ? "Als offen markieren" : "Als erledigt markieren"}
              >
                {todo.done && (
                  <svg width={10} height={10} viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
              <span className={["flex-1 text-[13px]", todo.done ? "line-through text-app-muted" : "text-app-ink"].join(" ")}>
                {todo.text}
              </span>
              <button
                type="button"
                onClick={() => startTransition(() => deleteTodo(todo.id))}
                className="hidden group-hover:flex h-5 w-5 items-center justify-center rounded text-app-muted hover:text-red-500 transition"
                aria-label="Löschen"
              >
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
