"use client";

/** Renders the single application-owned confirmation surface used by every frontend area. */
import { useEffect, useRef } from "react";
import { useConfirmDialogStore } from "./ConfirmDialogStore";

/** Hosts the shared confirmation dialog and focuses the safe cancellation action. */
export function ConfirmDialogHost() {
  const request = useConfirmDialogStore((state) => state.request);
  const resolve = useConfirmDialogStore((state) => state.resolve);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!request) return;
    cancelRef.current?.focus();
  }, [request]);

  if (!request) return null;
  const danger = request.tone === "danger";
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/35 p-4"
      role="presentation"
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={
          request.description ? "confirm-dialog-description" : undefined
        }
        className="w-full max-w-md border border-slate-200 bg-white p-6 shadow-2xl"
      >
        <h2
          id="confirm-dialog-title"
          className="text-lg font-semibold text-slate-900"
        >
          {request.title}
        </h2>
        {request.description && (
          <p
            id="confirm-dialog-description"
            className="mt-2 text-sm leading-6 text-slate-500"
          >
            {request.description}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={() => resolve(false)}
            className="border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            {request.cancelLabel ?? "Cancel"}
          </button>
          <button
            type="button"
            onClick={() => resolve(true)}
            className={`px-4 py-2.5 text-sm font-semibold text-white ${danger ? "bg-rose-600 hover:bg-rose-700" : "bg-indigo-600 hover:bg-indigo-700"}`}
          >
            {request.confirmLabel ?? "Confirm"}
          </button>
        </div>
      </section>
    </div>
  );
}
