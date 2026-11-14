"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { setMuted, setOpenness, startAudio } from "@/lib/audio";
import { BEAT_COUNT, EVENT, GENRES } from "@/lib/event";
import { stage } from "@/lib/stage";

// WebGL cannot render on the server, so the scene loads in the browser only.
const Scene = dynamic(() => import("./Scene"), { ssr: false });

const LAST_BEAT = BEAT_COUNT - 1;

function Beat({ active, className = "", children }: { active: boolean; className?: string; children: React.ReactNode }) {
  return (
    <section className={`beat ${active ? "on" : ""} ${className}`} aria-hidden={!active} inert={!active}>
      {children}
    </section>
  );
}

function Title({ lit }: { lit: boolean }) {
  return (
    <h1 className={`title ${lit ? "lit" : ""}`}>
      <span className="title-city">Brick City</span>
      <span className="title-neon">Neon</span>
      <span className="title-night">Night</span>
      <span className="plate plate-back" aria-hidden>Rave</span>
      <span className="plate">Rave</span>
    </h1>
  );
}

function Countdown({ to }: { to: string }) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, new Date(to).getTime() - Date.now()));
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [to]);

  const s = Math.floor((left ?? 0) / 1000);
  const parts = [
    ["Days", Math.floor(s / 86400)],
    ["Hours", Math.floor(s / 3600) % 24],
    ["Mins", Math.floor(s / 60) % 60],
    ["Secs", s % 60],
  ] as const;
  return (
    <div className="countdown" role="timer" aria-label="Time until Neon Night">
      {parts.map(([label, value]) => (
        <div key={label}>
          <b>{left === null ? "--" : String(value).padStart(2, "0")}</b>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-NG", { weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(
    new Date(iso),
  );
}

export default function Experience() {
  const [entered, setEntered] = useState(false);
  const [beat, setBeat] = useState(0);
  const [sound, setSound] = useState(true);
  const [copied, setCopied] = useState(false);
  const bar = useRef<HTMLDivElement>(null);
  const entering = useRef(false);

  // Start every visit at the door, and hold the visitor there until the lights are on.
  useEffect(() => {
    history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
  }, []);
  useEffect(() => {
    document.documentElement.style.overflow = entered ? "" : "hidden";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [entered]);

  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      stage.progress = p;
      // Fully "inside" by the time the first genre sign comes up.
      setOpenness((p * LAST_BEAT) / 2);
      if (bar.current) bar.current.style.transform = `scaleX(${p})`;
      setBeat(Math.round(p * LAST_BEAT));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const enter = async () => {
    if (entering.current) return;
    entering.current = true;
    // Wait for sound to really be running so the tubes and the first kick land
    // together, but never keep the lights waiting if audio is blocked.
    await Promise.race([startAudio(), new Promise((done) => setTimeout(done, 350))]);
    stage.power = 1;
    setEntered(true);
  };

  const toggleSound = () => {
    setMuted(sound);
    setSound(!sound);
  };

  const goToEnd = () => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });

  const share = async () => {
    const data = {
      title: `${EVENT.name} | ${EVENT.series}`,
      text: "Brick City goes green. Neon Night is coming.",
      url: window.location.href,
    };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(data.url);
        setCopied(true);
      }
    } catch {
      // Sharing was cancelled or is unavailable; nothing to do.
    }
  };

  return (
    <main>
      <div className="scene" aria-hidden>
        <Scene />
      </div>

      {/* Scrolling this empty track is what walks the camera through the building. */}
      <div style={{ height: `calc(${LAST_BEAT} * 135vh + 100vh)` }} />

      <header className={`topbar ${entered ? "on" : ""}`}>
        <span className="host">{EVENT.host}</span>
        <div className="flex items-center gap-2">
          <button type="button" className="chip" onClick={toggleSound} aria-pressed={sound}>
            <span className={`eq ${sound ? "playing" : ""}`} aria-hidden>
              <i /><i /><i />
            </span>
            Sound {sound ? "on" : "off"}
          </button>
          {beat !== LAST_BEAT && (
            <button type="button" className="chip chip-solid" onClick={goToEnd}>
              {EVENT.ticketsUrl ? "Tickets" : "Skip"}
            </button>
          )}
        </div>
        <div ref={bar} className="progress" />
      </header>

      <Beat active={beat === 0} className="items-center justify-center text-center">
        <p className="eyebrow">{EVENT.host} presents</p>
        <Title lit={entered} />
        {entered ? (
          <div className="mt-8 flex flex-col items-center gap-3">
            <p className="soon">Coming soon!!</p>
            <p className="hint">Scroll to enter</p>
            <span className="scroll-line" aria-hidden />
          </div>
        ) : (
          <div className="mt-8 flex flex-col items-center gap-4">
            <button type="button" className="switch" onClick={enter}>
              Switch on the lights
            </button>
            <p className="hint">Sound on</p>
          </div>
        )}
      </Beat>

      <Beat active={beat === 1} className="items-center justify-center text-center">
        <p className="eyebrow">Through the door</p>
        <h2 className="statement">
          Lights off. Bass up.
          <br />
          Brick City goes <em>green</em>.
        </h2>
      </Beat>

      {GENRES.map((genre, i) => (
        <Beat
          key={genre.name}
          active={beat === i + 2}
          // Text sits opposite the sign: signs alternate left, right, left, right.
          className={`justify-end max-md:items-center max-md:text-center md:justify-center ${
            i % 2 === 0 ? "md:items-end md:text-right" : "md:items-start"
          }`}
        >
          <p className="eyebrow">
            Sound {String(i + 1).padStart(2, "0")} / {String(GENRES.length).padStart(2, "0")}
          </p>
          <h2 className="genre">{genre.name}</h2>
          <p className="line">{genre.line}</p>
        </Beat>
      ))}

      <Beat active={beat === LAST_BEAT - 1} className="items-center justify-end text-center">
        <p className="eyebrow">&amp; more</p>
        <h2 className="statement">
          One floor. <em>Every</em> sound.
        </h2>
      </Beat>

      <Beat active={beat === LAST_BEAT} className="items-center justify-end text-center">
        <div className="landing">
          <p className="eyebrow">
            {EVENT.series} · {EVENT.name}
          </p>
          <h2 className="soon soon-big">{EVENT.date ? formatDate(EVENT.date) : "Coming soon!!"}</h2>
          {EVENT.date ? (
            <>
              {EVENT.venue && <p className="line">{EVENT.venue}</p>}
              <Countdown to={EVENT.date} />
            </>
          ) : (
            <p className="line">Date, venue and tickets drop soon.</p>
          )}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            {EVENT.ticketsUrl && (
              <a className="switch" href={EVENT.ticketsUrl} target="_blank" rel="noreferrer">
                Get tickets
              </a>
            )}
            <button type="button" className={EVENT.ticketsUrl ? "chip chip-lg" : "switch"} onClick={share}>
              {copied ? "Link copied" : "Tell your crew"}
            </button>
            {EVENT.instagramUrl && (
              <a className="chip chip-lg" href={EVENT.instagramUrl} target="_blank" rel="noreferrer">
                Instagram
              </a>
            )}
          </div>
          <ul className="genres" aria-label="Genres">
            {GENRES.map((g) => (
              <li key={g.name}>{g.name}</li>
            ))}
            <li>&amp; more</li>
          </ul>
          <p className="footnote">{EVENT.host}</p>
        </div>
      </Beat>
    </main>
  );
}
