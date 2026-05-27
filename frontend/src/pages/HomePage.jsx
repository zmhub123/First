import { useEffect, useMemo, useRef, useState } from "react";
import { loadGameSave, saveGame } from "../api";

const VIEWPORT_WIDTH = 900;
const VIEWPORT_HEIGHT = 360;
const GROUND_Y = 310;
const PLAYER_W = 26;
const PLAYER_H = 34;
const MOVE_SPEED = 220;
const JUMP_VELOCITY = -480;
const GRAVITY = 1300;
const STOMP_BOUNCE_VELOCITY = -340;
const THEMES = [
  {
    name: "碧空草原",
    skyTop: "#84ccff",
    skyBottom: "#d9f4ff",
    grass: "#94d965",
    ground: "#7a4c27",
    platform: "#9a6434"
  },
  {
    name: "黄昏沙丘",
    skyTop: "#fcbf74",
    skyBottom: "#ffe5b5",
    grass: "#e6bb6a",
    ground: "#8c5a35",
    platform: "#a56d45"
  },
  {
    name: "月夜冰原",
    skyTop: "#6ea0ff",
    skyBottom: "#dce8ff",
    grass: "#b9d6ff",
    ground: "#5f6478",
    platform: "#727894"
  }
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

function intersects(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function getTheme(level) {
  return THEMES[(level - 1) % THEMES.length];
}

function levelRange(level, start, step) {
  return start + step * (level - 1);
}

function makePlatforms(level) {
  const pattern = (level - 1) % 3;
  if (pattern === 0) {
    return [
      { x: 220, y: 250, w: 120, h: 16 },
      { x: 440, y: 220, w: 140, h: 16 },
      { x: 700, y: 188, w: 130, h: 16 },
      { x: 980, y: 235, w: 120, h: 16 },
      { x: 1240, y: 200, w: 170, h: 16 }
    ];
  }
  if (pattern === 1) {
    return [
      {
        x: 200,
        y: 260,
        w: 150,
        h: 16,
        motion: { axis: "x", range: 60, speed: 1.3, phase: 0.2 }
      },
      { x: 430, y: 205, w: 110, h: 16 },
      {
        x: 610,
        y: 245,
        w: 170,
        h: 16,
        motion: { axis: "y", range: 44, speed: 1.8, phase: 1.1 }
      },
      { x: 880, y: 180, w: 130, h: 16 },
      { x: 1140, y: 235, w: 140, h: 16 },
      { x: 1400, y: 195, w: 150, h: 16 }
    ];
  }
  return [
    { x: 240, y: 240, w: 120, h: 16 },
    { x: 430, y: 175, w: 120, h: 16 },
    { x: 640, y: 225, w: 120, h: 16 },
    { x: 880, y: 165, w: 120, h: 16 },
    { x: 1120, y: 215, w: 120, h: 16 },
    { x: 1370, y: 175, w: 130, h: 16 }
  ];
}

function makePits(level, worldWidth) {
  const pattern = (level - 1) % 3;
  if (pattern !== 2) return [];
  const firstX = 510 + level * 18;
  const secondX = Math.min(worldWidth - 360, 1030 + level * 15);
  return [
    { x: firstX, w: 120 },
    { x: secondX, w: 160 }
  ];
}

function getMechanicLabel(level) {
  const pattern = (level - 1) % 3;
  if (pattern === 1) return "移动平台";
  if (pattern === 2) return "陷阱坑";
  return "强化巡逻敌人";
}

function makeEnemies(level) {
  const fast = Math.min(45 + level * 8, 110);
  const flyers = Math.floor((level - 1) / 2) + 1;
  const enemies = [
    {
      x: 560,
      baseY: GROUND_Y - 24,
      y: GROUND_Y - 24,
      w: 26,
      h: 24,
      type: "goomba",
      dir: 1,
      speed: fast,
      minX: 520,
      maxX: 700,
      floatPhase: 0
    },
    {
      x: 1080,
      baseY: GROUND_Y - 24,
      y: GROUND_Y - 24,
      w: 26,
      h: 24,
      type: "goomba",
      dir: -1,
      speed: fast + 8,
      minX: 980,
      maxX: 1240,
      floatPhase: 0
    }
  ];

  for (let i = 0; i < flyers; i += 1) {
    const x = levelRange(level, 760 + i * 260, 45);
    const y = 145 + (i % 2) * 30;
    enemies.push({
      x,
      baseY: y,
      y,
      w: 24,
      h: 20,
      type: "bat",
      dir: i % 2 === 0 ? 1 : -1,
      speed: 55 + level * 6,
      minX: x - 80,
      maxX: x + 80,
      floatPhase: i * 0.7
    });
  }

  return enemies;
}

function makeCoins(level, platforms, worldWidth) {
  const platformCoins = platforms.map((platform, index) => ({
    x: platform.x + 18 + ((index * 23) % Math.max(30, platform.w - 24)),
    y: platform.y - 24
  }));
  const groundCoins = [
    { x: levelRange(level, 320, 50), y: 266 },
    { x: levelRange(level, 890, 65), y: 266 },
    { x: worldWidth - 210, y: 266 }
  ];
  return [...platformCoins, ...groundCoins];
}

function makeScenery(level, worldWidth) {
  const clouds = [];
  const bushes = [];
  for (let i = 0; i < worldWidth; i += 250) {
    clouds.push({
      x: i + (Math.sin(i * 0.01 + level) * 50),
      y: 30 + (Math.cos(i * 0.02) * 40),
      size: 0.8 + Math.abs(Math.sin(i)) * 0.6
    });
    if (Math.abs(Math.cos(i * 0.03 + level)) > 0.3) {
      bushes.push({
        x: i + 100 + (Math.sin(i * 0.05) * 50),
        size: 0.7 + Math.abs(Math.cos(i)) * 0.5
      });
    }
  }
  return { clouds, bushes };
}

function buildLevel(level, lives, coins) {
  const worldWidth = 1800 + level * 260;
  const platforms = makePlatforms(level).map((platform) => ({
    ...platform,
    baseX: platform.x,
    baseY: platform.y,
    dx: 0,
    dy: 0
  }));
  const enemies = makeEnemies(level);
  const pits = makePits(level, worldWidth);
  const coinSpots = makeCoins(level, platforms, worldWidth);
  const scenery = makeScenery(level, worldWidth);
  const theme = getTheme(level);
  const mechanic = getMechanicLabel(level);

  return {
    level,
    theme,
    mechanic,
    lives,
    coins,
    elapsed: 0,
    worldWidth,
    goalX: worldWidth - 90,
    player: {
      x: 40,
      y: GROUND_Y - PLAYER_H,
      vx: 0,
      vy: 0,
      w: PLAYER_W,
      h: PLAYER_H,
      onGround: true,
      facing: 1
    },
    scenery,
    platforms,
    enemies,
    pits,
    coinsOnMap: coinSpots.map((coin, idx) => ({ ...coin, id: `${level}-${idx}`, collected: false })),
    floatingTexts: [],
    cameraX: 0,
    levelComplete: false,
    completeTimer: 0,
    statusText: `第 ${level} 关：${theme.name}（机制：${mechanic}）`
  };
}

export default function HomePage() {
  const frameRef = useRef(0);
  const lastTimeRef = useRef(0);
  const keysRef = useRef(new Set());
  const noticeTimerRef = useRef(0);
  const gameRef = useRef(buildLevel(1, 3, 0));
  const [game, setGame] = useState(gameRef.current);
  const [mode, setMode] = useState("menu");
  const [loadingSave, setLoadingSave] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [runtimeNotice, setRuntimeNotice] = useState("");
  const [runtimeLogs, setRuntimeLogs] = useState([]);

  function logClientEvent(event, details = {}) {
    const time = new Date().toISOString();
    console.log(`[frontend-game][${time}] ${event}`, details);
    const logLine = `${new Date().toLocaleTimeString()} ${event} ${JSON.stringify(details)}`;
    const entry = { id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`, text: logLine };
    setRuntimeLogs((prev) => [entry, ...prev].slice(0, 10));
  }

  function showRuntimeNotice(message) {
    setRuntimeNotice(message);
    clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => {
      setRuntimeNotice("");
    }, 1400);
  }

  useEffect(() => {
    const keyNameMap = {
      arrowup: "ArrowUp",
      arrowdown: "ArrowDown",
      arrowleft: "ArrowLeft",
      arrowright: "ArrowRight",
      " ": "Space"
    };

    function onKeyDown(event) {
      const key = event.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) {
        if (mode === "playing") {
          event.preventDefault();
        }
      }
      keysRef.current.add(key);
      if (keyNameMap[key]) {
        showRuntimeNotice(`触发了JS代码：${keyNameMap[key]}`);
        logClientEvent("keyboard:arrow-keydown", { key: keyNameMap[key], mode });
      }
    }
    function onKeyUp(event) {
      const key = event.key.toLowerCase();
      keysRef.current.delete(key);
      if (keyNameMap[key]) {
        logClientEvent("keyboard:arrow-keyup", { key: keyNameMap[key], mode });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [mode]);

  useEffect(() => () => clearTimeout(noticeTimerRef.current), []);

  useEffect(() => {
    if (mode !== "playing") {
      cancelAnimationFrame(frameRef.current);
      return;
    }

    function tick(ts) {
      if (!lastTimeRef.current) lastTimeRef.current = ts;
      const dt = Math.min((ts - lastTimeRef.current) / 1000, 0.033);
      lastTimeRef.current = ts;
      const next = stepGame(gameRef.current, keysRef.current, dt);
      gameRef.current = next;
      setGame(next);
      if (next.lives <= 0) {
        setMode("gameover");
        return;
      }
      frameRef.current = requestAnimationFrame(tick);
    }

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameRef.current);
      lastTimeRef.current = 0;
    };
  }, [mode]);

  function startNewGame() {
    const fresh = buildLevel(1, 3, 0);
    gameRef.current = fresh;
    setGame(fresh);
    setSaveMessage("");
    setMode("playing");
  }

  async function continueGame() {
    try {
      setLoadingSave(true);
      setSaveMessage("");
      logClientEvent("save:load:start");
      const data = await loadGameSave({
        onBackendTrigger: ({ method, path }) => {
          showRuntimeNotice("触发了后端");
          logClientEvent("backend:triggered", { method, path });
        }
      });
      logClientEvent("save:load:success", { exists: data.exists });
      if (!data.exists || !data.state) {
        setSaveMessage("没有找到存档，请先开始新游戏。");
        return;
      }
      const loaded = buildLevel(data.state.level, data.state.lives, data.state.coins);
      loaded.statusText = "已加载存档，继续闯关！";
      gameRef.current = loaded;
      setGame(loaded);
      setMode("playing");
    } catch (err) {
      logClientEvent("save:load:error", {
        message: err instanceof Error ? err.message : "读取存档失败"
      });
      setSaveMessage(err instanceof Error ? err.message : "读取存档失败");
    } finally {
      setLoadingSave(false);
    }
  }

  async function saveProgress() {
    try {
      const payload = { level: game.level, lives: game.lives, coins: game.coins };
      logClientEvent("save:write:start", payload);
      await saveGame(payload, {
        onBackendTrigger: ({ method, path }) => {
          showRuntimeNotice("触发了后端");
          logClientEvent("backend:triggered", { method, path });
        }
      });
      logClientEvent("save:write:success");
      setSaveMessage("存档成功。");
    } catch (err) {
      logClientEvent("save:write:error", {
        message: err instanceof Error ? err.message : "存档失败"
      });
      setSaveMessage(err instanceof Error ? err.message : "存档失败");
    }
  }

  function restartAfterGameOver() {
    setMode("menu");
    setSaveMessage("");
  }

  const hud = (
    <div className="hud">
      <div className="hud-stat">🚩 关卡 {game.level} <span className="hud-theme">({game.theme.name})</span></div>
      <div className="hud-stat">❤️ 生命 {game.lives}</div>
      <div className="hud-stat">🪙 金币 {game.coins}</div>
      <div className="hud-stat">⚙️ 机制: {game.mechanic}</div>
    </div>
  );
  const playerPose =
    !game.player.onGround ? "is-jumping" : Math.abs(game.player.vx) > 10 ? "is-running" : "is-idle";
  const playerFacing = game.player.facing < 0 ? "is-left" : "is-right";

  return (
    <section className="game-page">
      <h2>Mario 闯关（React + FastAPI + SQLite）</h2>
      <p>操作：A/D 或 左右移动，W/↑/空格跳跃。</p>

      <div className="game-toolbar">
        <button type="button" onClick={startNewGame}>
          开始游戏
        </button>
        <button type="button" onClick={continueGame} disabled={loadingSave}>
          {loadingSave ? "读取中..." : "继续游戏"}
        </button>
        <button type="button" onClick={saveProgress} disabled={mode !== "playing"}>
          保存进度
        </button>
      </div>

      {saveMessage && <p className="save-message">{saveMessage}</p>}
      {runtimeNotice && <p className="runtime-notice">{runtimeNotice}</p>}

      <div className="hud">{hud}</div>

      <div
        className="viewport"
        style={{
          "--sky-top": game.theme.skyTop,
          "--sky-bottom": game.theme.skyBottom,
          "--grass-color": game.theme.grass,
          "--ground-color": game.theme.ground,
          "--platform-color": game.theme.platform
        }}
      >
        <div className="scenery-layer clouds-layer" style={{ transform: `translateX(-${game.cameraX * 0.15}px)` }}>
          {game.scenery.clouds.map((cloud, idx) => (
            <div key={`cloud-${idx}`} className="cloud" style={{ left: cloud.x, top: cloud.y, transform: `scale(${cloud.size})` }} />
          ))}
        </div>
        <div className="scenery-layer bushes-layer" style={{ transform: `translateX(-${game.cameraX * 0.3}px)` }}>
          {game.scenery.bushes.map((bush, idx) => (
            <div key={`bush-${idx}`} className="bush" style={{ left: bush.x, bottom: 52, transform: `scale(${bush.size})`, transformOrigin: 'bottom center' }} />
          ))}
        </div>
        <div className="world" style={{ width: game.worldWidth, transform: `translateX(-${game.cameraX}px)` }}>
          <div className="ground" style={{ top: GROUND_Y, width: game.worldWidth }} />
          {game.platforms.map((platform, idx) => (
            <div
              key={`platform-${idx}`}
              className={`platform ${platform.motion ? "platform-moving" : ""}`}
              style={{ left: platform.x, top: platform.y, width: platform.w, height: platform.h }}
            />
          ))}
          {game.pits.map((pit, idx) => (
            <div key={`pit-${idx}`} className="pit" style={{ left: pit.x, top: GROUND_Y, width: pit.w }} />
          ))}
          {game.enemies.map((enemy, idx) => (
            <div
              key={`enemy-${idx}`}
              className={`enemy enemy-${enemy.type} ${enemy.defeated ? 'enemy-defeated' : ''}`}
              style={{ left: enemy.x, top: enemy.y, width: enemy.w, height: enemy.h }}
            />
          ))}
          {game.coinsOnMap
            .map((coin) => (
              <div key={coin.id} className={`coin ${coin.collected ? 'coin-collected' : ''}`} style={{ left: coin.x, top: coin.y }} />
            ))}
          {game.floatingTexts && game.floatingTexts.map(ft => (
            <div key={ft.id} className="floating-text" style={{ left: ft.x, top: ft.y, opacity: ft.timer }}>
              {ft.text}
            </div>
          ))}
          <div className={`goal ${game.levelComplete ? 'goal-complete' : ''}`} style={{ left: game.goalX, top: GROUND_Y - 160 }} />
          <div
            className={`player ${playerPose} ${playerFacing}`}
            style={{ left: game.player.x, top: game.player.y, width: game.player.w, height: game.player.h }}
          >
            <span className="player-eye" />
          </div>
        </div>

        {mode === "menu" && (
          <div className="overlay">
            <h3>点击开始后立即开玩</h3>
            <p>你也可以点击“继续游戏”读取 SQLite 存档。</p>
          </div>
        )}
        {mode === "gameover" && (
          <div className="overlay">
            <h3>Game Over</h3>
            <p>金币：{game.coins}</p>
            <button type="button" onClick={restartAfterGameOver}>
              返回菜单
            </button>
          </div>
        )}
      </div>

      <p className="status-line">{game.statusText}</p>
      <div className="runtime-log-panel">
        <h4>前端运行日志（最近 10 条）</h4>
        <ul>
          {runtimeLogs.map((log) => (
            <li key={log.id}>{log.text}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function stepGame(game, keys, dt) {
  const next = structuredClone(game);
  next.elapsed += dt;
  const player = next.player;

  if (next.levelComplete) {
    next.completeTimer -= dt;
    player.vx = 0;
    if (next.completeTimer <= 0) {
      const nextLevel = buildLevel(next.level + 1, next.lives, next.coins);
      nextLevel.statusText = `通关成功！进入第 ${nextLevel.level} 关`;
      return nextLevel;
    }
  } else {
    const isLeft = keys.has("a") || keys.has("arrowleft");
    const isRight = keys.has("d") || keys.has("arrowright");
    const isJump = keys.has("w") || keys.has("arrowup") || keys.has(" ");

    player.vx = 0;
    if (isLeft) {
      player.vx = -MOVE_SPEED;
      player.facing = -1;
    }
    if (isRight) {
      player.vx = MOVE_SPEED;
      player.facing = 1;
    }
    if (isJump && player.onGround) {
      player.vy = JUMP_VELOCITY;
      player.onGround = false;
    }
  }

  updateMovingPlatforms(next);

  const previousY = player.y;
  const previousBottom = previousY + player.h;
  player.vy += GRAVITY * dt;
  player.x += player.vx * dt;
  player.y += player.vy * dt;
  player.x = clamp(player.x, 0, next.worldWidth - player.w);
  player.onGround = false;

  const isAbovePit = overlapsPit(next.pits, player.x, player.w);
  if (!isAbovePit && player.y + player.h >= GROUND_Y) {
    player.y = GROUND_Y - player.h;
    player.vy = 0;
    player.onGround = true;
  }

  for (const platform of next.platforms) {
    const wasAbove = previousY + player.h <= platform.y;
    const nowTouchingTop = player.y + player.h >= platform.y;
    const overlapX = player.x + player.w > platform.x && player.x < platform.x + platform.w;
    if (wasAbove && nowTouchingTop && overlapX && player.vy >= 0) {
      player.y = platform.y - player.h;
      player.vy = 0;
      player.onGround = true;
      if (platform.motion) {
        player.x += platform.dx;
      }
    }
  }

  if (player.y > VIEWPORT_HEIGHT + 100) {
    return onLifeLost(next);
  }

  for (const enemy of next.enemies) {
    if (enemy.defeated) continue;
    enemy.x += enemy.speed * enemy.dir * dt;
    if (enemy.x <= enemy.minX) {
      enemy.x = enemy.minX;
      enemy.dir = 1;
    } else if (enemy.x >= enemy.maxX) {
      enemy.x = enemy.maxX;
      enemy.dir = -1;
    }
    if (enemy.type === "bat") {
      enemy.y = enemy.baseY + Math.sin(next.elapsed * 4 + enemy.floatPhase) * 14;
    }
  }

  const playerBox = { x: player.x, y: player.y, w: player.w, h: player.h };
  for (let i = next.enemies.length - 1; i >= 0; i -= 1) {
    const enemy = next.enemies[i];
    if (enemy.defeated) continue;
    if (!intersects(playerBox, enemy)) continue;

    const stompFromTop = player.vy > 0 && previousBottom <= enemy.y + 9;
    if (stompFromTop) {
      enemy.defeated = true;
      player.y = enemy.y - player.h;
      player.vy = STOMP_BOUNCE_VELOCITY;
      player.onGround = false;
      next.coins += 2;
      next.statusText = "踩怪成功！+2 金币";
      if (!next.floatingTexts) next.floatingTexts = [];
      next.floatingTexts.push({ id: Math.random(), x: enemy.x, y: enemy.y, text: "+2", timer: 1 });
      continue;
    }

    return onLifeLost(next);
  }

  for (const coin of next.coinsOnMap) {
    if (coin.collected) continue;
    const coinBox = { x: coin.x - 2, y: coin.y - 2, w: 16, h: 16 };
    if (intersects(playerBox, coinBox)) {
      coin.collected = true;
      next.coins += 1;
      next.statusText = "拿到金币！";
      if (!next.floatingTexts) next.floatingTexts = [];
      next.floatingTexts.push({ id: Math.random(), x: coin.x, y: coin.y, text: "+1", timer: 1 });
    }
  }

  if (!next.levelComplete && player.x >= next.goalX) {
    next.levelComplete = true;
    next.completeTimer = 2.0;
    next.statusText = "通关成功！";
    player.x = next.goalX - 10;
  }

  if (next.floatingTexts) {
    next.floatingTexts = next.floatingTexts.filter(ft => {
      ft.timer -= dt;
      ft.y -= 40 * dt;
      return ft.timer > 0;
    });
  }

  next.cameraX = clamp(player.x - VIEWPORT_WIDTH * 0.35, 0, next.worldWidth - VIEWPORT_WIDTH);
  return next;
}

function onLifeLost(game) {
  if (game.lives <= 1) {
    return {
      ...game,
      lives: 0,
      statusText: "生命耗尽，游戏结束。",
      cameraX: 0
    };
  }

  const retry = buildLevel(game.level, game.lives - 1, game.coins);
  retry.statusText = `掉落/碰敌人，剩余生命 ${retry.lives}`;
  return retry;
}

function overlapsPit(pits, playerX, playerWidth) {
  const feetStart = playerX + 4;
  const feetEnd = playerX + playerWidth - 4;
  return pits.some((pit) => feetEnd > pit.x && feetStart < pit.x + pit.w);
}

function updateMovingPlatforms(game) {
  for (const platform of game.platforms) {
    const prevX = platform.x;
    const prevY = platform.y;
    if (platform.motion) {
      const offset = Math.sin(game.elapsed * platform.motion.speed + platform.motion.phase) * platform.motion.range;
      if (platform.motion.axis === "x") {
        platform.x = platform.baseX + offset;
      } else {
        platform.y = platform.baseY + offset;
      }
    }
    platform.dx = platform.x - prevX;
    platform.dy = platform.y - prevY;
  }
}
