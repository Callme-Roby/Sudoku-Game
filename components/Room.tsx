'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MutableRefObject } from 'react';
import { api, ApiError } from '@/lib/game/api';
import { getName, saveName } from '@/lib/game/identity';
import { formatTime, readJSON, roomKey, writeJSON, type RoomCreds } from '@/lib/game/local';
import { MAX_ERRORS, type Action, type Snapshot } from '@/lib/game/state';
import { DIGITS, ICONS } from '@/lib/pixel/glyphs';
import type { PublicPlayer, PublicRoom } from '@/lib/server/rooms';
import { geometryFor, LEVEL_LABEL, makePuzzle } from '@/lib/sudoku/bank';
import { gridToString } from '@/lib/sudoku/geometry';
import { Board } from './Board';
import { Errors } from './Errors';
import { MODE_LABEL } from './CreateRoom';
import { ActionButton, Actions, DigitPad } from './Pad';
import { Pixel } from './Pixel';
import { GAME_CHROME, useBoardSize, useKeyboard, useSudoku } from './useSudoku';

type Offset = MutableRefObject<number>;

export function Room({ code }: { code: string }) {
  const [creds, setCreds] = useState<RoomCreds | null | undefined>(undefined);
  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const offset = useRef(0); // server clock − local clock

  useEffect(() => setCreds(readJSON<RoomCreds>(roomKey(code))), [code]);

  const accept = useCallback((r: PublicRoom, sentAt?: number) => {
    if (sentAt !== undefined) offset.current = r.now - (sentAt + Date.now()) / 2;
    setRoom(r);
  }, []);

  // polling
  useEffect(() => {
    if (creds === undefined) return;
    let stop = false;
    let timer: number | undefined;
    const tick = async () => {
      const sentAt = Date.now();
      try {
        accept(await api<PublicRoom>(`/api/rooms/${code}`, { auth: creds }), sentAt);
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) {
          setFatal('Partie introuvable');
          stop = true;
        }
      }
      if (!stop) timer = window.setTimeout(tick, document.hidden ? 4000 : 1500);
    };
    tick();
    return () => {
      stop = true;
      window.clearTimeout(timer);
    };
  }, [code, creds, accept]);

  if (fatal) return <Notice text={fatal} />;
  if (!room || creds === undefined) return <main className="screen" />;

  const me = creds ? room.players.find((p) => p.id === creds.id) : undefined;
  if (!me || !creds) {
    if (room.status !== 'lobby') return <Notice text="La partie a déjà commencé" />;
    return (
      <Join
        room={room}
        onJoined={(c) => {
          writeJSON(roomKey(code), c);
          setCreds(c);
        }}
      />
    );
  }
  if (room.status === 'lobby') return <Lobby room={room} creds={creds} onRoom={accept} />;
  return <Race key={`${room.round}`} room={room} creds={creds} offset={offset} onRoom={accept} />;
}

function Header({ room, right }: { room: PublicRoom; right?: React.ReactNode }) {
  return (
    <header className="bar" style={{ width: 'var(--board-w, 100%)', maxWidth: '100%' }}>
      <Link href="/" className="icon-btn" aria-label="menu" style={{ justifySelf: 'start' }}>
        <Pixel rows={ICONS.back} />
      </Link>
      <span>{LEVEL_LABEL[room.level]}</span>
      {right ?? <span className="muted">{room.mode === 'duel' ? 'Duel' : 'Royale'}</span>}
    </header>
  );
}

function Notice({ text }: { text: string }) {
  return (
    <main className="screen home">
      <p style={{ margin: 0 }}>{text}</p>
      <Link href="/" className="item">
        Menu
      </Link>
    </main>
  );
}

function Join({ room, onJoined }: { room: PublicRoom; onJoined: (c: RoomCreds) => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setName((n) => n || (getName() ?? '')), []);
  const host = room.players.find((p) => p.id === room.hostId);
  const full = room.players.filter((p) => p.active).length >= room.max;

  const join = async () => {
    setBusy(true);
    const who = saveName(name) ?? '';
    try {
      onJoined(await api<RoomCreds>(`/api/rooms/${room.code}/join`, { method: 'POST', body: { name: who } }));
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <main className="screen">
      <Header room={room} />
      <form
        className="lobby"
        onSubmit={(e) => {
          e.preventDefault();
          join();
        }}
      >
        <p style={{ margin: 0, textAlign: 'center' }}>
          {host ? `${host.name} te défie` : MODE_LABEL[room.mode]}
          <br />
          <span className="muted">
            {room.mode === 'duel' ? 'Un contre un' : 'Battle royale'} · {LEVEL_LABEL[room.level]}
          </span>
        </p>
        <label className="field">
          <span className="muted">Ton nom</span>
          <input
            className="input"
            value={name}
            maxLength={16}
            autoComplete="nickname"
            placeholder="Joueur"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <button type="submit" className="item" disabled={busy || full}>
          {full ? 'Partie complète' : 'Rejoindre'}
        </button>
        {error && <p className="muted" style={{ margin: 0 }}>{error}</p>}
      </form>
    </main>
  );
}

function Lobby({ room, creds, onRoom }: { room: PublicRoom; creds: RoomCreds; onRoom: (r: PublicRoom) => void }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  useEffect(() => setUrl(`${window.location.origin}/r/${room.code}`), [room.code]);
  const present = room.players.filter((p) => p.active);
  const isHost = room.hostId === creds.id;
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('Copie impossible — sélectionne le lien');
    }
  };
  const share = async () => {
    try {
      await navigator.share({ title: 'Sudoku', text: 'Une grille, le plus rapide gagne', url });
    } catch {
      /* cancelled */
    }
  };
  const start = async () => {
    setError(null);
    try {
      onRoom(await api<PublicRoom>(`/api/rooms/${room.code}/start`, { method: 'POST', auth: creds }));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <main className="screen">
      <Header room={room} />
      <div className="lobby">
        <div className="field" style={{ width: '100%' }}>
          <span className="muted">{room.mode === 'duel' ? 'Envoie ce lien à ton adversaire' : 'Envoie ce lien aux joueurs'}</span>
          <div className="link">{url.replace(/^https?:\/\//, '')}</div>
          <div className="row">
            <button type="button" className="item" style={{ minWidth: 0 }} onClick={copy}>
              {copied ? 'Copié' : 'Copier'}
            </button>
            {canShare && (
              <button type="button" className="item" style={{ minWidth: 0 }} onClick={share}>
                Partager
              </button>
            )}
          </div>
        </div>
        <div className="field" style={{ width: '100%' }}>
          <span className="muted">
            Joueurs {present.length} / {room.max}
          </span>
          <ul className="players">
            {present.map((p) => (
              <li key={p.id}>
                <span style={p.id === creds.id ? { textDecoration: 'underline', textUnderlineOffset: 3 } : undefined}>
                  {p.name}
                </span>
                <span className="muted">{p.id === room.hostId ? 'Hôte' : ''}</span>
              </li>
            ))}
          </ul>
        </div>
        {isHost ? (
          <button type="button" className="item" disabled={present.length < 2} onClick={start}>
            {present.length < 2 ? 'En attente de joueurs…' : 'Lancer'}
          </button>
        ) : (
          <span className="muted">En attente de l’hôte…</span>
        )}
        {error && <span className="muted">{error}</span>}
      </div>
    </main>
  );
}

function useServerNow(offset: Offset, every = 200) {
  const [now, setNow] = useState(() => Date.now() + offset.current);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now() + offset.current), every);
    return () => window.clearInterval(id);
  }, [offset, every]);
  return now;
}

const ordinal = (n: number) => (n === 1 ? '1er' : `${n}e`);

function standings(players: PublicPlayer[]) {
  const score = (p: PublicPlayer) =>
    p.finishedMs !== null ? p.finishedMs : p.gaveUp ? Number.MAX_SAFE_INTEGER : 1e12 - p.progress * 1e9;
  return players.slice().sort((a, b) => score(a) - score(b));
}

function Race({
  room,
  creds,
  offset,
  onRoom,
}: {
  room: PublicRoom;
  creds: RoomCreds;
  offset: Offset;
  onRoom: (r: PublicRoom) => void;
}) {
  const g = geometryFor(room.level);
  const puzzle = useMemo(() => makePuzzle(room.level, room.seed), [room.level, room.seed]);
  const saveKey = `sudoku:course:${room.code}:${room.round}`;
  const [saved] = useState(() => readJSON<Snapshot & { won?: boolean }>(saveKey) ?? undefined);
  const [state, rawDispatch] = useSudoku(g, puzzle.givens, saved);
  const now = useServerNow(offset);
  const startAt = room.startAt ?? Number.MAX_SAFE_INTEGER;
  const started = now >= startAt;
  const meP = room.players.find((p) => p.id === creds.id)!;
  const confirmed = meP.finishedMs !== null || meP.gaveUp;
  // duel decided (first finish or drop-out): everyone stops
  const ended = room.endedAt !== null;
  const done = confirmed || state.won || state.lost || ended;
  const [localFinish, setLocalFinish] = useState<number | null>(null);

  const dispatch = useCallback(
    (a: Action) => {
      if (started && !done) rawDispatch(a);
    },
    [started, done, rawDispatch],
  );
  useKeyboard(dispatch, g.n, started && !done);
  // stopped by the other player: clear the selection highlight
  useEffect(() => {
    if (ended) rawDispatch({ type: 'select', index: null });
  }, [ended, rawDispatch]);

  const others = room.players.filter((p) => p.id !== creds.id && (p.active || p.finishedMs !== null));
  const twoCols = others.length > 2;
  const racerRows = done ? 0 : twoCols ? Math.ceil(others.length / 2) : others.length;
  const { cell, u } = useBoardSize(g.n, GAME_CHROME + racerRows * 30);
  const boardW = g.n * cell + g.n + 1;

  const send = useCallback(
    (body: object) =>
      api<PublicRoom>(`/api/rooms/${room.code}/progress`, {
        method: 'POST',
        auth: creds,
        body: { round: room.round, ...body },
      })
        .then((r) => onRoom(r))
        .catch(() => {}),
    [room.code, room.round, creds, onRoom],
  );

  // progress, debounced; local save for reloads
  useEffect(() => {
    if (!started || confirmed || ended) return;
    writeJSON(saveKey, {
      values: state.values,
      notes: state.notes,
      won: state.won,
      errors: state.errors,
      lost: state.lost,
    });
    if (state.won || state.lost) return;
    const t = window.setTimeout(() => send({ values: gridToString(state.values) }), 400);
    return () => window.clearTimeout(t);
  }, [state.values, state.notes, state.won, state.errors, state.lost, started, confirmed, ended, saveKey, send]);

  // finished: send right away, and keep trying until the server confirms
  useEffect(() => {
    if (!state.won || confirmed || ended) return;
    setLocalFinish((f) => f ?? Date.now() + offset.current - startAt);
    const go = () => send({ values: gridToString(state.values) });
    go();
    const id = window.setInterval(go, 2000);
    return () => window.clearInterval(id);
  }, [state.won, confirmed, ended, state.values, send, offset, startAt]);

  // fourth error: out of the race
  useEffect(() => {
    if (!state.lost || confirmed || ended) return;
    setLocalFinish((f) => f ?? Date.now() + offset.current - startAt);
    const go = () => send({ eliminated: true });
    go();
    const id = window.setInterval(go, 2000);
    return () => window.clearInterval(id);
  }, [state.lost, confirmed, ended, send, offset, startAt]);

  const elapsed = meP.finishedMs ?? meP.timeMs ?? localFinish ?? (started ? now - startAt : 0);
  const countdown = Math.min(3, Math.max(1, Math.ceil((startAt - now) / 1000)));

  const ranked = standings(room.players.filter((p) => p.active || p.finishedMs !== null || p.id === creds.id));
  const finishers = ranked.filter((p) => p.finishedMs !== null);
  const myRank = finishers.findIndex((p) => p.id === creds.id) + 1;
  const allDone = ended || room.players.filter((p) => p.active).every((p) => p.finishedMs !== null || p.gaveUp);
  const isHost = room.hostId === creds.id;

  const rematch = async () => {
    try {
      onRoom(await api<PublicRoom>(`/api/rooms/${room.code}/rematch`, { method: 'POST', auth: creds }));
    } catch {
      /* the next poll will tell */
    }
  };

  return (
    <main className="screen game" style={{ '--board-w': `${boardW}px` } as CSSProperties}>
      <Header
        room={room}
        right={
          <span className="bar-right">
            <Errors count={state.errors} />
            <span className="timer">{formatTime(elapsed)}</span>
          </span>
        }
      />
      <section className="play">
        {!done && others.length > 0 && (
          <ul className="racers" style={{ '--cols': twoCols ? 2 : 1 } as CSSProperties} aria-label="adversaires">
            {standings(others).map((p) => (
              <li key={p.id} className="racer">
                <span className="name">{p.name}</span>
                <span className="muted">
                  {p.finishedMs !== null
                    ? formatTime(p.finishedMs)
                    : p.eliminated
                      ? 'Éliminé'
                      : p.gaveUp
                        ? 'Abandon'
                        : !p.active
                          ? 'Parti'
                          : ''}
                </span>
                <span className="track">
                  <i style={{ width: `${Math.round((p.finishedMs !== null ? 1 : p.progress) * 100)}%` }} />
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="board-wrap">
          <Board g={g} state={state} dispatch={dispatch} cell={cell} u={u} />
          {!started && (
            <div className="countdown" aria-live="polite">
              <Pixel rows={DIGITS[countdown]} label={String(countdown)} />
            </div>
          )}
        </div>
        {done && room.mode === 'duel' ? (
          <DuelResult room={room} me={meP} lost={state.lost} />
        ) : done ? (
          <div className="done-panel" role="status">
            <div className={meP.eliminated || state.lost ? 'lost-title' : undefined}>
              {meP.eliminated || state.lost
                ? 'Éliminé'
                : meP.gaveUp
                ? 'Abandon'
                : myRank === 1
                  ? 'Victoire'
                  : myRank > 1
                    ? `${ordinal(myRank)} sur ${ranked.length}`
                    : 'Terminé'}
              {meP.eliminated || state.lost ? (
                <span className="muted"> · {MAX_ERRORS + 1} erreurs</span>
              ) : (
                !meP.gaveUp && <span className="muted"> · {formatTime(elapsed)}</span>
              )}
            </div>
            <ol className="players" style={{ maxWidth: 320 }}>
              {ranked.map((p, k) => (
                <li key={p.id}>
                  <span>
                    <span className="muted">{p.finishedMs !== null ? `${k + 1}  ` : '·  '}</span>
                    <span
                      style={p.id === creds.id ? { textDecoration: 'underline', textUnderlineOffset: 3 } : undefined}
                    >
                      {p.name}
                    </span>
                  </span>
                  <span className="muted">
                    {p.finishedMs !== null
                      ? formatTime(p.finishedMs)
                      : p.eliminated
                        ? 'Éliminé'
                        : p.gaveUp
                        ? 'Abandon'
                        : !p.active
                          ? 'Parti'
                          : `${Math.round(p.progress * 100)} %`}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <DigitPad n={g.n} state={state} dispatch={dispatch} />
        )}
      </section>
      <footer className="foot">
        {done ? (
          <div className="row">
            {allDone && isHost ? (
              <button type="button" className="item" onClick={rematch}>
                Rejouer
              </button>
            ) : (
              <span className="item muted">{allDone ? 'En attente de l’hôte…' : 'Les autres jouent…'}</span>
            )}
            <Link href="/" className="item">
              Menu
            </Link>
          </div>
        ) : (
          <Actions
            state={state}
            dispatch={dispatch}
            extra={<GiveUp disabled={!started} onConfirm={() => send({ giveUp: true })} />}
          />
        )}
      </footer>
    </main>
  );
}

/** Two taps to give up — no browser dialog. */
function GiveUp({ disabled, onConfirm }: { disabled: boolean; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 3000);
    return () => window.clearTimeout(t);
  }, [armed]);
  return (
    <ActionButton
      icon={ICONS.flag}
      label={armed ? 'Confirmer' : 'Abandon'}
      pressed={armed}
      disabled={disabled}
      onClick={() => (armed ? onConfirm() : setArmed(true))}
    />
  );
}

/** One against one: who won, then each player's progress and time played. */
function DuelResult({ room, me, lost }: { room: PublicRoom; me: PublicPlayer; lost: boolean }) {
  const players = room.players.filter((p) => p.active || p.finishedMs !== null || p.gaveUp || p.id === me.id);
  const firstFinish = players
    .filter((p) => p.finishedMs !== null)
    .sort((a, b) => (a.finishedMs ?? 0) - (b.finishedMs ?? 0))[0];
  // nobody finished but someone dropped out: the other one wins
  const winner = firstFinish ?? (room.endedAt !== null ? players.find((p) => !p.gaveUp) : undefined);
  const title =
    me.eliminated || lost
      ? 'Éliminé'
      : me.gaveUp
        ? 'Abandon'
        : !winner
          ? 'Terminé'
          : winner.id === me.id
            ? 'Victoire'
            : 'Défaite';
  const order = [...players].sort((a, b) =>
    a.id === winner?.id ? -1 : b.id === winner?.id ? 1 : b.progress - a.progress,
  );
  const pct = (p: PublicPlayer) => `${p.finishedMs !== null ? 100 : Math.floor(p.progress * 100)} %`;
  return (
    <div className="done-panel" role="status">
      <div className={title === 'Éliminé' ? 'lost-title' : undefined}>{title}</div>
      <ol className="players" style={{ maxWidth: 320 }}>
        {order.map((p) => (
          <li key={p.id}>
            <span className={p.id === me.id ? 'me' : undefined}>{p.name}</span>
            <span className="muted">
              {p.eliminated ? 'Éliminé · ' : p.gaveUp ? 'Abandon · ' : ''}
              {pct(p)} · {p.timeMs !== null ? formatTime(p.timeMs) : '…'}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
