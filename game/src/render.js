// Drawing only: the world's state and the current screen in, pixels
// out. The camera follows the player across the 3200x2400 city and
// snaps when the jump is large, so staged screenshots land on the
// action instead of mid-glide.
import { FONT, PALETTE, PLACES, ROADS_H, ROADS_V, ROAD_HALF, WORLD } from './config.js';
import { hash2 } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_COMPLETE = 'complete';

const VIEW_W = 1280;
const VIEW_H = 720;

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const camera = { x: WORLD.w / 2, y: WORLD.h / 2 };
  let scale = 1;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    scale = Math.min(canvas.width / VIEW_W, canvas.height / VIEW_H);
  }
  resize();
  window.addEventListener('resize', resize);

  function worldToScreen(x, y) {
    return {
      x: (x - camera.x) * scale + canvas.width / 2,
      y: (y - camera.y) * scale + canvas.height / 2,
    };
  }

  function drawCar(x, y, angle, color, kind) {
    ctx.save();
    ctx.translate((x - camera.x) * scale + canvas.width / 2, (y - camera.y) * scale + canvas.height / 2);
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-19, -11, 40, 26);
    ctx.fillStyle = color;
    roundRect(-20, -12, 40, 24, 6);
    ctx.fill();
    ctx.fillStyle = kind === 'cruiser' ? PALETTE.cruiserTrim : 'rgba(20,30,44,0.85)';
    ctx.fillRect(-6, -10, 12, 20);
    ctx.fillStyle = '#cfe8ff';
    ctx.fillRect(8, -9, 6, 18);
    if (kind === 'cruiser') {
      ctx.fillStyle = '#ff3b30';
      ctx.fillRect(-14, -12, 6, 4);
      ctx.fillStyle = '#3b82ff';
      ctx.fillRect(-14, 8, 6, 4);
    } else if (kind === 'player') {
      ctx.fillStyle = '#fff2b0';
      ctx.fillRect(18, -9, 3, 5);
      ctx.fillRect(18, 4, 3, 5);
    }
    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawGround(state) {
    const city = state.city;
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Sidewalk strips hug every road; the roads themselves go on top.
    ctx.fillStyle = PALETTE.sidewalk;
    for (const rx of ROADS_V) {
      const s = worldToScreen(rx - ROAD_HALF - 26, 0);
      ctx.fillRect(s.x, 0, (ROAD_HALF + 26) * 2 * scale, canvas.height);
    }
    for (const ry of ROADS_H) {
      const s = worldToScreen(0, ry - ROAD_HALF - 26);
      ctx.fillRect(0, s.y, canvas.width, (ROAD_HALF + 26) * 2 * scale);
    }
    // Beach and water, in world space.
    const beach = worldToScreen(city.beach.x0, city.beach.y0);
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(0, beach.y, canvas.width, canvas.height - beach.y);
    const water = worldToScreen(city.water.x0, 0);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(water.x, 0, canvas.width - water.x, canvas.height);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const wy = ((state.time * 20 + i * 90) % 240) * scale;
      ctx.beginPath();
      ctx.moveTo(water.x, wy);
      ctx.lineTo(canvas.width, wy + 12 * scale);
      ctx.stroke();
    }
    // Roads.
    ctx.fillStyle = PALETTE.road;
    for (const rx of ROADS_V) {
      const s = worldToScreen(rx - ROAD_HALF, 0);
      ctx.fillRect(s.x, 0, ROAD_HALF * 2 * scale, canvas.height);
    }
    for (const ry of ROADS_H) {
      const s = worldToScreen(0, ry - ROAD_HALF);
      ctx.fillRect(0, s.y, canvas.width, ROAD_HALF * 2 * scale);
    }
    // Dashed centre lines.
    ctx.strokeStyle = PALETTE.roadLine;
    ctx.lineWidth = 2 * scale;
    ctx.setLineDash([18 * scale, 22 * scale]);
    for (const rx of ROADS_V) {
      const s = worldToScreen(rx, 0);
      ctx.beginPath();
      ctx.moveTo(s.x, 0);
      ctx.lineTo(s.x, canvas.height);
      ctx.stroke();
    }
    for (const ry of ROADS_H) {
      const s = worldToScreen(0, ry);
      ctx.beginPath();
      ctx.moveTo(0, s.y);
      ctx.lineTo(canvas.width, s.y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // Parks.
    for (const park of city.parks) {
      const a = worldToScreen(park.x0, park.y0);
      const b = worldToScreen(park.x1, park.y1);
      ctx.fillStyle = PALETTE.park;
      ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
    }
    // Pier.
    const pierA = worldToScreen(city.pier.x0, city.pier.y0);
    const pierB = worldToScreen(city.pier.x1, city.pier.y1);
    ctx.fillStyle = '#8a6a42';
    ctx.fillRect(pierA.x, pierA.y, pierB.x - pierA.x, pierB.y - pierA.y);
    // Trees.
    for (const t of city.trees) {
      const s = worldToScreen(t.x, t.y);
      if (s.x < -30 || s.x > canvas.width + 30 || s.y < -30 || s.y > canvas.height + 30) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.arc(s.x + 2 * scale, s.y + 3 * scale, t.r * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.tree;
      ctx.beginPath();
      ctx.arc(s.x, s.y, t.r * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    // Buildings.
    for (const b of city.buildings) {
      const a = worldToScreen(b.x, b.y);
      const w = b.w * scale;
      const h = b.h * scale;
      if (a.x > canvas.width || a.y > canvas.height || a.x + w < 0 || a.y + h < 0) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(a.x + 4 * scale, a.y + 5 * scale, w, h);
      ctx.fillStyle = b.color;
      ctx.fillRect(a.x, a.y, w, h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(a.x + 4 * scale, a.y + 4 * scale, w - 8 * scale, h - 8 * scale);
      ctx.fillStyle = 'rgba(255,255,220,0.5)';
      const cols = Math.max(1, Math.floor(b.w / 46));
      const rows = Math.max(1, Math.floor(b.h / 40));
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          if (hash2(Math.floor(b.x), Math.floor(b.y), i * 7 + j) < 0.45) {
            ctx.fillRect(a.x + (10 + i * 46) * scale, a.y + (10 + j * 40) * scale, 14 * scale, 10 * scale);
          }
        }
      }
    }
    // Landmarks: bank, garage, hospital.
    drawLandmark(PLACES.bank.x, PLACES.bank.y, 150, 110, '#d8c690', 'BANK', '#7a5a20');
    drawLandmark(PLACES.rico.x, PLACES.rico.y, 170, 120, '#c96a4a', "RICO'S AUTO", '#fff');
    drawLandmark(PLACES.hospital.x, PLACES.hospital.y, 130, 100, '#e8e8e8', 'HOSPITAL', '#c0392b');
  }

  function drawLandmark(x, y, w, h, color, label, labelColor) {
    const a = worldToScreen(x - w / 2, y - h / 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(a.x + 4 * scale, a.y + 5 * scale, w * scale, h * scale);
    ctx.fillStyle = color;
    ctx.fillRect(a.x, a.y, w * scale, h * scale);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 2 * scale;
    ctx.strokeRect(a.x, a.y, w * scale, h * scale);
    ctx.fillStyle = labelColor;
    ctx.font = `bold ${Math.max(11, 13 * scale)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, a.x + (w * scale) / 2, a.y + (h * scale) / 2);
  }

  function drawMarker(x, y, pulse) {
    const s = worldToScreen(x, y);
    const r = (16 + 5 * Math.sin(pulse * 4)) * scale;
    ctx.strokeStyle = '#ffd34d';
    ctx.lineWidth = 3 * scale;
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffd34d';
    ctx.beginPath();
    ctx.moveTo(s.x, s.y - 12 * scale);
    ctx.lineTo(s.x + 8 * scale, s.y);
    ctx.lineTo(s.x, s.y + 12 * scale);
    ctx.lineTo(s.x - 8 * scale, s.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,211,77,0.35)';
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y - 60 * scale);
    ctx.lineTo(s.x, s.y - 18 * scale);
    ctx.stroke();
  }

  function drawMinimap(state, objective) {
    const mw = 190;
    const mh = 142;
    const mx = canvas.width - mw - 14;
    const my = 14;
    const sx = mw / WORLD.w;
    const sy = mh / WORLD.h;
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(mx - 6, my - 6, mw + 12, mh + 12);
    ctx.fillStyle = '#20262e';
    ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = '#2e6f9e';
    ctx.fillRect(mx + 3080 * sx, my, (WORLD.w - 3080) * sx, mh);
    ctx.fillStyle = '#e0c98f';
    ctx.fillRect(mx, my + 2280 * sy, mw, (WORLD.h - 2280) * sy);
    ctx.strokeStyle = '#4a4f58';
    ctx.lineWidth = 2;
    for (const rx of ROADS_V) {
      ctx.beginPath();
      ctx.moveTo(mx + rx * sx, my);
      ctx.lineTo(mx + rx * sx, my + mh);
      ctx.stroke();
    }
    for (const ry of ROADS_H) {
      ctx.beginPath();
      ctx.moveTo(mx, my + ry * sy);
      ctx.lineTo(mx + mw, my + ry * sy);
      ctx.stroke();
    }
    if (objective && objective.x != null) {
      const pulse = 6 + 3 * Math.sin(state.time * 4);
      ctx.fillStyle = '#ffd34d';
      ctx.beginPath();
      ctx.arc(mx + objective.x * sx, my + objective.y * sy, pulse, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const c of state.cruisers) {
      ctx.fillStyle = '#ff5a4d';
      ctx.beginPath();
      ctx.arc(mx + c.x * sx, my + c.y * sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    if (state.courier) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(mx + state.courier.car.x * sx, my + state.courier.car.y * sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    const p = state.player;
    ctx.save();
    ctx.translate(mx + p.x * sx, my + p.y * sy);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#ffd34d';
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-5, -4);
    ctx.lineTo(-5, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(mx - 6, my - 6, mw + 12, mh + 12);
  }

  function drawHUD(state, objective) {
    const p = state.player;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    // Top-left: cash, health, ammo/speed.
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(14, 14, 250, 92);
    ctx.fillStyle = PALETTE.money;
    ctx.font = `bold ${Math.max(15, 20 * scale)}px ${FONT}`;
    ctx.fillText(`$${p.money}`, 26, 40);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `${Math.max(12, 14 * scale)}px ${FONT}`;
    ctx.fillText(p.inCar ? `SPEED ${Math.round(Math.abs(p.car ? p.car.speed : 0) / 10)} mph` : `AMMO ${p.ammo} / 12`, 26, 64);
    // Health bar.
    ctx.fillStyle = '#3a2020';
    ctx.fillRect(26, 74, 180, 12);
    ctx.fillStyle = p.hp > 30 ? '#7ddc7d' : '#ff5a4d';
    ctx.fillRect(26, 74, 180 * clamp(p.hp / 100, 0, 1), 12);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `${Math.max(11, 12 * scale)}px ${FONT}`;
    ctx.fillText(`HP ${Math.max(0, Math.round(p.hp))}`, 212, 84);
    // Wanted stars, top centre.
    ctx.textAlign = 'center';
    ctx.font = `${Math.max(18, 26 * scale)}px ${FONT}`;
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < state.wanted ? '★' : '☆';
    ctx.fillStyle = state.wanted > 0 ? '#ffd34d' : 'rgba(255,255,255,0.45)';
    ctx.fillText(stars, canvas.width / 2, 44);
    // Mission banner.
    if (objective) {
      ctx.fillStyle = PALETTE.panel;
      const text = objective.text;
      ctx.font = `bold ${Math.max(13, 16 * scale)}px ${FONT}`;
      const w = ctx.measureText(text).width + 32;
      ctx.fillRect(canvas.width / 2 - w / 2, 56, w, 30);
      ctx.fillStyle = PALETTE.banner;
      ctx.fillText(text, canvas.width / 2, 77);
      if (objective.progress != null) {
        ctx.fillStyle = '#3a3230';
        ctx.fillRect(canvas.width / 2 - 110, 92, 220, 10);
        ctx.fillStyle = PALETTE.banner;
        ctx.fillRect(canvas.width / 2 - 110, 92, 220 * clamp(objective.progress, 0, 1), 10);
      }
    }
    // Event banner (mission complete / failed).
    if (state.banner.t > 0) {
      ctx.fillStyle = 'rgba(12,14,20,0.85)';
      ctx.font = `bold ${Math.max(15, 20 * scale)}px ${FONT}`;
      const bw = ctx.measureText(state.banner.text).width + 40;
      ctx.fillRect(canvas.width / 2 - bw / 2, 120, bw, 34);
      ctx.fillStyle = PALETTE.banner;
      ctx.fillText(state.banner.text, canvas.width / 2, 143);
      if (state.banner.sub) {
        ctx.fillStyle = PALETTE.text;
        ctx.font = `${Math.max(12, 14 * scale)}px ${FONT}`;
        ctx.fillText(state.banner.sub, canvas.width / 2, 164);
      }
    }
    drawMinimap(state, objective);
    // Controls hint, bottom left.
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(12,14,20,0.6)';
    ctx.font = `${Math.max(11, 12 * scale)}px ${FONT}`;
    ctx.fillText('WASD move/drive · Mouse aim · Click shoot · E steal car · R reload · Shift run · P pause · M mute', 14, canvas.height - 14);
  }

  function drawPanel(title, lines, prompt) {
    const w = 640;
    const lineH = 30;
    const h = 150 + lines.length * lineH + 60;
    const x = (canvas.width - w) / 2;
    const y = (canvas.height - h) / 2;
    ctx.fillStyle = 'rgba(8,10,16,0.72)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#ffd34d';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.banner;
    ctx.font = `bold ${Math.max(26, 38 * scale)}px ${FONT}`;
    ctx.fillText(title, canvas.width / 2, y + 58);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `${Math.max(13, 16 * scale)}px ${FONT}`;
    lines.forEach((line, i) => {
      ctx.fillText(line, canvas.width / 2, y + 104 + i * lineH);
    });
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `${Math.max(12, 14 * scale)}px ${FONT}`;
    ctx.fillText(prompt, canvas.width / 2, y + h - 24);
  }

  function toWorld(sx, sy) {
    return {
      x: camera.x + (sx - canvas.width / 2) / scale,
      y: camera.y + (sy - canvas.height / 2) / scale,
    };
  }

  function draw(state, screen, objective, save) {
    const p = state.player;
    // Camera follows the player; snaps when the jump is large.
    const dx = p.x - camera.x;
    const dy = p.y - camera.y;
    if (Math.hypot(dx, dy) > 500) {
      camera.x = p.x;
      camera.y = p.y;
    } else {
      camera.x += dx * 0.12;
      camera.y += dy * 0.12;
    }
    camera.x = clamp(camera.x, VIEW_W / 2 - 200, WORLD.w - VIEW_W / 2 + 200);
    camera.y = clamp(camera.y, VIEW_H / 2 - 200, WORLD.h - VIEW_H / 2 + 200);

    drawGround(state);
    // Vault circle during the hold.
    if (!state.storyDone && state.mission.index === 4 && state.mission.stage === 'vault') {
      const s = worldToScreen(PLACES.bank.x, PLACES.bank.y);
      ctx.strokeStyle = 'rgba(255,211,77,0.9)';
      ctx.lineWidth = 3 * scale;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 130 * scale, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Pickups.
    for (const pk of state.pickups) {
      const s = worldToScreen(pk.x, pk.y);
      ctx.fillStyle = '#7ddc7d';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 9 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#145214';
      ctx.font = `bold ${Math.max(10, 12 * scale)}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', s.x, s.y + 0.5);
    }
    // Mission marker.
    if (objective && objective.x != null && screen === SCREEN_PLAY) {
      drawMarker(objective.x, objective.y, state.time);
    }
    // Cars.
    for (const car of state.cars) {
      if (car.kind === 'player') continue;
      drawCar(car.x, car.y, car.angle, car.color, car.kind);
    }
    for (const c of state.cruisers) {
      drawCar(c.x, c.y, c.angle, PALETTE.cruiser, 'cruiser');
    }
    // Pedestrians.
    for (const ped of state.peds) {
      const s = worldToScreen(ped.x, ped.y);
      ctx.fillStyle = ped.dead ? 'rgba(160,58,48,0.8)' : ped.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, (ped.dead ? 10 : 8) * scale, 0, Math.PI * 2);
      ctx.fill();
      if (!ped.dead) {
        ctx.fillStyle = '#20242c';
        ctx.beginPath();
        ctx.arc(s.x, s.y - 3 * scale, 3 * scale, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Cops and guards.
    for (const cop of state.cops) {
      const s = worldToScreen(cop.x, cop.y);
      ctx.fillStyle = PALETTE.cop;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 9 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#8ab0ff';
      ctx.fillRect(s.x - 8 * scale, s.y - 12 * scale, 16 * scale, 4 * scale);
    }
    for (const g of state.guards) {
      const s = worldToScreen(g.x, g.y);
      ctx.fillStyle = PALETTE.guard;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 10 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff5a4d';
      ctx.beginPath();
      ctx.arc(s.x, s.y - 3 * scale, 3 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    // The player's car, then the player on foot.
    if (p.inCar && p.car) {
      drawCar(p.car.x, p.car.y, p.car.angle, PALETTE.playerCar, 'player');
    } else {
      const s = worldToScreen(p.x, p.y);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(s.x + 2 * scale, s.y + 4 * scale, 12 * scale, 8 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.player;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 11 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#20242c';
      ctx.lineWidth = 3 * scale;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x + Math.cos(p.angle) * 20 * scale, s.y + Math.sin(p.angle) * 20 * scale);
      ctx.stroke();
    }
    // Bullets.
    ctx.strokeStyle = '#ffe9a8';
    ctx.lineWidth = 2 * scale;
    for (const b of state.bullets) {
      const s = worldToScreen(b.x, b.y);
      ctx.beginPath();
      ctx.moveTo(s.x - (b.vx / 900) * 14 * scale, s.y - (b.vy / 900) * 14 * scale);
      ctx.lineTo(s.x, s.y);
      ctx.stroke();
    }
    // Particles.
    for (const pt of state.particles) {
      const s = worldToScreen(pt.x, pt.y);
      ctx.globalAlpha = clamp(pt.life / pt.max, 0, 1);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, pt.size * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) {
      drawHUD(state, objective);
    }
    if (screen === SCREEN_TITLE) {
      drawPanel('SOLMAR', [
        'Streets of Gold — a top-down open-world crime game',
        'You are Milo Reyes, getaway driver. Vera Kline owns one last job.',
        'Steal cars, dodge the law, run five jobs — and pull the Big Score.',
        'WASD move / drive · Mouse aim · Click shoot · E steal a car · R reload',
      ], save ? 'SPACE start a new job · C continue your save' : 'Press SPACE to start');
    } else if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', ['The city waits. Your heat does not cool while paused.'], 'P or Space to resume · M mute');
    } else if (screen === SCREEN_BUSTED) {
      drawPanel('BUSTED', [
        'The Solmar PD caught up with you.',
        `You kept 80% of your cash: $${Math.round(p.money)}`,
        'You wake up at the hospital. The job is still open.',
      ], 'Press SPACE to get back out there');
    } else if (screen === SCREEN_COMPLETE) {
      drawPanel('SOLMAR LEGEND', [
        'All five jobs done. The Big Score is yours.',
        `You walk away with $${p.money} — and the whole city knows your name.`,
        'Free roam is open: keep driving, the streets are yours.',
      ], 'Press SPACE to keep playing');
    }
  }

  return { draw, camera, toWorld };
}
