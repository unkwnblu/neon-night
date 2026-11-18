"use client";

import jsQR from "jsqr";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import type { Role } from "@/lib/admin-auth";
import type { ScanResult } from "@/lib/checkin";
import { formatLagos } from "@/lib/ticket-types";
import { logout } from "../actions";
import { scanAction, undoAction, verifyAction, type ScanResponse } from "./actions";

type Stats = { issued: number; checkedIn: number };

export function Scanner({ role, initialStats }: { role: Role; initialStats: Stats }) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const paused = useRef(false);
  const [stats, setStats] = useState(initialStats);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [justVerified, setJustVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [camera, setCamera] = useState<"starting" | "on" | "off">("starting");
  const [manual, setManual] = useState("");
  const [busy, startBusy] = useTransition();

  const apply = useCallback((res: ScanResponse) => {
    if (res.stats) setStats(res.stats);
    if (res.error) {
      setError(res.error);
      paused.current = false;
      return;
    }
    setError(null);
    setResult(res.result ?? null);
    // Different buzz for good and bad scans, so staff don't have to read the screen every time.
    navigator.vibrate?.(res.result?.kind === "valid" ? 60 : [80, 60, 80]);
  }, []);

  const lookUp = useCallback(
    (code: string) => {
      paused.current = true;
      setJustVerified(false);
      startBusy(async () => apply(await scanAction(code)));
    },
    [apply],
  );

  const next = () => {
    setResult(null);
    setJustVerified(false);
    setManual("");
    paused.current = false;
  };

  // Camera + decode loop. jsQR reads frames from a small canvas, which works on iPhone and Android alike.
  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
          audio: false,
        });
        if (stopped || !video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        setCamera("on");
      } catch {
        setCamera("off");
        return;
      }

      const ctx = canvas.current!.getContext("2d", { willReadFrequently: true })!;
      const tick = () => {
        if (stopped) return;
        const v = video.current;
        if (!paused.current && v && v.readyState >= 2 && v.videoWidth) {
          const w = 480;
          const h = Math.round((v.videoHeight / v.videoWidth) * w);
          canvas.current!.width = w;
          canvas.current!.height = h;
          ctx.drawImage(v, 0, 0, w, h);
          const found = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" });
          if (found?.data) lookUp(found.data);
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [lookUp]);

  return (
    <div className="sc-shell">
      <header className="sc-top">
        <div>
          <span className="sc-brand">Neon Night · Check-in</span>
          <b className="sc-count">
            {stats.checkedIn} <small>/ {stats.issued} in</small>
          </b>
        </div>
        <div className="sc-top-actions">
          {role === "admin" && (
            <Link href="/admin" className="sc-link">
              Dashboard
            </Link>
          )}
          <form action={logout}>
            <button className="sc-link">Sign out</button>
          </form>
        </div>
      </header>

      <div className="sc-viewport">
        <video ref={video} playsInline muted className="sc-video" />
        <canvas ref={canvas} hidden />
        {camera === "on" && <div className="sc-frame" aria-hidden />}
        {camera === "starting" && <p className="sc-cam-note">Starting camera…</p>}
        {camera === "off" && (
          <p className="sc-cam-note">
            Camera unavailable. Allow camera access for this site (it needs https), or type the code below.
          </p>
        )}
        {busy && !result && <p className="sc-cam-note sc-checking">Checking…</p>}
      </div>

      <form
        className="sc-manual"
        onSubmit={(e) => {
          e.preventDefault();
          if (manual.trim()) lookUp(manual);
        }}
      >
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="Or type a code: NN-XXXX-XXXX"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          aria-label="Ticket code"
        />
        <button disabled={busy || !manual.trim()}>Check</button>
      </form>
      {error && (
        <p className="sc-error" role="alert">
          {error}
        </p>
      )}

      {result && (
        <ResultSheet
          result={result}
          justVerified={justVerified}
          busy={busy}
          onVerify={() =>
            startBusy(async () => {
              const res = await verifyAction(result.code);
              apply(res);
              if (res.result?.kind === "checked_in") setJustVerified(true);
            })
          }
          onUndo={() =>
            startBusy(async () => {
              apply(await undoAction(result.code));
              setJustVerified(false);
            })
          }
          onNext={next}
        />
      )}
    </div>
  );
}

function ResultSheet({
  result,
  justVerified,
  busy,
  onVerify,
  onUndo,
  onNext,
}: {
  result: ScanResult;
  justVerified: boolean;
  busy: boolean;
  onVerify: () => void;
  onUndo: () => void;
  onNext: () => void;
}) {
  if (result.kind === "not_found") {
    return (
      <section className="sc-sheet sc-bad" role="alert">
        <p className="sc-status">✕ Ticket not found</p>
        <p className="sc-detail">
          <code>{result.code}</code> isn&apos;t a Neon Night ticket. Don&apos;t admit.
        </p>
        <button className="sc-btn" onClick={onNext}>
          Scan next
        </button>
      </section>
    );
  }

  const who = (
    <>
      <h2 className="sc-name">{result.holderName}</h2>
      <p className="sc-detail">
        <b>{result.tierName}</b>
        {result.perk && <span className="sc-perk"> · {result.perk}</span>}
        <br />
        Ticket {result.holderNumber} of {result.ofQuantity} · <code>{result.code}</code>
        <br />
        <span className="sc-email">{result.email}</span>
      </p>
    </>
  );

  if (result.kind === "void") {
    return (
      <section className="sc-sheet sc-bad" role="alert">
        <p className="sc-status">✕ Not valid: refunded</p>
        {who}
        <button className="sc-btn" onClick={onNext}>
          Scan next
        </button>
      </section>
    );
  }

  if (result.kind === "checked_in") {
    const when = result.checkedInAt ? formatLagos(result.checkedInAt) : "";
    return justVerified ? (
      <section className="sc-sheet sc-ok" role="status">
        <p className="sc-status">✓ Verified: admit</p>
        {who}
        <button className="sc-btn sc-btn-primary" onClick={onNext} autoFocus>
          Scan next
        </button>
        <button className="sc-undo" onClick={onUndo} disabled={busy}>
          Undo verify
        </button>
      </section>
    ) : (
      <section className="sc-sheet sc-warn" role="alert">
        <p className="sc-status">! Already verified</p>
        {who}
        <p className="sc-detail sc-when">
          {result.holderName.split(/\s+/)[0]} has already been verified{when ? ` at ${when}` : ""}. Don&apos;t admit again.
        </p>
        <button className="sc-btn" onClick={onNext} autoFocus>
          Scan next
        </button>
        <button className="sc-undo" onClick={onUndo} disabled={busy}>
          Undo that verify
        </button>
      </section>
    );
  }

  return (
    <section className="sc-sheet sc-valid" role="status">
      <p className="sc-status">Valid ticket</p>
      {who}
      <button className="sc-btn sc-btn-primary" onClick={onVerify} disabled={busy} autoFocus>
        {busy ? "Verifying…" : "Verify & admit"}
      </button>
      <button className="sc-undo" onClick={onNext} disabled={busy}>
        Cancel
      </button>
    </section>
  );
}
