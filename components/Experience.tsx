"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { armAudio, setMuted, setOpenness, startAudio, stopAudio } from "@/lib/audio";
import { ARTISTS, BEAT_COUNT, DJS, EVENT, type Artist } from "@/lib/event";
import { stage } from "@/lib/stage";

// WebGL cannot render on the server, so the scene loads in the browser only.
const Scene = dynamic(() => import("./Scene"), { ssr: false });

/** The first sign that a real person is here; any of these starts loading the 3D scene. */
const FIRST_TOUCH = ["pointermove", "pointerdown", "touchstart", "keydown", "wheel"] as const;
/** Longest the light switch waits for the scene before carrying on without it. */
const SCENE_WAIT = 2500;

const sleep = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));

function deferred() {
  let resolve = () => {};
  const promise = new Promise<void>((done) => (resolve = done));
  return { promise, resolve };
}

const LAST_BEAT = BEAT_COUNT - 1;

function Beat({ active, className = "", children }: { active: boolean; className?: string; children: React.ReactNode }) {
  return (
    <section className={`beat ${active ? "on" : ""} ${className}`} aria-hidden={!active} inert={!active}>
      {children}
    </section>
  );
}

/** A lineup slot: the artist's photo once announced, a neon "?" until then. */
function ArtistTile({ artist, show }: { artist: Artist; show: boolean }) {
  return (
    <div className="artist-tile">
      {artist.image && show ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={artist.image} alt={artist.name ?? "Artist"} />
      ) : (
        <span aria-label="Artist to be announced">?</span>
      )}
    </div>
  );
}

/** A DJ on the dance-floor stop: portrait and name once announced, a neon "?" until then. */
function DjCard({ dj, index, show }: { dj: Artist; index: number; show: boolean }) {
  return (
    <li className="dj-card">
      <div className="dj-photo">
        {dj.image && show ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dj.image} alt={dj.name ?? "DJ"} />
        ) : (
          <span aria-hidden>?</span>
        )}
      </div>
      <p className="eyebrow">DJ {String(index + 1).padStart(2, "0")}</p>
      <p className="dj-name">{dj.name ?? "To be announced"}</p>
    </li>
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

function Countdown({ to, label, done }: { to: string; label: string; done?: React.ReactNode }) {
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

  if (left === 0 && done) return <>{done}</>;
  const s = Math.floor((left ?? 0) / 1000);
  const parts = [
    ["Days", Math.floor(s / 86400)],
    ["Hours", Math.floor(s / 3600) % 24],
    ["Mins", Math.floor(s / 60) % 60],
    ["Secs", s % 60],
  ] as const;
  return (
    <div className="countdown" role="timer" aria-label={label}>
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

/** "Wed 18 Nov, 12 PM", always in Lagos time. */
function formatDrop(iso: string) {
  return new Intl.DateTimeFormat("en-NG", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Africa/Lagos",
  })
    .format(new Date(iso))
    .replace(":00", "");
}

export default function Experience() {
  const [entered, setEntered] = useState(false);
  const [beat, setBeat] = useState(0);
  const [sound, setSound] = useState(true);
  const [copied, setCopied] = useState(false);
  // The 3D scene is the heaviest thing on the page and the gate is dark anyway,
  // so it is not downloaded or built until someone actually interacts.
  const [sceneOn, setSceneOn] = useState(false);
  const [sceneReady] = useState(deferred);
  const [powering, setPowering] = useState(false);
  const bar = useRef<HTMLDivElement>(null);
  const entering = useRef(false);
  const scene = useRef<HTMLDivElement>(null);

  // Start every visit at the door, and hold the visitor there until the lights are on.
  useEffect(() => {
    history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
  }, []);
  // Nothing plays while the lights are off. This also silences a loop left
  // running if the page returns to the gate without a full reload.
  useEffect(() => {
    if (!entered) stopAudio();
  }, [entered]);
  useEffect(() => {
    document.documentElement.style.overflow = entered ? "" : "hidden";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [entered]);

  useEffect(() => {
    if (sceneOn) return;
    const start = () => setSceneOn(true);
    FIRST_TOUCH.forEach((type) => window.addEventListener(type, start, { passive: true }));
    return () => FIRST_TOUCH.forEach((type) => window.removeEventListener(type, start));
  }, [sceneOn]);

  useEffect(() => {
    const onScroll = () => {
      // Measured against the scene, whose height ignores the phone's address bar
      // sliding in and out. Using the live window height would nudge the camera
      // every time the bar moved.
      const screen = scene.current?.offsetHeight || window.innerHeight;
      const max = document.documentElement.scrollHeight - screen;
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
    // Audio has to be woken inside the tap itself; it stays silent for now.
    const armed = armAudio();
    setSceneOn(true);
    setPowering(true);
    // Usually the scene is already up from the visitor's first mouse move or
    // touch. If this tap is that first touch, give it a moment to arrive so the
    // wall lights with the sign, but never leave the visitor waiting on it.
    await Promise.race([Promise.all([armed, sceneReady.promise]), sleep(SCENE_WAIT)]);
    // Wait for sound to really be running so the tubes and the first kick land
    // together, but never keep the lights waiting if audio is blocked.
    await Promise.race([startAudio(), sleep(350)]);
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
      <div ref={scene} className="scene" aria-hidden>
        {sceneOn && <Scene active={entered} onReady={sceneReady.resolve} />}
      </div>

      {/* Scrolling this empty track is what walks the camera through the building. */}
      <div className="track" style={{ "--beats": LAST_BEAT } as React.CSSProperties} />

      <header className={`topbar ${entered ? "on" : ""}`}>
        <div className="brand">
          {/* The bar is hidden until the lights are on, so the logos are not fetched before then. */}
          {entered && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logos/bells-university.png" alt="Bells University of Technology" width={132} height={126} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logos/busa.png" alt="Bells University Students' Association" width={117} height={132} />
            </>
          )}
          <span className="host">{EVENT.host}</span>
        </div>
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

      <a className="credit" href="https://bludevs.site" target="_blank" rel="noopener">
        Developed by BluDevs
      </a>

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
            <button type="button" className="switch" onClick={enter} disabled={powering} aria-busy={powering}>
              {powering ? "Powering up…" : "Switch on the lights"}
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

      {ARTISTS.map((artist, i) => (
        <Beat
          key={i}
          active={beat === i + 2}
          // Text sits opposite the frame: frames alternate left, right, left, right.
          className={`justify-end max-md:items-center max-md:text-center md:justify-center ${
            i % 2 === 0 ? "md:items-end md:text-right" : "md:items-start"
          }`}
        >
          <p className="eyebrow">
            Artist {String(i + 1).padStart(2, "0")} / {String(ARTISTS.length).padStart(2, "0")}
          </p>
          <h2 className="artist-name">{artist.name ?? "To be announced"}</h2>
        </Beat>
      ))}

      <Beat active={beat === LAST_BEAT - 1} className="items-center justify-end text-center">
        <ul className="djs" aria-label="DJs">
          {DJS.map((dj, i) => (
            <DjCard key={i} dj={dj} index={i} show={entered} />
          ))}
        </ul>
        <p className="eyebrow">On the decks</p>
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
              <Countdown to={EVENT.date} label="Time until Neon Night" />
            </>
          ) : EVENT.ticketsDrop && !EVENT.ticketsUrl ? (
            <>
              <p className="eyebrow mt-5">Tickets drop {formatDrop(EVENT.ticketsDrop)}</p>
              <Countdown
                to={EVENT.ticketsDrop}
                label="Time until tickets drop"
                done={<p className="line">Tickets are out now.</p>}
              />
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
          <ul className="lineup" aria-label="Lineup">
            {ARTISTS.map((a, i) => (
              <li key={i}>
                <ArtistTile artist={a} show={entered} />
              </li>
            ))}
          </ul>
          <p className="footnote">{EVENT.host}</p>
        </div>
      </Beat>
    </main>
  );
}
