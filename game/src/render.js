// The painter: the city, its cars and people, the player, and every piece
// of chrome around them — the HUD, the minimap, the banners and the menu
// panels. The camera follows the player and clamps to the city; on the
// title screen it drifts over the living city instead. All drawing is plain
// canvas 2D, no images, no fonts loaded from anywhere.

import { WORLD, ROADS_V, ROADS_H, ROAD_W, PALETTE, FONT, MISSIONS } from './config.js';
import { hash2 } from './random.js';

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_PAUSED = 2;
export const SCREEN_OVER = 3;
export const SCREEN_WIN = 4;

const VIEW_W = 1280;
const VIEW_H = 720;
const HALF = ROAD_W / 2;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  let viewW = VIEW_W;
  let viewH = VIEW_H;
  let cam = { x: WORLD.width / 2, y: WORLD.height / 2 };

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const cw = canvas.clientWidth || 1280;
    const ch = canvas.clientHeight || 720;
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    scale = Math.min(canvas.width / VIEW_W, canvas.height / VIEW_H);
    viewW = canvas.width / scale;
    viewH = canvas.height / scale;
    offsetX = (canvas.width - VIEW_W * scale) / 2;
    offsetY = (canvas.height - VIEW_H * scale) / 2;
  }

  function updateCamera(state, screen) {
    let tx;
    let ty;
    if (screen === SCREEN_TITLE) {
      const a = state.time * 0.045;
      tx = WORLD.width / 2 + Math.cos(a) * 480;
      ty = WORLD.height / 2 + Math.sin(a) * 320;
    } else {
      tx = state.player.x;
      ty = state.player.y;
    }
    // A big jump (a staged scene, a fresh start) snaps the camera at once;
    // ordinary play glides, so the view never whips around.
    const dx = tx - cam.x;
    const dy = ty - cam.y;
    if (dx * dx + dy * dy > 500 * 500) {
      cam.x = tx;
      cam.y = ty;
    } else {
      cam.x += dx * 0.12;
      cam.y += dy * 0.12;
    }
    const minX = Math.min(WORLD.width / 2, viewW / 2);
    const maxX = Math.max(WORLD.width / 2, WORLD.width - viewW / 2);
    const minY = Math.min(WORLD.height / 2, viewH / 2);
    const maxY = Math.max(WORLD.height / 2, WORLD.height - viewH / 2);
    cam.x = Math.max(minX, Math.min(maxX, cam.x));
    cam.y = Math.max(minY, Math.min(maxY, cam.y));
  }

  function screenToWorld(sx, sy) {
    const dpr = window.devicePixelRatio || 1;
    const dx = sx * dpr;
    const dy = sy * dpr;
    return {
      x: cam.x + (dx - offsetX) / scale - VIEW_W / 2,
      y: cam.y + (dy - offsetY) / scale - VIEW_H / 2,
    };
  }

  // ---- World painting ------------------------------------------------------

  function drawGround(state) {
    const x0 = cam.x - viewW / 2 - 40;
    const y0 = cam.y - viewH / 2 - 40;
    const x1 = cam.x + viewW / 2 + 40;
    const y1 = cam.y + viewH / 2 + 40;
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    // Beach along the south edge, water beyond it.
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(x0, 2276, x1 - x0, WORLD.height - 2276);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(x0, 2392, x1 - x0, 60);
    ctx.fillStyle = PALETTE.waterDeep;
    ctx.fillRect(x0, 2400, x1 - x0, 52);
    // Parks.
    for (const park of state.city.parks) {
      ctx.fillStyle = PALETTE.park;
      ctx.fillRect(park.x, park.y, park.w, park.h);
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(park.x, park.y, park.w, 6);
    }
    // Roads: sidewalk, then asphalt, then the centre dashes.
    for (const road of ROADS_V) {
      ctx.fillStyle = PALETTE.sidewalk;
      ctx.fillRect(road - HALF - 16, y0, ROAD_W + 32, y1 - y0);
      ctx.fillStyle = PALETTE.asphalt;
      ctx.fillRect(road - HALF, y0, ROAD_W, y1 - y0);
      ctx.fillStyle = PALETTE.lane;
      for (let y = Math.floor(y0 / 44) * 44; y < y1; y += 44) {
        let nearCrossing = false;
        for (const cross of ROADS_H) if (Math.abs(y + 11 - cross) < 78) nearCrossing = true;
        if (!nearCrossing) ctx.fillRect(road - 2, y, 4, 22);
      }
    }
    for (const road of ROADS_H) {
      ctx.fillStyle = PALETTE.sidewalk;
      ctx.fillRect(x0, road - HALF - 16, x1 - x0, ROAD_W + 32);
      ctx.fillStyle = PALETTE.asphalt;
      ctx.fillRect(x0, road - HALF, x1 - x0, ROAD_W);
      ctx.fillStyle = PALETTE.lane;
      for (let x = Math.floor(x0 / 44) * 44; x < x1; x += 44) {
        let nearCrossing = false;
        for (const cross of ROADS_V) if (Math.abs(x + 11 - cross) < 78) nearCrossing = true;
        if (!nearCrossing) ctx.fillRect(x, road - 2, 22, 4);
      }
    }
    // Buildings: shadow, walls, roof edge, windows.
    for (const b of state.city.buildings) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x, b.y, b.w, 10);
      ctx.fillRect(b.x, b.y, 10, b.h);
      const cols = Math.max(1, Math.floor(b.w / 30));
      const rows = Math.max(1, Math.floor(b.h / 28));
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          const h = hash2(Math.floor(b.x) + c * 7, Math.floor(b.y) + r * 11);
          if (h < 0.5) continue;
          ctx.fillStyle = h > 0.92 ? PALETTE.windowLit : PALETTE.window;
          ctx.fillRect(b.x + 12 + c * ((b.w - 20) / cols), b.y + 16 + r * ((b.h - 24) / rows), 12, 14);
        }
      }
    }
    // Trees and palms.
    for (const tree of state.city.trees) {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.arc(tree.x + 3, tree.y + 4, tree.r, 0, Math.PI * 2);
      ctx.fill();
      if (tree.palm) {
        ctx.strokeStyle = '#8a6a42';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(tree.x, tree.y + tree.r);
        ctx.lineTo(tree.x, tree.y - 4);
        ctx.stroke();
        ctx.fillStyle = PALETTE.tree;
        for (let i = 0; i < 5; i += 1) {
          const a = (i / 5) * Math.PI * 2 + 0.4;
          ctx.beginPath();
          ctx.ellipse(tree.x + Math.cos(a) * 9, tree.y - 4 + Math.sin(a) * 7, 11, 4, a, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        ctx.fillStyle = PALETTE.tree;
        ctx.beginPath();
        ctx.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = PALETTE.treeDark;
        ctx.beginPath();
        ctx.arc(tree.x - tree.r * 0.3, tree.y - tree.r * 0.3, tree.r * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawMarker(x, y, radius, time) {
    const pulse = 1 + 0.12 * Math.sin(time * 4);
    ctx.fillStyle = PALETTE.markerPulse;
    ctx.beginPath();
    ctx.arc(x, y, radius * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.marker;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.45, 0, Math.PI * 2);
    ctx.stroke();
    // Diamond above the spot.
    const bob = Math.sin(time * 3) * 4;
    ctx.fillStyle = PALETTE.marker;
    ctx.save();
    ctx.translate(x, y - 34 + bob);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-9, -9, 18, 18);
    ctx.restore();
  }

  function drawPickups(state) {
    for (const pk of state.pickups) {
      const bob = Math.sin(state.time * 3 + pk.x) * 2;
      if (pk.kind === 'cash') {
        ctx.fillStyle = '#1e7a34';
        ctx.beginPath();
        ctx.arc(pk.x, pk.y + bob, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = PALETTE.cash;
        ctx.font = 'bold 15px ' + FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', pk.x, pk.y + bob + 1);
      } else if (pk.kind === 'health') {
        ctx.fillStyle = '#f4f1e8';
        ctx.beginPath();
        ctx.arc(pk.x, pk.y + bob, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e5534b';
        ctx.fillRect(pk.x - 3, pk.y + bob - 8, 6, 16);
        ctx.fillRect(pk.x - 8, pk.y + bob - 3, 16, 6);
      } else {
        ctx.fillStyle = '#3a3a3a';
        ctx.beginPath();
        ctx.arc(pk.x, pk.y + bob, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = PALETTE.marker;
        ctx.fillRect(pk.x - 2, pk.y + bob - 8, 4, 12);
        ctx.fillRect(pk.x - 4, pk.y + bob + 4, 8, 3);
      }
    }
  }

  function drawCar(car, state) {
    const isPlayer = state.player.carId === car.id;
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(3, 4, 26, 14, car.angle, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(car.angle);
    if (isPlayer) {
      ctx.strokeStyle = PALETTE.marker;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 30, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Wheels.
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-16, -13, 10, 5);
    ctx.fillRect(-16, 8, 10, 5);
    ctx.fillRect(8, -13, 10, 5);
    ctx.fillRect(8, 8, 10, 5);
    // Body.
    ctx.fillStyle = car.color;
    roundRect(ctx, -23, -11, 46, 22, 6);
    ctx.fill();
    // Cabin and windshield.
    ctx.fillStyle = 'rgba(30,42,56,0.85)';
    ctx.fillRect(-4, -8, 12, 16);
    ctx.fillStyle = 'rgba(180,220,240,0.7)';
    ctx.fillRect(8, -8, 3, 16);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(-14, -8, 8, 16);
    if (car.type === 'taxi') {
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(-6, -4, 10, 8);
      ctx.fillStyle = PALETTE.taxi;
      ctx.font = 'bold 6px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', -1, 10);
    }
    if (car.kind === 'police') {
      const flash = Math.floor(state.time * 5) % 2 === 0;
      ctx.fillStyle = flash ? PALETTE.policeLightR : PALETTE.policeLightB;
      ctx.fillRect(-8, -12, 7, 4);
      ctx.fillStyle = flash ? PALETTE.policeLightB : PALETTE.policeLightR;
      ctx.fillRect(1, -12, 7, 4);
      ctx.fillStyle = '#f4f1e8';
      ctx.font = 'bold 7px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('PD', 0, 2);
    }
    ctx.restore();
    if (car.kind === 'courier') {
      drawMarker(car.x, car.y - 6, 26, state.time);
    }
  }

  function drawPed(ped, state) {
    ctx.save();
    ctx.translate(ped.x, ped.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(2, 3, 10, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    if (ped.state === 'dead') {
      ctx.rotate(ped.angle + Math.PI / 2);
      ctx.fillStyle = '#7a2a22';
      ctx.beginPath();
      ctx.ellipse(0, 0, 13, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(Math.cos(ped.angle) * 3, Math.sin(ped.angle) * 3, 5, 0, Math.PI * 2);
    ctx.fill();
    if (ped.kind === 'cop') {
      ctx.fillStyle = '#1c2f45';
      ctx.beginPath();
      ctx.arc(0, -2, 6, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = PALETTE.marker;
      ctx.fillRect(-5, -8, 10, 2);
    }
    // A walking bob so the crowd reads as alive.
    const bob = Math.sin(state.time * 8 + ped.x) * 1.5;
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-6, 4 + bob);
    ctx.lineTo(-9, 10);
    ctx.moveTo(6, 4 - bob);
    ctx.lineTo(9, 10);
    ctx.stroke();
    ctx.restore();
  }

  function drawPlayer(state) {
    const p = state.player;
    if (p.carId) return; // the car is drawn with the rest, ringed in gold
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(2, 3, 12, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.marker;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 17, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = PALETTE.playerJacket;
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(Math.cos(p.angle) * 2, Math.sin(p.angle) * 2, 6, 0, Math.PI * 2);
    ctx.fill();
    // The gun, pointing at the mouse.
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(Math.cos(p.aimAngle) * 8, Math.sin(p.aimAngle) * 8);
    ctx.lineTo(Math.cos(p.aimAngle) * 22, Math.sin(p.aimAngle) * 22);
    ctx.stroke();
    if (p.shotFlash > 0) {
      ctx.fillStyle = '#ffe27a';
      ctx.beginPath();
      ctx.arc(Math.cos(p.aimAngle) * 26, Math.sin(p.aimAngle) * 26, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBulletsAndParticles(state) {
    for (const b of state.bullets) {
      ctx.strokeStyle = '#ffe27a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      ctx.stroke();
    }
    for (const pt of state.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ---- Chrome: HUD, minimap, banners, panels -------------------------------

  function drawMinimap(state) {
    const mw = 200;
    const mh = 150;
    const mx = VIEW_W - mw - 16;
    const my = VIEW_H - mh - 16;
    const sx = mw / WORLD.width;
    const sy = mh / WORLD.height;
    ctx.fillStyle = 'rgba(10, 14, 20, 0.82)';
    ctx.fillRect(mx, my, mw, mh);
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(mx, my, mw, mh);
    ctx.save();
    ctx.beginPath();
    ctx.rect(mx, my, mw, mh);
    ctx.clip();
    ctx.fillStyle = '#5d7a52';
    ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(mx, my + (2276 * sy), mw, mh - 2276 * sy);
    ctx.strokeStyle = '#9a938a';
    ctx.lineWidth = 3;
    for (const road of ROADS_V) {
      ctx.beginPath();
      ctx.moveTo(mx + road * sx, my);
      ctx.lineTo(mx + road * sx, my + mh);
      ctx.stroke();
    }
    for (const road of ROADS_H) {
      ctx.beginPath();
      ctx.moveTo(mx, my + road * sy);
      ctx.lineTo(mx + mw, my + road * sy);
      ctx.stroke();
    }
    ctx.fillStyle = '#f4f1e8';
    for (const car of state.cars) {
      if (car.kind === 'police') continue;
      ctx.fillRect(mx + car.x * sx - 1, my + car.y * sy - 1, 2, 2);
    }
    ctx.fillStyle = '#ff5a4a';
    for (const car of state.cars) {
      if (car.kind === 'police') {
        ctx.beginPath();
        ctx.arc(mx + car.x * sx, my + car.y * sy, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const m = state.mission;
    if (m.state === 'active' && m.target) {
      const pulse = 4 + Math.sin(state.time * 5) * 1.5;
      ctx.fillStyle = PALETTE.marker;
      ctx.save();
      ctx.translate(mx + m.target.x * sx, my + m.target.y * sy);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-pulse, -pulse, pulse * 2, pulse * 2);
      ctx.restore();
    }
    const courier = state.cars.find((c) => c.id === m.courierId);
    if (courier && m.state === 'active' && m.phase === 'tail') {
      ctx.fillStyle = '#ffd94a';
      ctx.beginPath();
      ctx.arc(mx + courier.x * sx, my + courier.y * sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // The player, a gold arrow pointing where they face.
    ctx.save();
    ctx.translate(mx + state.player.x * sx, my + state.player.y * sy);
    ctx.rotate(state.player.angle);
    ctx.fillStyle = PALETTE.marker;
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-5, -5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 11px ' + FONT;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('SOLMAR', mx + 6, my + 14);
  }

  function drawHUD(state, opts) {
    const p = state.player;
    const car = state.cars.find((c) => c.id === p.carId);
    // Cash and health, top left.
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, 12, 12, 210, 64, 8);
    ctx.fill();
    ctx.fillStyle = PALETTE.cash;
    ctx.font = 'bold 24px ' + FONT;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`$${state.money.toLocaleString('en-US')}`, 24, 40);
    ctx.fillStyle = state.health > 30 ? PALETTE.health : PALETTE.healthLow;
    ctx.fillRect(24, 50, 150 * (state.health / 100), 10);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(24, 50, 150, 10);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 12px ' + FONT;
    ctx.fillText(`${Math.ceil(state.health)}`, 180, 60);
    // Ammo or speed, under the cash.
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 14px ' + FONT;
    if (car) {
      ctx.fillText(`SPEED ${Math.round(Math.abs(car.speed) * 0.12)} mph`, 24, 96);
    } else if (p.reloadT > 0) {
      ctx.fillText('RELOADING…', 24, 96);
    } else {
      ctx.fillText(`AMMO ${p.ammo} / 12`, 24, 96);
    }
    // Wanted stars, top right.
    ctx.textAlign = 'right';
    ctx.font = 'bold 26px ' + FONT;
    let stars = '';
    for (let i = 0; i < 5; i += 1) stars += i < state.wanted ? '★' : '☆';
    ctx.fillStyle = state.wanted > 0 ? PALETTE.star : PALETTE.starEmpty;
    ctx.fillText(stars, VIEW_W - 16, 44);
    if (state.wanted > 0) {
      ctx.fillStyle = PALETTE.danger;
      ctx.font = 'bold 13px ' + FONT;
      ctx.fillText('WANTED', VIEW_W - 16, 64);
    }
    // Mission objective, top centre.
    if (state.objective) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 15px ' + FONT;
      ctx.fillStyle = 'rgba(16, 18, 24, 0.72)';
      const lines = wrapText(ctx, state.objective, 620);
      const boxH = lines.length * 20 + 16;
      roundRect(ctx, VIEW_W / 2 - 330, 12, 660, boxH, 8);
      ctx.fill();
      ctx.fillStyle = PALETTE.objective;
      lines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, 34 + i * 20));
    }
    // Mission progress (vault hold, tail timer) as a bar under the objective.
    const m = state.mission;
    if (m.state === 'active' && m.phase === 'vault') {
      const frac = Math.min(1, m.vaultT / 2.5);
      ctx.fillStyle = 'rgba(16, 18, 24, 0.72)';
      ctx.fillRect(VIEW_W / 2 - 110, 88, 220, 12);
      ctx.fillStyle = PALETTE.marker;
      ctx.fillRect(VIEW_W / 2 - 110, 88, 220 * frac, 12);
    }
    // Controls hint, bottom left.
    ctx.textAlign = 'left';
    ctx.font = '13px ' + FONT;
    ctx.fillStyle = 'rgba(244, 241, 232, 0.85)';
    const hint = car
      ? 'WASD drive · Space handbrake · E exit car · P pause · M mute'
      : 'WASD move · Shift run · Click shoot · E steal car · R reload · P pause · M mute';
    ctx.fillText(hint, 16, VIEW_H - 16);
    // Mute state.
    if (opts.muted) {
      ctx.textAlign = 'right';
      ctx.fillText('MUTED (M)', VIEW_W - 232, VIEW_H - 16);
    }
    // Banner, centre screen.
    if (state.banner.t > 0) {
      const alpha = Math.min(1, state.banner.t);
      ctx.globalAlpha = alpha;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(16, 18, 24, 0.78)';
      const subLines = wrapText(ctx, state.banner.sub, 640);
      const boxH = 64 + subLines.length * 20;
      roundRect(ctx, VIEW_W / 2 - 360, 218, 720, boxH, 10);
      ctx.fill();
      ctx.fillStyle = PALETTE.marker;
      ctx.font = 'bold 34px ' + FONT;
      ctx.fillText(state.banner.title, VIEW_W / 2, 258);
      ctx.fillStyle = PALETTE.text;
      ctx.font = '17px ' + FONT;
      subLines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, 286 + i * 20));
      ctx.globalAlpha = 1;
    }
    drawMinimap(state);
  }

  function panel(title, lines, accent) {
    ctx.fillStyle = 'rgba(10, 12, 18, 0.72)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = accent || PALETTE.marker;
    ctx.font = 'bold 64px ' + FONT;
    ctx.fillText(title, VIEW_W / 2, 250);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '19px ' + FONT;
    lines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, 300 + i * 30));
  }

  function drawTitle(state, opts) {
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(10, 12, 18, 0.45)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = PALETTE.marker;
    ctx.font = 'bold 96px ' + FONT;
    ctx.fillText('SOLMAR', VIEW_W / 2, 240);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 26px ' + FONT;
    ctx.fillText('STREETS OF GOLD', VIEW_W / 2, 282);
    ctx.font = '17px ' + FONT;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('An open-world crime story — steal cars, dodge the Solmar PD, run five jobs for Vera Kline.', VIEW_W / 2, 318);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 20px ' + FONT;
    ctx.fillText('SPACE — New Game', VIEW_W / 2, 400);
    if (opts.hasSave) {
      ctx.fillText(`C — Continue · $${opts.saveMoney.toLocaleString('en-US')} · Mission ${opts.saveMission + 1} of ${MISSIONS.length}`, VIEW_W / 2, 436);
    }
    ctx.font = '15px ' + FONT;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('WASD move / drive · Mouse aim · Click shoot · E steal & exit cars · R reload · Shift run · P pause · M mute', VIEW_W / 2, 500);
    ctx.fillText('Explore on foot or by car · Traffic & pedestrians · Wanted stars & police · Missions & story · Save in your browser', VIEW_W / 2, 526);
    if (opts.best > 0) {
      ctx.fillText(`Best run: $${opts.best.toLocaleString('en-US')}`, VIEW_W / 2, 566);
    }
  }

  function draw(state, screen, opts) {
    const options = opts || {};
    resize();
    updateCamera(state, screen);
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    ctx.save();
    ctx.translate(-cam.x + VIEW_W / 2, -cam.y + VIEW_H / 2);
    drawGround(state);
    // Mission target marker under everything that moves.
    const m = state.mission;
    if (m.state === 'active' && m.target) {
      drawMarker(m.target.x, m.target.y, 46, state.time);
    }
    drawPickups(state);
    for (const car of state.cars) drawCar(car, state);
    for (const ped of state.peds) drawPed(ped, state);
    drawPlayer(state);
    drawBulletsAndParticles(state);
    ctx.restore();
    // Screen-space chrome.
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    if (screen === SCREEN_TITLE) {
      drawTitle(state, options);
    } else if (screen === SCREEN_PLAY) {
      drawHUD(state, options);
    } else if (screen === SCREEN_PAUSED) {
      drawHUD(state, options);
      panel('PAUSED', ['P or Esc — resume', 'M — mute', 'Your progress is saved when a job ends.']);
    } else if (screen === SCREEN_OVER) {
      panel('BUSTED', [
        'The Solmar PD caught up with Milo Reyes.',
        `You kept $${Math.floor(state.money * 0.8).toLocaleString('en-US')} of your cash — the PD took the rest.`,
        `Jobs done: ${state.stats.missions} · Cars stolen: ${state.stats.stolen} · Shots fired: ${state.stats.shots}`,
        'SPACE — try again from the garage',
      ], PALETTE.danger);
    } else if (screen === SCREEN_WIN) {
      panel('SOLMAR LEGEND', [
        'Your debt is clear. Vera owes you one now.',
        `Final take: $${state.money.toLocaleString('en-US')} · Jobs done: ${state.stats.missions} · Cars stolen: ${state.stats.stolen}`,
        'SPACE — keep roaming Solmar',
      ]);
    }
  }

  return { draw, screenToWorld, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_OVER, SCREEN_WIN };
}
